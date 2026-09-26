import { buildTimeline, submitWithRetry, submitSession, submitInBackground, finalRedirect } from '../src/run';
import { buildSessionPlan } from '../src/plan';
import { validateManifest } from '../src/manifest';
import { Rng } from '../src/rng';
import { COPY } from '../src/copy';

vi.mock('jspsych', () => ({ initJsPsych: vi.fn() }));
const m = validateManifest({ name: 'd', protocol_version: 'v0', domain_version: 'v0', wave: 1, artifact_type: 'text', evaluator_class: 'lay',
  stem_noun: 'poem', labeled_artifacts_per_session: 4, unlabeled_per_session: 2, attention_checks: 2,   // 4 + 2 + 2 = 8
  artifacts: { human: { '0': 'a', '1': 'b', '2': 'c', '3': 'd' }, ai: { '0': 'e', '1': 'f', '2': 'g', '3': 'h' } }, curation_criteria: 'c.md', osf_study: 'x' });
const plan = buildSessionPlan(m, new Rng(1));
const loaded = new Map([...plan.labeled.map((i) => i.artifact), ...plan.unlabeled.map((i) => i.artifact)]
  .map((a) => [a.id, { artifact: a, content: 'body' }]));
const ctx = { session_id: 'S', study_id: null, platform_session: false, start_time: 'T' };

test('timeline order: consent, labeled section with checks, title, unlabeled pairs, disclosure, submit, thanks', () => {
  const kinds = buildTimeline(m, plan, loaded, ctx, async () => true).map((t: any) => t.data.trial_kind);
  expect(kinds).toEqual(['consent', 'attention', 'labeled', 'labeled', 'attention', 'labeled', 'labeled', 'unlabeled_title',
    'unlabeled_rating', 'belief', 'unlabeled_rating', 'belief', 'disclosure', 'submit', 'thanks']);
});
test('demographic questions come after the last rating and before the disclosure', () => {
  const q = { id: 'ai_use', question: 'How often do you use AI coding assistants?', options: ['Never', 'Daily'] };
  const md = validateManifest({ ...m, demographics: [q, { ...q, id: 'role' }] } as any);
  const trials = buildTimeline(md, plan, loaded, ctx, async () => true) as any[];
  const kinds = trials.map((t) => t.data.trial_kind);
  expect(kinds.slice(-6)).toEqual(['demographics_title', 'demographic', 'demographic', 'disclosure', 'submit', 'thanks']);
  expect(kinds[kinds.length - 7]).toBe('belief');
  const title = trials[kinds.indexOf('demographics_title')];
  expect(title.stimulus).toContain('about you');
  expect(title.choices).toEqual(['Continue']);
  const first = trials[kinds.indexOf('demographic')];
  expect(first.data.question_id).toBe('ai_use');
  expect(first.choices).toEqual(['Never', 'Daily']);
  expect(first.stimulus).toContain(q.question);
});
test('no demographics title when the manifest asks no demographic questions', () => {
  const md = validateManifest({ ...m, demographics: [] } as any);
  const kinds = buildTimeline(md, plan, loaded, ctx, async () => true).map((t: any) => t.data.trial_kind);
  expect(kinds).not.toContain('demographics_title');
  expect(kinds).not.toContain('demographic');
  expect(kinds.slice(-4)).toEqual(['belief', 'disclosure', 'submit', 'thanks']);
});
const pngPool = (n: number, prefix: string) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), `artifacts/${prefix}${i}.png`]));
const imageManifest = validateManifest({ ...m, artifact_type: 'image', artifacts: { human: pngPool(4, 'h'), ai: pngPool(4, 'a') } } as any);
test('image domains get a preload trial right after consent', () => {
  const im = imageManifest;
  const kinds = buildTimeline(im, plan, loaded, ctx, async () => true).map((t: any) => t.data.trial_kind);
  expect(kinds.slice(0, 3)).toEqual(['consent', 'preload', 'attention']);
});
const preloadOf = (mf: any) => (buildTimeline(mf, plan, loaded, ctx, async () => true) as any[]).find((t) => t.data.trial_kind === 'preload');
test('a stalled image preload gives up instead of waiting on a blank page forever', () => {
  const t = preloadOf(imageManifest).max_load_time;
  expect(t).toBeGreaterThan(0);
  expect(Number.isFinite(t)).toBe(true);
});
test('an image that fails to load ends the study with the platform copy, never a rating trial showing its alt text', () => {
  const p = preloadOf(imageManifest);
  expect(p.continue_after_error).toBe(false);
  expect(p.error_message).toContain(COPY.startupFailed);
});
test('the preload wait tells the participant what is happening', () => {
  const p = preloadOf(imageManifest);
  expect(p.show_progress_bar).toBe(true);
  expect(p.message).toContain(COPY.preloadMessage);
});
test('submitWithRetry retries once then throws', async () => {
  let n = 0;
  await submitWithRetry(async () => { n++; if (n === 1) throw new Error('x'); }, 0);
  expect(n).toBe(2);
  await expect(submitWithRetry(async () => { throw new Error('always'); }, 0)).rejects.toThrow('always');
});
test('submitWithRetry waits delayMs before the second attempt', async () => {
  vi.useFakeTimers();
  const calls: number[] = [];
  const p = submitWithRetry(async () => { calls.push(Date.now()); if (calls.length === 1) throw new Error('x'); }, 1000);
  await vi.advanceTimersByTimeAsync(999); expect(calls).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1); await p; expect(calls).toHaveLength(2);
  vi.useRealTimers();
});
test('the submit trial shows the saving page while the store is in flight', async () => {
  document.body.innerHTML = '<div id="jspsych-content"></div>';
  let resolveSubmit: ((ok: boolean) => void) | undefined;
  const submit = () => new Promise<boolean>((r) => { resolveSubmit = r; });
  const trial = buildTimeline(m, plan, loaded, ctx, submit).find((t: any) => t.data.trial_kind === 'submit') as any;
  const done = vi.fn();
  trial.func(done);
  expect(document.getElementById('jspsych-content')!.textContent).toContain('Saving your responses');
  expect(done).not.toHaveBeenCalled();
  resolveSubmit!(true);
  await vi.waitFor(() => expect(done).toHaveBeenCalled());
});
test('the thank-you trial times out only when there is a redirect to make', () => {
  const kinds = buildTimeline(m, plan, loaded, { ...ctx, redirect: 'https://p.test' }, async () => true);
  expect((kinds[kinds.length - 1] as any).trial_duration).toBe(3000);
  expect((buildTimeline(m, plan, loaded, ctx, async () => true).pop() as any).trial_duration).toBeNull();
});
test('submitSession logs and alerts, without throwing, when buildSubmission itself throws', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const alertSpy = vi.fn();
  vi.stubGlobal('alert', alertSpy);
  let stored = false;
  await submitSession({
    getTrials: () => [],
    buildSubmission: () => { throw new Error('Trial rating for x has no response time'); },
    store: async () => { stored = true; },
    sessionId: 'S1',
  });
  expect(stored).toBe(false);
  expect(errorSpy).toHaveBeenCalledWith('Submission failed after retry', expect.any(Error));
  expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('S1'));
  errorSpy.mockRestore();
  vi.unstubAllGlobals();
});

// Expertise screen: the manifest's `prescreener` splits the timeline after consent into a pass branch (the study) and
// a fail branch (save a session row, screen-out page), both gated by the answer recorded on the prescreen trial.
const prescreener = { artifact: 'artifacts/prescreen.txt', question: 'Q?', options: ['a', 'b'], answer: 'b', redirect: 'https://p.test/out' };
const mp = validateManifest({ ...m, prescreener } as any);
const screenArt = { artifact: { id: 'prescreen', author: 'human' as const, index: 0, path: prescreener.artifact }, content: 'item' };
const prescreen = { artifact: screenArt, submit: () => {} };
const flat = (t: any): string[] => (t.timeline ? t.timeline.flatMap(flat) : [t.data.trial_kind]);

test('without a prescreener the timeline is flat and unchanged', () => {
  expect(buildTimeline(m, plan, loaded, ctx, async () => true).every((t: any) => !t.timeline)).toBe(true);
});
test('with a prescreener: consent, the question, then a study branch and a screen-out branch', () => {
  const tl = buildTimeline(mp, plan, loaded, ctx, async () => true, prescreen) as any[];
  expect(tl.map((t) => t.data?.trial_kind ?? 'branch')).toEqual(['consent', 'prescreen', 'branch', 'branch']);
  expect(flat(tl[2])).toEqual(['attention', 'labeled', 'labeled', 'attention', 'labeled', 'labeled', 'unlabeled_title',
    'unlabeled_rating', 'belief', 'unlabeled_rating', 'belief', 'disclosure', 'submit', 'thanks']);
  expect(flat(tl[3])).toEqual(['submit_screen_out', 'screen_out']);
});
test('the answer to the prescreen question decides which branch runs', () => {
  const tl = buildTimeline(mp, plan, loaded, ctx, async () => true, prescreen) as any[];
  const [, question, study, out] = tl;
  question.on_finish({ response: 1 });   // 'b', the answer
  expect(study.conditional_function()).toBe(true); expect(out.conditional_function()).toBe(false);
  question.on_finish({ response: 0 });
  expect(study.conditional_function()).toBe(false); expect(out.conditional_function()).toBe(true);
});
test('the screen-out branch fires the save without waiting and without the saving page, then shows the screen-out page', () => {
  document.body.innerHTML = '<div id="jspsych-content"></div>';
  const submit = vi.fn(async () => true), fire = vi.fn();
  const tl = buildTimeline(mp, plan, loaded, ctx, submit, { artifact: screenArt, submit: fire }) as any[];
  const [save, out] = tl[3].timeline;
  expect(save.async).toBeFalsy();
  save.func();
  expect(fire).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
  expect(document.getElementById('jspsych-content')!.textContent).not.toContain('Saving your responses');
  expect(out.trial_duration).toBe(3000);
});
test('a prescreener without its loaded artifact and background submit is a programming error', () => {
  expect(() => buildTimeline(mp, plan, loaded, ctx, async () => true)).toThrow(/prescreen/);
});
test('submitInBackground stores without waiting and only logs when the build or the store fails', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const alertSpy = vi.fn(); vi.stubGlobal('alert', alertSpy);
  const stored: unknown[] = [];
  submitInBackground({ getTrials: () => [], buildSubmission: () => ({ ok: true } as any), store: async (s) => { stored.push(s); }, sessionId: 'S' });
  await vi.waitFor(() => expect(stored).toEqual([{ ok: true }]));
  submitInBackground({ getTrials: () => [], buildSubmission: () => { throw new Error('bad build'); }, store: async () => {}, sessionId: 'S' });
  submitInBackground({ getTrials: () => [], buildSubmission: () => ({} as any), store: async () => { throw new Error('bad store'); }, sessionId: 'S' });
  await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
  expect(alertSpy).not.toHaveBeenCalled();
  warn.mockRestore(); vi.unstubAllGlobals();
});
test('finalRedirect: the screen-out URL after a failed prescreen, else the completion redirect', () => {
  const c = { ...ctx, redirect: 'https://p.test/done' };
  expect(finalRedirect(mp, c, [{ trial_kind: 'consent' }, { trial_kind: 'prescreen', passed: false }])).toBe('https://p.test/out');
  expect(finalRedirect(mp, c, [{ trial_kind: 'consent' }, { trial_kind: 'prescreen', passed: true }])).toBe('https://p.test/done');
  expect(finalRedirect(m, c, [{ trial_kind: 'consent' }])).toBe('https://p.test/done');
  expect(finalRedirect(m, ctx, [{ trial_kind: 'consent' }])).toBeUndefined();
});
test('the disclosure trial credits the sources of the artifacts this session showed', () => {
  // This plan draws the whole pool, so which artifact is credited is the point, not which is left out: that the
  // block lists only the session's artifacts is covered in attribution.test.ts.
  const shown = [...plan.labeled, ...plan.unlabeled].map((i) => i.artifact).find((a) => a.author === 'human')!;
  const credited = validateManifest({ ...m, attribution: { human: { [String(shown.index)]: { title: 'A shown source' } } } } as any);
  const t = (buildTimeline(credited, plan, loaded, ctx, async () => true) as any[]).find((x) => x.data.trial_kind === 'disclosure');
  document.body.innerHTML = '<div id="jspsych-content"><form></form></div>';
  t.on_load();
  expect(document.getElementById('jspsych-content')!.innerHTML).toContain('A shown source');
});

// Failed attention checks: the platform's separate completion code, when the manifest names one, but only once two
// checks have failed - Prolific's threshold for rejecting on attention in a study of 5 minutes or longer.
const ma = validateManifest({ ...m, attention_redirect: 'https://p.test/attn' } as any);
const passedCheck = { trial_kind: 'attention', expected: 7, response: 6 };   // response is the zero-based button index: 6 -> rating 7
const failedCheck = { trial_kind: 'attention', expected: 7, response: 7 };
test('finalRedirect: the attention URL once two checks have failed, else the completion redirect', () => {
  const c = { ...ctx, redirect: 'https://p.test/done' };
  expect(finalRedirect(ma, c, [failedCheck, failedCheck])).toBe('https://p.test/attn');
  expect(finalRedirect(ma, c, [passedCheck, failedCheck])).toBe('https://p.test/done');   // one failure is not a rejection ground
  expect(finalRedirect(ma, c, [failedCheck, passedCheck])).toBe('https://p.test/done');
  expect(finalRedirect(ma, c, [passedCheck, passedCheck])).toBe('https://p.test/done');
  expect(finalRedirect(m, c, [failedCheck, failedCheck])).toBe('https://p.test/done');   // no attention_redirect: as before
  expect(finalRedirect(ma, ctx, [failedCheck, failedCheck])).toBe('https://p.test/attn');   // even without a completion redirect
});
test('finalRedirect: with three checks, any two failures are enough', () => {
  const m3 = validateManifest({ ...m, attention_checks: 3, unlabeled_per_session: 1, attention_redirect: 'https://p.test/attn' } as any);
  expect(finalRedirect(m3, ctx, [failedCheck, passedCheck, failedCheck])).toBe('https://p.test/attn');
  expect(finalRedirect(m3, ctx, [passedCheck, failedCheck, passedCheck])).toBeUndefined();
});
test('finalRedirect: a failed prescreen wins over the attention URL (the checks were never shown)', () => {
  const both = validateManifest({ ...mp, attention_redirect: 'https://p.test/attn' } as any);
  expect(finalRedirect(both, ctx, [{ trial_kind: 'prescreen', passed: false }])).toBe('https://p.test/out');
});
