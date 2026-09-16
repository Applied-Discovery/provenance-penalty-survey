// @vitest-environment node
import { mkdtempSync, rmSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { newDomain } from '../scripts/new-domain';
import { scaffoldDomain, DEFAULTS, POOL_SIZE } from '../scripts/scaffold-domain';
import { anonymizeDomain, MAP_FILE } from '../scripts/anonymize-artifacts';
import { validateManifest } from '../src/manifest';

let root: string, curation: string, domains: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-'));
  curation = join(root, 'curation');
  domains = join(root, 'domains');
  cpSync(resolve(__dirname, '../domains/example'), join(domains, 'example'), { recursive: true });
  newDomain(curation, 'haiku');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const opts = { name: 'haiku', artifactType: 'text' as const, stemNoun: 'haiku', humanVerb: 'written' };
const manifestOf = (name: string) => JSON.parse(readFileSync(join(domains, name, 'domainManifest.json'), 'utf8'));
const curate = (name: string, files: string[]) => files.forEach((f) => writeFileSync(join(curation, name, 'artifacts', f), `body of ${f}`));
const tenOfEach = ['human_10.txt', 'human_2.txt', 'human_1.txt', 'ai_1.txt', 'ai_2.txt', 'ai_3.txt', 'human_3.txt', 'human_4.txt', 'ai_4.txt', 'ai_10.txt'];

test('the default session fits the registered pool once the attention check has taken its artifact', () => {
  expect(DEFAULTS.labeled + DEFAULTS.unlabeled + DEFAULTS.attentionChecks).toBeLessThanOrEqual(POOL_SIZE);
  expect(DEFAULTS.labeled % 2).toBe(0);
  const pool = (author: string) => Object.fromEntries(Array.from({ length: POOL_SIZE / 2 }, (_, i) => [String(i), `artifacts/${author}_${i}.txt`]));
  expect(() => validateManifest({ ...manifestOf('example'), name: 'defaults', labeled_artifacts_per_session: DEFAULTS.labeled,
    unlabeled_per_session: DEFAULTS.unlabeled, attention_checks: DEFAULTS.attentionChecks, artifacts: { human: pool('human'), ai: pool('ai') } })).not.toThrow();
});

test('new-domain writes a criteria stub and empty artifacts/ and prompts/ folders, and nothing under domains/', () => {
  for (const f of ['curationCriteria.md', 'artifacts/.gitkeep', 'prompts/.gitkeep']) expect(existsSync(join(curation, 'haiku', f)), f).toBe(true);
  expect(existsSync(join(domains, 'haiku'))).toBe(false);
});
test('new-domain refuses a bad name, the template name, and an existing folder', () => {
  expect(() => newDomain(curation, 'Bad-Name')).toThrow(/snake_case/);
  expect(() => newDomain(curation, 'example')).toThrow(/template/);
  expect(() => newDomain(curation, 'haiku')).toThrow(/already exists/);
});

test('scaffold copies the pool and writes a manifest whose pools run 0..N-1 in natural order', () => {
  curate('haiku', tenOfEach);
  const n = scaffoldDomain(curation, domains, { ...opts, labeled: 4, unlabeled: 2, attentionChecks: 1 });   // needs 7 of 10
  expect(n).toMatchObject({ human: 5, ai: 5 });
  expect(n.written).toHaveLength(11);
  const m = validateManifest(manifestOf('haiku'));
  expect(Object.values(m.artifacts.human)).toEqual(['artifacts/human_1.txt', 'artifacts/human_2.txt', 'artifacts/human_3.txt', 'artifacts/human_4.txt', 'artifacts/human_10.txt']);
  expect(readFileSync(join(domains, 'haiku', 'artifacts', 'ai_10.txt'), 'utf8')).toBe('body of ai_10.txt');
  expect(manifestOf('haiku')).toMatchObject({ name: 'haiku', artifact_type: 'text', stem_noun: 'haiku', human_verb: 'written',
    evaluator_class: 'lay', attention_checks: 1, osf_study: 'REPLACE_WITH_DATAPIPE_EXPERIMENT_ID' });
  expect(manifestOf('haiku').protocol_version).toBe(manifestOf('example').protocol_version);
  for (const f of ['index.html', 'haiku.js', 'style.css', 'curationCriteria.md']) expect(existsSync(join(domains, 'haiku', f)), f).toBe(false);
});
test('scaffold honours explicit session shape, class and minutes, and omits human_verb when not given', () => {
  newDomain(curation, 'code_review');
  curate('code_review', ['human_1.py', 'human_2.py', 'ai_1.py', 'ai_2.py']);
  scaffoldDomain(curation, domains, { name: 'code_review', artifactType: 'code', codeLanguage: 'python', stemNoun: 'function', evaluatorClass: 'expert', expectedMinutes: '10', labeled: 2, unlabeled: 1, attentionChecks: 0 });
  expect(manifestOf('code_review')).toMatchObject({ artifact_type: 'code', code_language: 'python', evaluator_class: 'expert', expected_minutes: '10', labeled_artifacts_per_session: 2, unlabeled_per_session: 1, attention_checks: 0 });
  expect(manifestOf('code_review')).not.toHaveProperty('human_verb');
});
test('scaffold accepts a code domain without a language when every extension is known, and refuses one that is not', () => {
  newDomain(curation, 'code_mixed');
  curate('code_mixed', ['human_1.py', 'human_2.c', 'ai_1.py', 'ai_2.c']);
  scaffoldDomain(curation, domains, { name: 'code_mixed', artifactType: 'code', stemNoun: 'function', labeled: 2, unlabeled: 1, attentionChecks: 0 });
  expect(manifestOf('code_mixed')).not.toHaveProperty('code_language');
  newDomain(curation, 'code_nolang');
  curate('code_nolang', ['human_1.cobol', 'ai_1.cobol']);
  expect(() => scaffoldDomain(curation, domains, { name: 'code_nolang', artifactType: 'code', stemNoun: 'function', labeled: 0, unlabeled: 1, attentionChecks: 0 })).toThrow(/not recognised/);
  expect(existsSync(join(domains, 'code_nolang'))).toBe(false);
  curate('haiku', tenOfEach);
  expect(() => scaffoldDomain(curation, domains, { ...opts, codeLanguage: 'python', labeled: 2 })).toThrow(/only when artifact_type is code/);
  expect(existsSync(join(domains, 'haiku'))).toBe(false);
});
test('scaffold refuses stray files, unequal pools and an existing target without writing', () => {
  curate('haiku', ['human_1.txt', 'ai_1.txt', 'notes.txt']);
  const shape = { ...opts, labeled: 2, unlabeled: 0, attentionChecks: 0 };
  expect(() => scaffoldDomain(curation, domains, shape)).toThrow(/notes\.txt/);
  rmSync(join(curation, 'haiku', 'artifacts', 'notes.txt'));
  curate('haiku', ['human_2.txt']);
  expect(() => scaffoldDomain(curation, domains, shape)).toThrow(/equal in size/);
  expect(existsSync(join(domains, 'haiku'))).toBe(false);
  curate('haiku', ['ai_2.txt']);
  scaffoldDomain(curation, domains, shape);
  expect(() => scaffoldDomain(curation, domains, shape)).toThrow(/already exists/);
  expect(() => scaffoldDomain(curation, domains, { ...shape, name: 'nowhere' })).toThrow(/run new-domain/);
});

test('anonymize renames the scaffolded artifacts, saves the map in the curation folder, and refuses to run twice', () => {
  curate('haiku', tenOfEach);
  scaffoldDomain(curation, domains, { ...opts, labeled: 4, unlabeled: 2, attentionChecks: 1 });
  const renames = anonymizeDomain(join(domains, 'haiku'), join(curation, 'haiku'));
  expect(renames).toHaveLength(10);
  const names = readdirSync(join(domains, 'haiku', 'artifacts'));
  expect(names.every((f) => /^[0-9a-f]{16}\.txt$/.test(f))).toBe(true);
  const m = validateManifest(manifestOf('haiku'));
  expect(new Set(Object.values(m.artifacts.human).concat(Object.values(m.artifacts.ai)))).toEqual(new Set(names.map((f) => `artifacts/${f}`)));
  const map = JSON.parse(readFileSync(join(curation, 'haiku', MAP_FILE), 'utf8'));
  expect(map).toEqual(renames);
  expect(readFileSync(join(domains, 'haiku', map.find((r: { from: string }) => r.from === 'artifacts/ai_10.txt').to), 'utf8')).toBe('body of ai_10.txt');
  expect(existsSync(join(domains, 'haiku', MAP_FILE))).toBe(false);
  expect(() => anonymizeDomain(join(domains, 'haiku'), join(curation, 'haiku'))).toThrow(/already exists/);
  rmSync(join(curation, 'haiku', MAP_FILE));
  expect(() => anonymizeDomain(join(domains, 'haiku'), join(curation, 'haiku'))).toThrow(/already anonymised/);
});
test('scaffold writes avoid_pairs when asked and checks the session fits the pairs', () => {
  curate('haiku', tenOfEach);   // 5 pairs
  scaffoldDomain(curation, domains, { ...opts, labeled: 2, unlabeled: 2, attentionChecks: 1, avoidPairs: true });   // 5 of 5 pairs
  expect(manifestOf('haiku')).toMatchObject({ avoid_pairs: true });
  newDomain(curation, 'haiku2'); curate('haiku2', tenOfEach);
  expect(() => scaffoldDomain(curation, domains, { ...opts, name: 'haiku2', labeled: 4, unlabeled: 2, attentionChecks: 1, avoidPairs: true })).toThrow(/needs 7 pairs, pool has 5/);
});
test('scaffold omits avoid_pairs when not asked', () => {
  curate('haiku', tenOfEach);
  scaffoldDomain(curation, domains, { ...opts, labeled: 2, unlabeled: 0, attentionChecks: 0 });
  expect(manifestOf('haiku')).not.toHaveProperty('avoid_pairs');
});
