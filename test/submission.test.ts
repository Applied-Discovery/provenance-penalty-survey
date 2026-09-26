import { buildSubmission } from '../src/submission';
import type { TrialRecord } from '../src/submission';
import { validateManifest } from '../src/manifest';

const m = validateManifest({ name: 'd', protocol_version: 'v0', domain_version: 'v1', wave: 2, artifact_type: 'text', evaluator_class: 'lay',
  stem_noun: 'poem', attention_checks: 2, labeled_artifacts_per_session: 2, unlabeled_per_session: 1,   // 5 of 6
  artifacts: { human: { '0': 'a', '1': 'b', '2': 'e' }, ai: { '0': 'c', '1': 'd', '2': 'f' } }, curation_criteria: 'c.md', osf_study: 'x' });
const ctx = { session_id: 'S', study_id: 'ST', platform_session: true, start_time: '2026-09-08T10:00:00.000Z' };
const trials = [
  { trial_kind: 'consent', response: 0, rt: 1000 },
  { trial_kind: 'attention', check_index: 0, expected: 7, artifact_id: 'd_v1_human_1', actual_author: 'human', response: 6, rt: 900 },
  { trial_kind: 'labeled', artifact_id: 'd_v1_human_0', actual_author: 'human', stated_author: 'ai', survey_pos: 1, response: 4, rt: 5000 },
  { trial_kind: 'attention', check_index: 1, expected: 3, artifact_id: 'd_v1_ai_2', actual_author: 'ai', response: 4, rt: 800 },
  { trial_kind: 'labeled', artifact_id: 'd_v1_ai_1', actual_author: 'ai', stated_author: 'human', survey_pos: 2, response: 8, rt: 6000 },
  { trial_kind: 'unlabeled_title', response: 0, rt: 300 },
  { trial_kind: 'unlabeled_rating', artifact_id: 'd_v1_ai_0', actual_author: 'ai', survey_pos: 3, response: 2, rt: 4000 },
  { trial_kind: 'belief', artifact_id: 'd_v1_ai_0', survey_pos: 3, response: 1, rt: 1500 },
  { trial_kind: 'disclosure', response: { withdraw: 'on' }, rt: 2000 },
];

test('assembles the submission from jsPsych trial records', () => {
  const s = buildSubmission(m, ctx, trials, () => '2026-09-08T10:20:00.000Z');
  expect(s).toMatchObject({ domain: 'd', session_id: 'S', study_id: 'ST', protocol_version: 'v0', domain_version: 'v1',
    evaluator_type: 'human', evaluator_class: 'lay', wave: 2, start_time: ctx.start_time, submission_time: '2026-09-08T10:20:00.000Z' });
  expect(s.data.attention_expected).toEqual([7, 3]);
  expect(s.data.attention_answer).toEqual([7, 5]);            // response index + 1
  expect(s.data.withdrawn).toBe(true);
  expect(s.data.ratings).toEqual([
    { id: 'd_v1_human_0', actual_author: 'human', stated_author: 'ai', survey_pos: 1, rating: 5, time_spent: 5000 },
    { id: 'd_v1_ai_1', actual_author: 'ai', stated_author: 'human', survey_pos: 2, rating: 9, time_spent: 6000 },
  ]);
  expect(s.data.unlabeled_ratings).toEqual([
    { id: 'd_v1_ai_0', actual_author: 'ai', predicted_author: 'ai', survey_pos: 3, rating: 3, rating_time_spent: 4000, belief_time_spent: 1500 },
  ]);
  expect(s.data.ratings.map((r) => r.id)).not.toContain('d_v1_human_1');   // attention artifacts are never rated
});
test('demographics are empty when the manifest asks no questions', () => {
  expect(buildSubmission(m, ctx, trials).data.demographics).toEqual([]);
});
const q1 = { id: 'ai_use', question: 'How often do you use AI coding assistants?', options: ['Never', 'Weekly', 'Daily'] };
const q2 = { id: 'role', question: 'What is your role?', options: ['Student', 'Professional'] };
const mDemo = validateManifest({ ...m, demographics: [q1, q2] } as any);
test('demographic answers are the chosen option text, in manifest order', () => {
  const t = [...trials, { trial_kind: 'demographic', question_id: 'role', response: 1, rt: 700 }, { trial_kind: 'demographic', question_id: 'ai_use', response: 2, rt: 900 }];
  expect(buildSubmission(mDemo, ctx, t).data.demographics).toEqual([{ id: 'ai_use', answer: 'Daily' }, { id: 'role', answer: 'Professional' }]);
});
test('throws if a demographic question was not answered or the answer is out of range', () => {
  expect(() => buildSubmission(mDemo, ctx, [...trials, { trial_kind: 'demographic', question_id: 'ai_use', response: 0, rt: 1 }])).toThrow(/role/);
  expect(() => buildSubmission(mDemo, ctx, [...trials, { trial_kind: 'demographic', question_id: 'ai_use', response: 0, rt: 1 },
    { trial_kind: 'demographic', question_id: 'role', response: 5, rt: 1 }])).toThrow(/role/);
});
test('withdrawn is false when the box is unticked', () => {
  const t = trials.map((x) => (x.trial_kind === 'disclosure' ? { ...x, response: {} } : x));
  expect(buildSubmission(m, ctx, t).data.withdrawn).toBe(false);
});
test('throws if a rating trial has no response time', () => {
  // rt: null simulates a corrupt jsPsych record; cast past the compile-time `rt?: number` contract to exercise the runtime guard.
  const t = trials.map((x) => (x.trial_kind === 'labeled' ? { ...x, rt: null } : x)) as TrialRecord[];
  expect(() => buildSubmission(m, ctx, t)).toThrow(/response time/);
});
test('throws if a belief answer is missing for an unlabeled rating', () => {
  expect(() => buildSubmission(m, ctx, trials.filter((x) => x.trial_kind !== 'belief'))).toThrow(/belief/);
});

// Expertise screen
const prescreener = { artifact: 'artifacts/p.txt', question: 'Q?', options: ['a', 'b', 'c'], answer: 'b', redirect: 'https://p.test/out' };
const mScreen = validateManifest({ ...mDemo, prescreener } as any);
const demoAnswers = [{ trial_kind: 'demographic', question_id: 'ai_use', response: 0, rt: 1 }, { trial_kind: 'demographic', question_id: 'role', response: 1, rt: 1 }];
test('no prescreen field when the manifest has no prescreener', () => {
  expect(buildSubmission(m, ctx, trials).data.prescreen).toBeUndefined();
});
test('a passed prescreen is recorded with the chosen option and the session continues as usual', () => {
  const t = [trials[0], { trial_kind: 'prescreen', response: 1, rt: 4000 }, ...trials.slice(1), ...demoAnswers];
  const s = buildSubmission(mScreen, ctx, t);
  expect(s.data.prescreen).toEqual({ answer: 'b', passed: true });
  expect(s.data.ratings).toHaveLength(2);
  expect(s.data.demographics).toHaveLength(2);
});
test('a screened-out session has only consent and the wrong answer: no ratings, checks, demographics or withdrawal', () => {
  const s = buildSubmission(mScreen, ctx, [trials[0], { trial_kind: 'prescreen', response: 2, rt: 4000 }]);
  expect(s.data.prescreen).toEqual({ answer: 'c', passed: false });
  expect(s.data).toMatchObject({ ratings: [], unlabeled_ratings: [], attention_expected: [], attention_answer: [], demographics: [], withdrawn: false });
});
test('the pass mark is the manifest answer, not the trial record', () => {
  const s = buildSubmission(mScreen, ctx, [trials[0], { trial_kind: 'prescreen', response: 0, rt: 1, passed: true }]);
  expect(s.data.prescreen).toEqual({ answer: 'a', passed: false });
});
test('throws when the manifest has a prescreener but the question was not answered, or the answer is out of range', () => {
  expect(() => buildSubmission(mScreen, ctx, [...trials, ...demoAnswers])).toThrow(/prescreen/);
  expect(() => buildSubmission(mScreen, ctx, [trials[0], { trial_kind: 'prescreen', response: 7, rt: 1 }])).toThrow(/prescreen/);
});
test('a passed prescreen still requires the demographic answers', () => {
  expect(() => buildSubmission(mScreen, ctx, [trials[0], { trial_kind: 'prescreen', response: 1, rt: 1 }, ...trials.slice(1)])).toThrow(/ai_use|role/);
});

// Per-artifact questions: one answer per rated artifact, carrying its artifact id.
const titled = (ps: string[]) => Object.fromEntries(ps.map((p, i) => [String(i), { path: p, title: `T${p}` }]));
const agree = { id: 'agree', question: 'Agree that {{title}}?', options: ['No', 'Maybe', 'Yes'], per_artifact: true };
const mAgree = validateManifest({ ...m, artifacts: { human: titled(['a', 'b', 'e']), ai: titled(['c', 'd', 'f']) }, demographics: [q1, agree] } as any);
const agreeTrial = (artifact_id: string, response: number) => ({ trial_kind: 'demographic', question_id: 'agree', artifact_id, response, rt: 1 });
const agreeAnswers = [agreeTrial('d_v1_ai_0', 0), agreeTrial('d_v1_human_0', 2), agreeTrial('d_v1_ai_1', 1)];   // any trial order
test('per-artifact answers carry the artifact id, one per rated artifact in the order rated, after the manifest questions before them', () => {
  const s = buildSubmission(mAgree, ctx, [...trials, { trial_kind: 'demographic', question_id: 'ai_use', response: 1, rt: 1 }, ...agreeAnswers]);
  expect(s.data.demographics).toEqual([
    { id: 'ai_use', answer: 'Weekly' },
    { id: 'agree', artifact_id: 'd_v1_human_0', answer: 'Yes' },
    { id: 'agree', artifact_id: 'd_v1_ai_1', answer: 'Maybe' },
    { id: 'agree', artifact_id: 'd_v1_ai_0', answer: 'No' },
  ]);
  expect(s.data.demographics.map((d) => d.artifact_id)).not.toContain('d_v1_human_1');   // attention artifacts are not asked about
});
test('throws if a rated artifact has no per-artifact answer, naming both', () => {
  const t = [...trials, { trial_kind: 'demographic', question_id: 'ai_use', response: 1, rt: 1 }, ...agreeAnswers.slice(0, 2)];
  expect(() => buildSubmission(mAgree, ctx, t)).toThrow(/agree.*d_v1_ai_1/);
  expect(() => buildSubmission(mAgree, ctx, [...t, agreeTrial('d_v1_ai_1', 3)])).toThrow(/agree.*d_v1_ai_1/);   // out of range
});
test('a screened-out session has no per-artifact answers either', () => {
  const mS = validateManifest({ ...mAgree, prescreener } as any);
  expect(buildSubmission(mS, ctx, [trials[0], { trial_kind: 'prescreen', response: 2, rt: 1 }]).data.demographics).toEqual([]);
});
