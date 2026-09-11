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
