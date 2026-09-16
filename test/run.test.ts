import { buildTimeline, submitWithRetry, submitSession, finalRedirect } from '../src/run';
import { buildSessionPlan } from '../src/plan';
import { validateManifest } from '../src/manifest';
import { Rng } from '../src/rng';

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
test('image domains get a preload trial right after consent', () => {
  const im = validateManifest({ ...m, artifact_type: 'image' } as any);
  const kinds = buildTimeline(im, plan, loaded, ctx, async () => true).map((t: any) => t.data.trial_kind);
  expect(kinds.slice(0, 3)).toEqual(['consent', 'preload', 'attention']);
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
const flat = (t: any): string[] => (t.timeline ? t.timeline.flatMap(flat) : [t.data.trial_kind]);

test('without a prescreener the timeline is flat and unchanged', () => {
  expect(buildTimeline(m, plan, loaded, ctx, async () => true).every((t: any) => !t.timeline)).toBe(true);
});
test('with a prescreener: consent, the question, then a study branch and a screen-out branch', () => {
  const tl = buildTimeline(mp, plan, loaded, ctx, async () => true, screenArt) as any[];
  expect(tl.map((t) => t.data?.trial_kind ?? 'branch')).toEqual(['consent', 'prescreen', 'branch', 'branch']);
  expect(flat(tl[2])).toEqual(['attention', 'labeled', 'labeled', 'attention', 'labeled', 'labeled', 'unlabeled_title',
    'unlabeled_rating', 'belief', 'unlabeled_rating', 'belief', 'disclosure', 'submit', 'thanks']);
  expect(flat(tl[3])).toEqual(['submit', 'screen_out']);
});
test('the answer to the prescreen question decides which branch runs', () => {
  const tl = buildTimeline(mp, plan, loaded, ctx, async () => true, screenArt) as any[];
  const [, question, study, out] = tl;
  question.on_finish({ response: 1 });   // 'b', the answer
  expect(study.conditional_function()).toBe(true); expect(out.conditional_function()).toBe(false);
  question.on_finish({ response: 0 });
  expect(study.conditional_function()).toBe(false); expect(out.conditional_function()).toBe(true);
});
test('the screen-out branch saves behind the saving page before the screen-out page', async () => {
  document.body.innerHTML = '<div id="jspsych-content"></div>';
  const submit = vi.fn(async () => true);
  const tl = buildTimeline(mp, plan, loaded, ctx, submit, screenArt) as any[];
  const done = vi.fn();
  tl[3].timeline[0].func(done);
  expect(document.getElementById('jspsych-content')!.textContent).toContain('Saving your responses');
  await vi.waitFor(() => expect(done).toHaveBeenCalled());
  expect(submit).toHaveBeenCalledTimes(1);
});
test('a prescreener without its loaded artifact is a programming error', () => {
  expect(() => buildTimeline(mp, plan, loaded, ctx, async () => true)).toThrow(/prescreen/);
});
test('finalRedirect: the screen-out URL after a failed prescreen, else the completion redirect', () => {
  const c = { ...ctx, redirect: 'https://p.test/done' };
  expect(finalRedirect(mp, c, [{ trial_kind: 'consent' }, { trial_kind: 'prescreen', passed: false }])).toBe('https://p.test/out');
  expect(finalRedirect(mp, c, [{ trial_kind: 'consent' }, { trial_kind: 'prescreen', passed: true }])).toBe('https://p.test/done');
  expect(finalRedirect(m, c, [{ trial_kind: 'consent' }])).toBe('https://p.test/done');
  expect(finalRedirect(m, ctx, [{ trial_kind: 'consent' }])).toBeUndefined();
});
