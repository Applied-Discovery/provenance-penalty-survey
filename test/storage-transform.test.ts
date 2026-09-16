import { toSessionRow, toLabeledRows, toUnlabeledRows, median } from '../src/storage/transform';
import { writeRows, storeSubmission } from '../src/storage/writeRows';
import { validateManifest } from '../src/manifest';
import type { Submission } from '../src/submission';
import type { Sink } from '../src/storage/types';

const m = validateManifest({ name: 'd', protocol_version: 'v0', domain_version: 'v1', wave: 1, artifact_type: 'text', evaluator_class: 'lay',
  stem_noun: 'poem', labeled_artifacts_per_session: 2, unlabeled_per_session: 1,
  artifacts: { human: { '0': 'a', '1': 'b' }, ai: { '0': 'c', '1': 'd' } }, curation_criteria: 'c.md', osf_study: 'x' });
const sub: Submission = {
  domain: 'd', submission_time: 'T2', start_time: 'T1', session_id: 'S', study_id: 'ST', protocol_version: 'v0', domain_version: 'v1',
  evaluator_type: 'human', evaluator_class: 'lay', wave: 1,
  data: { attention_expected: [7, 3], attention_answer: [7, 5], withdrawn: false,
    ratings: [{ id: 'a', actual_author: 'human', stated_author: 'ai', survey_pos: 1, rating: 5, time_spent: 5000 },
              { id: 'b', actual_author: 'ai', stated_author: 'human', survey_pos: 2, rating: 9, time_spent: 6000 }],
    unlabeled_ratings: [{ id: 'c', actual_author: 'ai', predicted_author: 'ai', survey_pos: 3, rating: 3, rating_time_spent: 4000, belief_time_spent: 1500 }],
    demographics: [] },
};
const meta = { browser: 'UA', jspsych_version: '8.0.0', viewport_width: 1200, viewport_height: 800 };

test('median', () => { expect(median([])).toBeNull(); expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5); });
test('session row has run columns, manifest data, stats, and metadata', () => {
  expect(toSessionRow(sub, meta, m)).toEqual({
    domain: 'd', session_id: 'S', study_id: 'ST', start_time: 'T1', submission_time: 'T2', protocol_version: 'v0', domain_version: 'v1',
    evaluator_type: 'human', evaluator_class: 'lay', wave: 1,
    artifact_type: 'text', stem_noun: 'poem', human_verb: 'created', attention_checks: 1, labeled_artifacts_per_session: 2, unlabeled_per_session: 1, pool_size: 4,
    withdrawn: false,
    attention_expected: '7;3', attention_answer: '7;5', attention_passed: false,
    n_labeled: 2, n_unlabeled: 1, avg_rating: 17 / 3, min_time_spent: 4000, median_time_spent: 5000,
    browser: 'UA', jspsych_version: '8.0.0', viewport_width: 1200, viewport_height: 800,
  });
});
test('session row ends with one demo_<id> column per demographic answer', () => {
  const withDemo = { ...sub, data: { ...sub.data, demographics: [{ id: 'ai_use', answer: 'Daily' }, { id: 'role', answer: 'Student' }] } };
  const row = toSessionRow(withDemo, meta, m);
  expect(Object.keys(row).slice(-2)).toEqual(['demo_ai_use', 'demo_role']);
  expect(row).toMatchObject({ demo_ai_use: 'Daily', demo_role: 'Student' });
  expect(toLabeledRows(withDemo)[0]).not.toHaveProperty('demo_ai_use');   // answers live in the session row only
});
test('labeled rows: one per labeled rating', () => {
  const rows = toLabeledRows(sub);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toEqual({ domain: 'd', session_id: 'S', start_time: 'T1', protocol_version: 'v0', domain_version: 'v1', evaluator_type: 'human', evaluator_class: 'lay', wave: 1,
    artifact_id: 'a', actual_author: 'human', stated_author: 'ai', survey_pos: 1, rating: 5, time_spent: 5000 });
});
test('unlabeled rows: one per unlabeled rating, with belief', () => {
  expect(toUnlabeledRows(sub)).toEqual([{ domain: 'd', session_id: 'S', start_time: 'T1', protocol_version: 'v0', domain_version: 'v1', evaluator_type: 'human', evaluator_class: 'lay', wave: 1,
    artifact_id: 'c', actual_author: 'ai', predicted_author: 'ai', survey_pos: 3, rating: 3, rating_time_spent: 4000, belief_time_spent: 1500 }]);
});
const mockSink = (): Sink => ({ writeSessionRows: vi.fn(async () => {}), writeLabeledResponseRows: vi.fn(async () => {}),
  writeUnlabeledResponseRows: vi.fn(async () => {}), flush: vi.fn(async () => {}) });
test('writeRows dispatches on destination', async () => {
  const sink = mockSink();
  await writeRows([{ a: 1 }], 'session', sink); await writeRows([{ b: 2 }, { b: 3 }], 'labeled_response', sink); await writeRows([{ c: 4 }], 'unlabeled_response', sink);
  expect(sink.writeSessionRows).toHaveBeenCalledWith([{ a: 1 }]);
  expect(sink.writeLabeledResponseRows).toHaveBeenCalledWith([{ b: 2 }, { b: 3 }]);
  expect(sink.writeUnlabeledResponseRows).toHaveBeenCalledWith([{ c: 4 }]);
});
test('storeSubmission writes session, labeled rows, unlabeled rows, then flushes', async () => {
  const calls: string[] = [];
  const sink: Sink = { writeSessionRows: async (r) => { calls.push(`s${r.length}`); }, writeLabeledResponseRows: async (r) => { calls.push(`l${r.length}`); },
    writeUnlabeledResponseRows: async (r) => { calls.push(`u${r.length}`); }, flush: async () => { calls.push('f'); } };
  await storeSubmission(sub, meta, m, sink);
  expect(calls).toEqual(['s1', 'l2', 'u1', 'f']);
});
