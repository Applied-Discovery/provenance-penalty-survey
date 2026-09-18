// @vitest-environment node
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simulateExport, SESSION } from '../scripts/simulate-export';

const parse = (csv: string) => {
  const [head, ...lines] = csv.trim().split('\n');
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
};

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'export-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('writes one DataPipe-named file set per submission, with the live column layout and the planted roles', async () => {
  const [truth] = await simulateExport(dir, ['creative_writing'], 20, 1);   // indices 16..19 take the four roles
  expect(truth).toMatchObject({ domain: 'creative_writing', penalty: 0.7, evaluator_class: 'lay', sessions: 20, kept: 17,
    incomplete: 1, duplicate: 1, withdrawn: 1, attention_failed: 1 });
  const files = readdirSync(dir);
  const of = (prefix: string) => files.filter((f) => f.startsWith(prefix + '_'));
  expect(of('session')).toHaveLength(21);      // 20 sessions plus the redo
  expect(of('labeled')).toHaveLength(21);
  expect(of('unlabeled')).toHaveLength(20);    // the half-landed session has none
  expect(files.filter((f) => f.startsWith('session_creative_writing-0017_'))).toHaveLength(2);
  expect(files.filter((f) => f.startsWith('unlabeled_creative_writing-0016_'))).toHaveLength(0);
  expect(files).toEqual(expect.arrayContaining(['truth_domains.csv', 'truth_params.csv']));

  const session = parse(readFileSync(join(dir, of('session').find((f) => f.includes('-0000_'))!), 'utf8'))[0];
  expect(Object.keys(session)).toEqual(['domain', 'session_id', 'study_id', 'start_time', 'submission_time', 'protocol_version', 'domain_version',
    'evaluator_type', 'evaluator_class', 'wave', 'artifact_type', 'stem_noun', 'human_verb', 'attention_checks', 'labeled_artifacts_per_session',
    'unlabeled_per_session', 'pool_size', 'withdrawn', 'attention_expected', 'attention_answer', 'attention_passed', 'n_labeled', 'n_unlabeled',
    'avg_rating', 'min_time_spent', 'median_time_spent', 'browser', 'jspsych_version', 'viewport_width', 'viewport_height']);
  expect(session).toMatchObject({ attention_passed: 'true', withdrawn: 'false', n_labeled: String(SESSION.labeled), n_unlabeled: String(SESSION.unlabeled) });
  const failed = parse(readFileSync(join(dir, of('session').find((f) => f.includes('-0019_'))!), 'utf8'))[0];
  expect(failed.attention_passed).toBe('false');
  const withdrawn = parse(readFileSync(join(dir, of('session').find((f) => f.includes('-0018_'))!), 'utf8'))[0];
  expect(withdrawn.withdrawn).toBe('true');

  const labeled = parse(readFileSync(join(dir, of('labeled').find((f) => f.includes('-0000_'))!), 'utf8'));
  expect(labeled).toHaveLength(SESSION.labeled);
  expect(Object.keys(labeled[0])).toEqual(['domain', 'session_id', 'start_time', 'protocol_version', 'domain_version', 'evaluator_type', 'evaluator_class', 'wave',
    'artifact_id', 'actual_author', 'stated_author', 'survey_pos', 'rating', 'time_spent']);
  expect(labeled.filter((r) => r.stated_author === 'human')).toHaveLength(SESSION.labeled / 2);
  expect(labeled.every((r) => Number(r.rating) >= 1 && Number(r.rating) <= 10 && Number(r.time_spent) > 0)).toBe(true);
  const unlabeled = parse(readFileSync(join(dir, of('unlabeled').find((f) => f.includes('-0000_'))!), 'utf8'));
  expect(unlabeled).toHaveLength(SESSION.unlabeled);
  expect(Object.keys(unlabeled[0])).toEqual(['domain', 'session_id', 'start_time', 'protocol_version', 'domain_version', 'evaluator_type', 'evaluator_class', 'wave',
    'artifact_id', 'actual_author', 'predicted_author', 'survey_pos', 'rating', 'rating_time_spent', 'belief_time_spent']);
  expect(unlabeled.map((r) => Number(r.survey_pos))).toEqual(Array.from({ length: SESSION.unlabeled }, (_, i) => SESSION.labeled + i + 1));
});

test('the same seed reproduces the same files', async () => {
  const other = mkdtempSync(join(tmpdir(), 'export-'));
  try {
    await simulateExport(dir, ['code'], 3, 7); await simulateExport(other, ['code'], 3, 7);
    for (const f of readdirSync(dir)) expect(readFileSync(join(other, f), 'utf8')).toBe(readFileSync(join(dir, f), 'utf8'));
  } finally { rmSync(other, { recursive: true, force: true }); }
});

test('expert domains screen: index 15 is screened out with a session file only, the rest pass and carry the prescreen columns', async () => {
  const [truth] = await simulateExport(dir, ['code'], 20, 1);
  expect(truth).toMatchObject({ domain: 'code', evaluator_class: 'expert', sessions: 20, kept: 16, screened_out: 1, incomplete: 1, duplicate: 1, withdrawn: 1, attention_failed: 1 });
  const files = readdirSync(dir);
  expect(files.filter((f) => f.includes('-0015_')).map((f) => f.split('_')[0])).toEqual(['session']);
  const out = parse(readFileSync(join(dir, files.find((f) => f.startsWith('session_code-0015_'))!), 'utf8'))[0];
  expect(out).toMatchObject({ prescreen_passed: 'false', n_labeled: '0', n_unlabeled: '0', attention_passed: 'true', withdrawn: 'false', avg_rating: '' });
  const clean = parse(readFileSync(join(dir, files.find((f) => f.startsWith('session_code-0000_'))!), 'utf8'))[0];
  expect(clean).toMatchObject({ prescreen_passed: 'true', prescreen_answer: 'b', n_labeled: String(SESSION.labeled) });
  expect(Object.keys(clean).slice(-3)).toEqual(['viewport_height', 'prescreen_answer', 'prescreen_passed']);
});
test('lay domains do not screen: index 15 is a clean session and the truth counts no screen-outs', async () => {
  const [truth] = await simulateExport(dir, ['creative_writing'], 20, 1);
  expect(truth).toMatchObject({ kept: 17, screened_out: 0 });
  expect(readdirSync(dir).filter((f) => f.includes('-0015_'))).toHaveLength(3);
});
