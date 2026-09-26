import { initJsPsych } from 'jspsych';
import callFunction from '@jspsych/plugin-call-function';
import preload from '@jspsych/plugin-preload';
import { validateManifest, type DomainManifest } from './manifest';
import { Rng, hashSeed } from './rng';
import { readSessionContext, type SessionContext } from './session';
import { buildSessionPlan, ratedArtifacts, type SessionPlan } from './plan';
import { loadArtifacts, escapeHtml, type LoadedArtifact } from './artifacts';
import { COPY } from './copy';
import { consentTrial } from './trials/consent';
import { labeledRatingTrial, attentionTrial } from './trials/rating';
import { unlabeledTitleTrial, unlabeledRatingTrial, beliefTrial } from './trials/unlabeled';
import { demographicsTitleTrial, demographicTrials } from './trials/demographics';
import { prescreenTrial, screenOutTrial } from './trials/prescreen';
import { disclosureTrial, thankYouTrial, showSavingPage } from './trials/disclosure';
import { attributionHtml } from './attribution';
import { buildSubmission, type TrialRecord, type Submission } from './submission';
import { storeSubmission } from './storage/writeRows';
import { DataPipeSink } from './storage/datapipe';
import type { Sink, BrowserMeta } from './storage/types';

export interface RunOptions {
  manifestUrl?: string; sink?: Sink; fetchFn?: typeof fetch; search?: string;
  uuid?: () => string; now?: () => string; navigate?: (url: string) => void;
}

/** How long the image preload waits before giving up on the pool and showing the failure page. Generous enough for a
 * full pool of photos on a slow connection, finite so a stalled request cannot strand the participant. */
export const PRELOAD_TIMEOUT_MS = 120_000;

/** Id under which the prescreener's artifact is loaded; not an artifact of the study pools, so never in a plan. */
export const PRESCREEN_ARTIFACT_ID = 'prescreen';

/** What the expertise screen needs: its loaded artifact, and a fire-and-forget save for the screened-out session row. */
export interface PrescreenDeps { artifact: LoadedArtifact; submit: () => void }

export function buildTimeline(m: DomainManifest, plan: SessionPlan, loaded: Map<string, LoadedArtifact>, ctx: SessionContext, submit: () => Promise<boolean>, prescreen?: PrescreenDeps) {
  const get = (id: string) => { const l = loaded.get(id); if (!l) throw new Error(`Artifact ${id} not loaded`); return l; };
  // Images are preloaded after consent so a rating trial's rt does not include download time. A whole pool of photos
  // is a real wait, so it runs behind a progress bar rather than a blank page, and is bounded: without max_load_time
  // the plugin waits on a stalled download forever. An image that will not load must never reach a rating trial -
  // the browser would render the <img> alt, which on a labeled trial is the provenance sentence - so the study stops
  // here instead, with the platform's own failure copy (jsPsych's default message says nothing about what to do).
  const preloadTrials = m.artifact_type === 'image'
    ? [{ type: preload, images: [...loaded.values()].map((l) => l.content), data: { trial_kind: 'preload' },
         show_progress_bar: true, message: `<p>${escapeHtml(COPY.preloadMessage)}</p>`,
         max_load_time: PRELOAD_TIMEOUT_MS, continue_after_error: false, error_message: `<p>${escapeHtml(COPY.startupFailed)}</p>` }]
    : [];
  let submitted = false;
  const submitTrial = { type: callFunction, async: true, func: (done: () => void) => { showSavingPage(); submit().then((ok) => { submitted = ok; }).finally(done); }, data: { trial_kind: 'submit' } };
  const study = [
    ...preloadTrials,
    ...plan.labeled.map((it) => (it.kind === 'attention' ? attentionTrial(it, get(it.artifact.id), m) : labeledRatingTrial(it, get(it.artifact.id), m))),
    unlabeledTitleTrial(),
    ...plan.unlabeled.flatMap((it) => [unlabeledRatingTrial(it, get(it.artifact.id), m), beliefTrial(it, get(it.artifact.id), m)]),
    ...(m.demographics.length > 0 ? [demographicsTitleTrial(), ...demographicTrials(m.demographics, ratedArtifacts(plan))] : []),
    disclosureTrial(ctx.platform_session, attributionHtml(m, plan)),
    submitTrial,
    thankYouTrial(ctx.redirect, ctx.session_id, () => submitted),
  ];
  if (!m.prescreener) return [consentTrial(m, ctx.platform_session), ...study];
  if (!prescreen) throw new Error('Manifest has a prescreener but its artifact and background submit were not provided');
  // The answer, recorded by the prescreen trial's on_finish, picks one of two jsPsych conditional timelines: the study,
  // or the screen-out page and redirect. The screened-out session row is posted in the background (keepalive) while
  // the page shows, not behind the saving page: the screen should feel instant, and losing the odd row is accepted
  // (the platform's screen-out count is the reference).
  let passed = false;
  const fireTrial = { type: callFunction, func: () => { prescreen.submit(); }, data: { trial_kind: 'submit_screen_out' } };
  return [
    consentTrial(m, ctx.platform_session),
    prescreenTrial(m.prescreener, prescreen.artifact, m.artifact_type, (ok) => { passed = ok; }),
    { timeline: study, conditional_function: () => passed },
    { timeline: [fireTrial, screenOutTrial()], conditional_function: () => !passed },
  ];
}

/** Where the page goes when the timeline ends: the platform's screen-out URL after a failed prescreen, else the
 * manifest's completion redirect (none in either case when the manifest sets none). */
export function finalRedirect(m: DomainManifest, ctx: SessionContext, trials: TrialRecord[]): string | undefined {
  const screenedOut = trials.some((t) => t.trial_kind === 'prescreen' && t.passed === false);
  return screenedOut && m.prescreener ? m.prescreener.redirect : ctx.redirect;
}

/** One retry after a pause, so a transient network blip is not retried in the same instant it failed. */
export async function submitWithRetry(fn: () => Promise<void>, delayMs = 1000): Promise<void> {
  try { await fn(); } catch (e) {
    console.warn('Submission attempt 1 failed, retrying', e);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    await fn();
  }
}

export interface SubmitSessionDeps {
  getTrials: () => TrialRecord[];
  buildSubmission: (trials: TrialRecord[]) => Submission;
  store: (submission: Submission) => Promise<void>;
  sessionId: string;
}

/**
 * The whole submit path — reading trial data, building the submission, and the retried store — takes the
 * same log-and-alert fallback on any error, so a thrown validation error (e.g. a missing rt) can never
 * silently drop a submission while the timeline moves on to thank-you and, potentially, redirects.
 */
export async function submitSession(deps: SubmitSessionDeps): Promise<boolean> {
  try {
    const trials = deps.getTrials();
    const submission = deps.buildSubmission(trials);
    await submitWithRetry(() => deps.store(submission));
    return true;
  } catch (e) {
    console.error('Submission failed after retry', e);
    alert(COPY.submitFailed + deps.sessionId);
    return false;
  }
}

/** Fire-and-forget counterpart of submitSession for the screened-out row: no retry, no alert, a console warning on
 * failure. Nothing waits on it; the page moves on and the request survives the redirect via the sink's keepalive. */
export function submitInBackground(deps: SubmitSessionDeps): void {
  let submission: Submission;
  try { submission = deps.buildSubmission(deps.getTrials()); }
  catch (e) { console.warn('Screen-out submission not built', deps.sessionId, e); return; }
  deps.store(submission).catch((e) => console.warn('Screen-out submission not stored', deps.sessionId, e));
}

/** Platform-owned failure page shown when the survey cannot start at all (e.g. an invalid manifest). */
export function renderStartupFailure(err: unknown): void {
  console.error(err);
  document.body.innerHTML = `<p>${escapeHtml(COPY.startupFailed)}</p>`;
}

export async function runSurvey(opts: RunOptions = {}): Promise<void> {
  const fetchFn = opts.fetchFn ?? fetch.bind(globalThis);
  const base = document.baseURI;
  const manifestUrl = new URL(opts.manifestUrl ?? './domainManifest.json', base).toString();
  const res = await fetchFn(manifestUrl);
  if (!res.ok) throw new Error(`Could not load manifest: HTTP ${res.status}`);
  const m = validateManifest(await res.json());
  const ctx = readSessionContext(opts.search ?? window.location.search, m.completion_redirect, opts.uuid);
  const plan = buildSessionPlan(m, new Rng(hashSeed(ctx.session_id)));
  const artifacts = [...plan.labeled.map((i) => i.artifact), ...plan.unlabeled.map((i) => i.artifact)];
  const prescreenArtifacts = m.prescreener ? [{ id: PRESCREEN_ARTIFACT_ID, author: 'human' as const, index: 0, path: m.prescreener.artifact }] : [];
  const loaded = await loadArtifacts([...artifacts, ...prescreenArtifacts], m.artifact_type, new URL('.', manifestUrl).toString(), fetchFn);
  const prescreenArtifact = loaded.get(PRESCREEN_ARTIFACT_ID);
  loaded.delete(PRESCREEN_ARTIFACT_ID);   // not part of the study pools: keeps the image preload list to the rated artifacts
  const sink = opts.sink ?? new DataPipeSink({ experimentId: m.osf_study, fetchFn, startTime: ctx.start_time });
  const screenOutSink = opts.sink ?? new DataPipeSink({ experimentId: m.osf_study, fetchFn, startTime: ctx.start_time, keepalive: true });
  const navigate = opts.navigate ?? ((url) => { window.location.href = url; });

  const jsPsych = initJsPsych({
    on_finish: () => { const to = finalRedirect(m, ctx, jsPsych.data.get().values() as TrialRecord[]); if (to) navigate(to); },
  });
  const meta = (): BrowserMeta => ({ browser: navigator.userAgent, jspsych_version: jsPsych.version(),
    viewport_width: window.innerWidth, viewport_height: window.innerHeight });
  const deps = (to: Sink): SubmitSessionDeps => ({
    getTrials: () => jsPsych.data.get().values() as TrialRecord[],
    buildSubmission: (trials) => buildSubmission(m, ctx, trials, opts.now),
    store: (submission) => storeSubmission(submission, meta(), m, to),
    sessionId: ctx.session_id,
  });
  const submit = () => submitSession(deps(sink));
  const prescreen = prescreenArtifact ? { artifact: prescreenArtifact, submit: () => submitInBackground(deps(screenOutSink)) } : undefined;
  await jsPsych.run(buildTimeline(m, plan, loaded, ctx, submit, prescreen));
}
