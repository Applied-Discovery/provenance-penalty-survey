import { validateManifest, artifactId } from '../src/manifest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const base = {
  name: 'creative_writing', protocol_version: 'v0.1', domain_version: 'v0.1', wave: 1,
  artifact_type: 'text', evaluator_class: 'lay',
  labeled_artifacts_per_session: 2, unlabeled_per_session: 1,
  artifacts: { human: { '0': 'artifacts/a.txt', '1': 'artifacts/b.txt' }, ai: { '0': 'artifacts/c.txt', '1': 'artifacts/d.txt' } },
  stem_noun: 'poem', curation_criteria: 'curationCriteria.md', osf_study: 'abc123',
};

test('applies defaults', () => {
  const m = validateManifest(base);
  expect(m.label_noun).toBe(false);
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
  expect(validateManifest({ ...base, demographics: [q] }).demographics).toEqual([{ ...q, per_artifact: false }]);
  expect(() => validateManifest({ ...base, demographics: [{ ...q, id: 'AI use' }] })).toThrow(/snake_case/);
  expect(() => validateManifest({ ...base, demographics: [{ ...q, options: ['Only one'] }] })).toThrow(/options/);
  expect(() => validateManifest({ ...base, demographics: [{ ...q, extra: 1 }] })).toThrow(/extra/);
  expect(() => validateManifest({ ...base, demographics: [q, { ...q, question: 'Again?' }] })).toThrow(/duplicate demographic question id "ai_use"/);
});

// Per-artifact questions: asked once per seen artifact, with {{title}} filled from the artifact's manifest entry.
const titled = { human: { '0': { path: 'artifacts/a.txt', title: 'Cats' }, '1': { path: 'artifacts/b.txt', title: 'Dogs' } },
  ai: { '0': { path: 'artifacts/c.txt', title: 'Cats' }, '1': { path: 'artifacts/d.txt', title: 'Dogs' } } };
const agree = { id: 'agree', question: 'How much do you agree that {{title}}?', options: ['Disagree', 'Agree'], per_artifact: true };
test('an artifact entry is a path or { path, title }, and either way comes out as { path, title? }', () => {
  expect(validateManifest(base).artifacts.human['0']).toEqual({ path: 'artifacts/a.txt' });
  expect(validateManifest({ ...base, artifacts: titled }).artifacts.ai['1']).toEqual({ path: 'artifacts/d.txt', title: 'Dogs' });
  const mixed = { ...titled, ai: { '0': 'artifacts/c.txt', '1': { path: 'artifacts/d.txt' } } };
  expect(validateManifest({ ...base, artifacts: mixed }).artifacts.ai).toEqual({ '0': { path: 'artifacts/c.txt' }, '1': { path: 'artifacts/d.txt' } });
});
test('validating a validated manifest gives it back unchanged', () => {
  const once = validateManifest({ ...base, artifacts: titled, demographics: [agree] });
  expect(validateManifest(once)).toEqual(once);
});
test('an artifact entry object is checked: safe path, non-empty title, no other keys', () => {
  const withAi0 = (e: unknown) => ({ ...base, artifacts: { ...titled, ai: { ...titled.ai, '0': e } } });
  expect(() => validateManifest(withAi0({ path: '../x.txt', title: 'T' }))).toThrow(/artifact path/);
  expect(() => validateManifest(withAi0({ path: 'artifacts/c.txt', title: '' }))).toThrow(/title/);
  expect(() => validateManifest(withAi0({ path: 'artifacts/c.txt', title: 'T', topic: 'x' }))).toThrow(/topic/);
  expect(() => validateManifest(withAi0({ title: 'T' }))).toThrow(/path/);
});
test('per_artifact defaults to false', () => {
  const q = { id: 'ai_use', question: 'How often?', options: ['Never', 'Daily'] };
  expect(validateManifest({ ...base, demographics: [q] }).demographics[0].per_artifact).toBe(false);
});
test('a per_artifact question needs {{title}} in its text, and a plain question must not have it', () => {
  expect(validateManifest({ ...base, artifacts: titled, demographics: [agree] }).demographics[0].per_artifact).toBe(true);
  expect(() => validateManifest({ ...base, artifacts: titled, demographics: [{ ...agree, question: 'Do you agree?' }] }))
    .toThrow(/"agree".*\{\{title\}\}/);
  expect(() => validateManifest({ ...base, artifacts: titled, demographics: [{ ...agree, per_artifact: false }] }))
    .toThrow(/"agree".*per_artifact/);
});
test('a per_artifact question needs a title on every pool artifact, naming the ones without', () => {
  const missing = { ...titled, human: { ...titled.human, '1': 'artifacts/b.txt' }, ai: { ...titled.ai, '0': { path: 'artifacts/c.txt' } } };
  expect(() => validateManifest({ ...base, artifacts: missing, demographics: [agree] })).toThrow(/title.*human 1, ai 0/);
  expect(() => validateManifest({ ...base, artifacts: missing })).not.toThrow();   // titles are optional when nothing asks for them
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

test('a text domain is all .md or all not: a mixed pool is rejected, naming the odd ones out', () => {
  const md = { human: { '0': 'artifacts/a.md', '1': 'artifacts/b.MD' }, ai: { '0': 'artifacts/c.md', '1': 'artifacts/d.md' } };
  expect(() => validateManifest({ ...base, artifacts: md })).not.toThrow();
  expect(() => validateManifest(base)).not.toThrow();   // all .txt
  const mixed = { ...md, ai: { '0': 'artifacts/c.md', '1': 'artifacts/d.txt' } };
  expect(() => validateManifest({ ...base, artifacts: mixed })).toThrow(/all \.md or none; not \.md: artifacts\/d\.txt/);
  expect(() => validateManifest({ ...base, artifact_type: 'code', artifacts: { human: { '0': 'artifacts/a.py', '1': 'artifacts/b.py' },
    ai: { '0': 'artifacts/c.py', '1': 'artifacts/d.txt' } } })).not.toThrow();   // the rule is a text-domain one
});

test('label_noun must be a boolean', () => {
  expect(validateManifest({ ...base, label_noun: true }).label_noun).toBe(true);
  expect(() => validateManifest({ ...base, label_noun: 'yes' })).toThrow(/label_noun/);
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

const image = { ...base, name: 'painting', artifact_type: 'image', stem_noun: 'painting', human_verb: 'painted',
  artifacts: { human: { '0': 'artifacts/a.png', '1': 'artifacts/b.jpg' }, ai: { '0': 'artifacts/c.jpeg', '1': 'artifacts/d.PNG' } } };
test('an image domain accepts jpg, jpeg and png, whatever the case', () => {
  expect(() => validateManifest(image)).not.toThrow();
});
test('an image domain rejects a format the browser may not render, naming it', () => {
  const bad = { ...image, artifacts: { ...image.artifacts, ai: { '0': 'artifacts/c.jpeg', '1': 'artifacts/d.heic' } } };
  expect(() => validateManifest(bad)).toThrow(/not a supported image format: artifacts\/d\.heic/);
  expect(() => validateManifest(bad)).toThrow(/jpeg, jpg, png/);
  for (const ext of ['gif', 'webp', 'svg', 'tiff', 'bmp', 'avif'])
    expect(() => validateManifest({ ...image, artifacts: { ...image.artifacts, ai: { '0': 'artifacts/c.jpeg', '1': `artifacts/d.${ext}` } } })).toThrow(/supported image format/);
  expect(() => validateManifest({ ...image, artifacts: { ...image.artifacts, ai: { '0': 'artifacts/c.jpeg', '1': 'artifacts/noext' } } })).toThrow(/supported image format/);
});
test('a text domain does not care about image formats', () => {
  expect(() => validateManifest({ ...base, artifacts: { human: { '0': 'artifacts/a.heic', '1': 'artifacts/b.txt' }, ai: { '0': 'artifacts/c.txt', '1': 'artifacts/d.txt' } } })).not.toThrow();
});
test('an image domain needs a supported format on the prescreener artifact too', () => {
  const p = { ...prescreener, artifact: 'artifacts/prescreen.gif' };
  expect(() => validateManifest({ ...image, prescreener: p })).toThrow(/prescreen\.gif/);
  expect(() => validateManifest({ ...image, prescreener: { ...p, artifact: 'artifacts/prescreen.png' } })).not.toThrow();
});

// Every deployed domain folder is data, not code, so nothing else type-checks it: this is the guard that a hand-edited
// manifest, or a new rule like the image formats above, cannot ship a domain the page would refuse to start.
test('every committed domain manifest validates', () => {
  const domains = readdirSync(join(__dirname, '../domains'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  expect(domains).toContain('example_image');
  for (const d of domains) {
    const path = join(__dirname, '../domains', d, 'domainManifest.json');
    expect(() => validateManifest(JSON.parse(readFileSync(path, 'utf8'))), d).not.toThrow();
  }
});
test('every artifact a committed manifest names is on disk', () => {
  const domains = readdirSync(join(__dirname, '../domains'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const d of domains) {
    const dir = join(__dirname, '../domains', d);
    const m = validateManifest(JSON.parse(readFileSync(join(dir, 'domainManifest.json'), 'utf8')));
    for (const p of [...Object.values(m.artifacts.human), ...Object.values(m.artifacts.ai)].map((e) => e.path).concat(m.prescreener ? [m.prescreener.artifact] : []))
      expect(existsSync(join(dir, p)), `${d}/${p}`).toBe(true);
  }
});
// Attribution: optional per-artifact source credits, keyed by the same indices as the artifact maps, shown on the
// disclosure page. Keys are checked against the pools so a typo drops a credit at build time, not silently in the page.
const attributed = (attribution: unknown) => validateManifest({ ...base, attribution });
test('accepts attribution entries and leaves an absent block empty', () => {
  const m = attributed({ human: { '0': { title: 'T', title_url: 'https://x.test/t', licence: 'CC BY 4.0' } } });
  expect(m.attribution.human['0']).toMatchObject({ title: 'T' });
  expect(m.attribution.ai).toEqual({});
  expect(validateManifest(base).attribution).toEqual({ human: {}, ai: {} });
});
test('an attribution may be a list of credits, one per source; an empty list or a bad entry in it is rejected', () => {
  const two = [{ title: 'Answer', author: 'A' }, { title: 'Question', author: 'Q', licence: 'CC BY-SA 4.0' }];
  expect(attributed({ human: { '0': two } }).attribution.human['0']).toEqual(two);
  expect(() => attributed({ human: { '0': [] } })).toThrow();
  expect(() => attributed({ human: { '0': [{ title: 'T' }, {}] } })).toThrow(/at least one/);
  expect(() => attributed({ human: { '0': [{ title: 'T', title_url: 'javascript:alert(1)' }] } })).toThrow(/http\(s\)|url/);
  expect(() => attributed({ human: { '9': two } })).toThrow(/attribution.*9/);
});
test('rejects an attribution key with no artifact', () => {
  expect(() => attributed({ ai: { '7': { title: 'T' } } })).toThrow(/attribution.*7/);
});
test('rejects an unknown field in an attribution entry', () => {
  expect(() => attributed({ human: { '0': { titel: 'T' } } })).toThrow(/titel/);
});
test('rejects an empty attribution entry', () => {
  expect(() => attributed({ human: { '0': {} } })).toThrow(/at least one/);
});
test('attribution urls must be http(s), so a credit cannot carry a javascript: link', () => {
  expect(() => attributed({ human: { '0': { title: 'T', title_url: 'javascript:alert(1)' } } })).toThrow(/http\(s\)|url/);
});

const twoChecks = { ...base, attention_checks: 2, unlabeled_per_session: 0 };   // 2 labeled + 2 checks = the pool of 4
test('attention_redirect is optional and must be an http(s) URL', () => {
  expect(validateManifest(base).attention_redirect).toBeUndefined();
  expect(validateManifest({ ...twoChecks, attention_redirect: 'https://app.prolific.com/submissions/complete?cc=ATTN' }).attention_redirect).toBe('https://app.prolific.com/submissions/complete?cc=ATTN');
  expect(() => validateManifest({ ...twoChecks, attention_redirect: 'javascript:alert(1)' })).toThrow(/attention_redirect/);
});
test('attention_redirect needs at least two attention checks, since it fires only when two fail', () => {
  expect(() => validateManifest({ ...base, attention_redirect: 'https://p.test/attn' })).toThrow(/attention_redirect.*at least 2 attention checks/);
  expect(() => validateManifest({ ...base, attention_checks: 0, unlabeled_per_session: 0, attention_redirect: 'https://p.test/attn' })).toThrow(/at least 2/);
});
