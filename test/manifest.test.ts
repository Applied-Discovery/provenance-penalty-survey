import { validateManifest, artifactId } from '../src/manifest';

const base = {
  name: 'creative_writing', protocol_version: 'v0.1', domain_version: 'v0.1', wave: 1,
  artifact_type: 'text', evaluator_class: 'lay',
  labeled_artifacts_per_session: 2, unlabeled_per_session: 1,
  artifacts: { human: { '0': 'artifacts/a.txt', '1': 'artifacts/b.txt' }, ai: { '0': 'artifacts/c.txt', '1': 'artifacts/d.txt' } },
  stem_noun: 'poem', curation_criteria: 'curationCriteria.md', osf_study: 'abc123',
};

test('applies defaults', () => {
  const m = validateManifest(base);
  expect(m.human_verb).toBe('created');
  expect(m.expected_minutes).toBe('5-10');
  expect(m.attention_checks).toBe(1);
  expect(m.unlabeled_per_session).toBe(1);
  expect(m.storage).toBe('datapipe');
});
test('requires stem_noun', () => {
  const { stem_noun, ...noNoun } = base;
  expect(() => validateManifest(noNoun)).toThrow(/stem_noun/);
});
test('rejects odd labeled count', () => {
  expect(() => validateManifest({ ...base, labeled_artifacts_per_session: 3 })).toThrow(/even/);
});
test('rejects artifact keys that are not exactly 0..N-1', () => {
  expect(() => validateManifest({ ...base, artifacts: { ...base.artifacts, ai: { '0': 'x.txt', '2': 'y.txt' } } })).toThrow(/0\.\.N-1/);
  expect(() => validateManifest({ ...base, artifacts: { ...base.artifacts, ai: { a: 'x.txt', b: 'y.txt' } } })).toThrow(/0\.\.N-1/);
});
test('rejects unequal pools', () => {
  expect(() => validateManifest({ ...base, artifacts: { ...base.artifacts, ai: { '0': 'x.txt' } } })).toThrow(/equal/);
});
test('rejects a session that needs more artifacts than the pool holds', () => {
  // 4 labeled + 1 attention + 1 unlabeled = 6 > 4
  expect(() => validateManifest({ ...base, labeled_artifacts_per_session: 4 })).toThrow(/needs 6 artifacts, pool has 4/);
});
test('requires osf_study', () => {
  const { osf_study, ...noId } = base;
  expect(() => validateManifest(noId)).toThrow(/osf_study/);
});
test('rejects unknown top-level keys', () => {
  expect(() => validateManifest({ ...base, attention_checks_per_session: 2 })).toThrow(/attention_checks_per_session/);
});
test('rejects artifact key "01"', () => {
  expect(() => validateManifest({ ...base, artifacts: { ...base.artifacts, ai: { '0': 'x.txt', '01': 'y.txt' } } })).toThrow(/0\.\.N-1/);
});
test('builds artifact ids', () => {
  expect(artifactId(validateManifest(base), 'ai', 3)).toBe('creative_writing_v0.1_ai_3');
});
test('completion_redirect must be http(s), so a manifest cannot navigate to a javascript: URL', () => {
  expect(() => validateManifest({ ...base, completion_redirect: 'javascript:alert(1)' })).toThrow(/http\(s\)/);
  expect(() => validateManifest({ ...base, completion_redirect: 'data:text/html,x' })).toThrow(/http\(s\)/);
  expect(validateManifest({ ...base, completion_redirect: 'https://app.prolific.com/submissions/complete?cc=X' }).completion_redirect).toContain('prolific');
});
test('artifact paths must stay inside the domain folder', () => {
  for (const bad of ['../secret.txt', '/etc/passwd', 'https://x.test/a.txt', 'a/../b.txt', 'a\\b.txt', ''])
    expect(() => validateManifest({ ...base, artifacts: { ...base.artifacts, ai: { '0': bad, '1': 'artifacts/d.txt' } } })).toThrow(/artifact path|min/);
  expect(validateManifest({ ...base, artifacts: { ...base.artifacts, ai: { '0': 'artifacts/sub/x.txt', '1': 'd.txt' } } })).toBeTruthy();
});
