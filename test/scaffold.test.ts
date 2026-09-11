// @vitest-environment node
import { mkdtempSync, rmSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { scaffoldDomain, DEFAULTS, POOL_SIZE } from '../scripts/new-domain';
import { indexArtifacts } from '../scripts/index-artifacts';
import { anonymizePlan, validatePlan } from '../scripts/anonymize-artifacts';
import { validateManifest } from '../src/manifest';

let root: string, domains: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-'));
  domains = join(root, 'domains');
  cpSync(resolve(__dirname, '../domains/example'), join(domains, 'example'), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const opts = { name: 'haiku', artifactType: 'text' as const, stemNoun: 'haiku', humanVerb: 'written' };
const manifestOf = (name: string) => JSON.parse(readFileSync(join(domains, name, 'domainManifest.json'), 'utf8'));

test('the default session fits the registered pool once the attention check has taken its artifact', () => {
  expect(DEFAULTS.labeled + DEFAULTS.unlabeled + DEFAULTS.attentionChecks).toBeLessThanOrEqual(POOL_SIZE);
  expect(DEFAULTS.labeled % 2).toBe(0);
  const pool = (author: string) => Object.fromEntries(Array.from({ length: POOL_SIZE / 2 }, (_, i) => [String(i), `artifacts/${author}_${i}.txt`]));
  expect(() => validateManifest({ ...manifestOf('example'), name: 'defaults', labeled_artifacts_per_session: DEFAULTS.labeled,
    unlabeled_per_session: DEFAULTS.unlabeled, attention_checks: DEFAULTS.attentionChecks, artifacts: { human: pool('human'), ai: pool('ai') } })).not.toThrow();
});

test('scaffold writes only data files (no page, entry or stylesheet) and a manifest with empty pools', () => {
  const written = scaffoldDomain(domains, opts);
  for (const f of ['curationCriteria.md', 'artifacts/.gitkeep', 'domainManifest.json'])
    expect(existsSync(join(domains, 'haiku', f)), f).toBe(true);
  expect(written).toHaveLength(3);
  for (const f of ['index.html', 'haiku.js', 'style.css']) expect(existsSync(join(domains, 'haiku', f)), f).toBe(false);
  expect(manifestOf('haiku')).toMatchObject({ name: 'haiku', artifact_type: 'text', stem_noun: 'haiku', human_verb: 'written',
    evaluator_class: 'lay', labeled_artifacts_per_session: DEFAULTS.labeled, unlabeled_per_session: DEFAULTS.unlabeled,
    attention_checks: 1, artifacts: { human: {}, ai: {} }, osf_study: 'REPLACE_WITH_DATAPIPE_EXPERIMENT_ID' });
  expect(manifestOf('haiku').protocol_version).toBe(manifestOf('example').protocol_version);
});
test('scaffold honours explicit session shape and class, and omits human_verb when not given', () => {
  scaffoldDomain(domains, { name: 'code_review', artifactType: 'code', stemNoun: 'function', evaluatorClass: 'expert', labeled: 10, unlabeled: 2, attentionChecks: 2 });
  expect(manifestOf('code_review')).toMatchObject({ evaluator_class: 'expert', labeled_artifacts_per_session: 10, unlabeled_per_session: 2, attention_checks: 2 });
  expect(manifestOf('code_review')).not.toHaveProperty('human_verb');
});
test('scaffold refuses a bad name, the template name, and an existing folder', () => {
  expect(() => scaffoldDomain(domains, { ...opts, name: 'Bad-Name' })).toThrow(/snake_case/);
  expect(() => scaffoldDomain(domains, { ...opts, name: 'example' })).toThrow(/template/);
  scaffoldDomain(domains, opts);
  expect(() => scaffoldDomain(domains, opts)).toThrow(/already exists/);
});

const drop = (name: string, files: string[]) => files.forEach((f) => writeFileSync(join(domains, name, 'artifacts', f), `body of ${f}`));

test('index fills the pools 0..N-1 in natural order, and the result validates and anonymizes', () => {
  scaffoldDomain(domains, { ...opts, labeled: 4, unlabeled: 2, attentionChecks: 1 });   // needs 7 of 10
  drop('haiku', ['human_10.txt', 'human_2.txt', 'human_1.txt', 'ai_1.txt', 'ai_2.txt', 'ai_3.txt', 'human_3.txt', 'human_4.txt', 'ai_4.txt', 'ai_10.txt']);
  expect(indexArtifacts(join(domains, 'haiku'))).toEqual({ human: 5, ai: 5 });
  const m = validateManifest(manifestOf('haiku'));
  expect(Object.values(m.artifacts.human)).toEqual(['artifacts/human_1.txt', 'artifacts/human_2.txt', 'artifacts/human_3.txt', 'artifacts/human_4.txt', 'artifacts/human_10.txt']);
  const { renames } = anonymizePlan(manifestOf('haiku'));
  expect(() => validatePlan(join(domains, 'haiku'), renames)).not.toThrow();
});
test('index refuses stray files and unequal pools without writing', () => {
  scaffoldDomain(domains, { ...opts, labeled: 2, unlabeled: 0, attentionChecks: 0 });
  drop('haiku', ['human_1.txt', 'ai_1.txt', 'notes.txt']);
  expect(() => indexArtifacts(join(domains, 'haiku'))).toThrow(/notes\.txt/);
  rmSync(join(domains, 'haiku', 'artifacts', 'notes.txt'));
  drop('haiku', ['human_2.txt']);
  expect(() => indexArtifacts(join(domains, 'haiku'))).toThrow(/equal in size/);
  expect(manifestOf('haiku').artifacts).toEqual({ human: {}, ai: {} });
});
