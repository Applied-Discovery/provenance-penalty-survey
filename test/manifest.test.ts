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
test('avoid_pairs defaults to false', () => {
  expect(validateManifest(base).avoid_pairs).toBe(false);
});
test('with avoid_pairs the session may draw at most one artifact per pair', () => {
  // 2 labeled + 1 attention + 1 unlabeled = 4 > 2 pairs
  expect(() => validateManifest({ ...base, avoid_pairs: true })).toThrow(/needs 4 pairs, pool has 2/);
  expect(validateManifest({ ...base, avoid_pairs: true, attention_checks: 0, unlabeled_per_session: 0 }).avoid_pairs).toBe(true);
});
test('demographics default to none', () => {
  expect(validateManifest(base).demographics).toEqual([]);
});
test('demographics: single-choice questions with snake_case ids, at least two options, ids unique', () => {
  const q = { id: 'ai_use', question: 'How often do you use AI coding assistants?', options: ['Never', 'Monthly', 'Weekly', 'Daily'] };
  expect(validateManifest({ ...base, demographics: [q] }).demographics).toEqual([q]);
  expect(() => validateManifest({ ...base, demographics: [{ ...q, id: 'AI use' }] })).toThrow(/snake_case/);
  expect(() => validateManifest({ ...base, demographics: [{ ...q, options: ['Only one'] }] })).toThrow(/options/);
  expect(() => validateManifest({ ...base, demographics: [{ ...q, extra: 1 }] })).toThrow(/extra/);
  expect(() => validateManifest({ ...base, demographics: [q, { ...q, question: 'Again?' }] })).toThrow(/duplicate demographic question id "ai_use"/);
});
const code = { ...base, name: 'code', artifact_type: 'code', stem_noun: 'function',
  artifacts: { human: { '0': 'artifacts/a.py', '1': 'artifacts/b.c' }, ai: { '0': 'artifacts/c.ts', '1': 'artifacts/d.java' } } };
test('a code domain accepts a mixed-language pool and rejects an artifact whose extension is unknown, naming it', () => {
  expect(() => validateManifest(code)).not.toThrow();
  expect(() => validateManifest({ ...code, code_language: 'python' })).toThrow(/code_language/);   // no such field: the extension decides
  const bad = { ...code, artifacts: { ...code.artifacts, ai: { '0': 'artifacts/c.ts', '1': 'artifacts/d.cobol' } } };
  expect(() => validateManifest(bad)).toThrow(/not recognised: artifacts\/d\.cobol/);
  expect(() => validateManifest({ ...base, artifacts: bad.artifacts })).not.toThrow();   // a text domain does not care about extensions
});

const prescreener = { artifact: 'artifacts/prescreen.py', question: 'What is the best name for this function?',
  options: ['factorial', 'fibonacci', 'triangular_number', 'sum_of_digits'], answer: 'fibonacci',
  redirect: 'https://app.prolific.com/submissions/complete?cc=SCREENOUT' };
const codeBase = { ...base, artifact_type: 'code', artifacts: { human: { '0': 'artifacts/a.py', '1': 'artifacts/b.py' }, ai: { '0': 'artifacts/c.py', '1': 'artifacts/d.py' } } };
test('prescreener is optional and kept as given', () => {
  expect(validateManifest(base).prescreener).toBeUndefined();
  expect(validateManifest({ ...codeBase, prescreener }).prescreener).toEqual(prescreener);
});
test('prescreener answer must be one of its options', () => {
  expect(() => validateManifest({ ...codeBase, prescreener: { ...prescreener, answer: 'fourier_series' } })).toThrow(/answer/);
});
test('prescreener redirect must be an http(s) URL and the artifact path safe', () => {
  expect(() => validateManifest({ ...codeBase, prescreener: { ...prescreener, redirect: 'javascript:alert(1)' } })).toThrow(/redirect/);
  expect(() => validateManifest({ ...codeBase, prescreener: { ...prescreener, artifact: '../secret.py' } })).toThrow(/artifact/);
});
test('a code domain needs a recognised extension on the prescreener artifact too', () => {
  expect(() => validateManifest({ ...codeBase, prescreener: { ...prescreener, artifact: 'artifacts/prescreen.xyz' } })).toThrow(/prescreen\.xyz/);
});

test('attention_redirect is optional and must be an http(s) URL', () => {
  expect(validateManifest(base).attention_redirect).toBeUndefined();
  expect(validateManifest({ ...base, attention_redirect: 'https://app.prolific.com/submissions/complete?cc=ATTN' }).attention_redirect).toBe('https://app.prolific.com/submissions/complete?cc=ATTN');
  expect(() => validateManifest({ ...base, attention_redirect: 'javascript:alert(1)' })).toThrow(/attention_redirect/);
});
