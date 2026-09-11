import { buildSessionPlan, LabeledItem, AttentionItem } from '../src/plan';
import { validateManifest } from '../src/manifest';
import { Rng, hashSeed } from '../src/rng';

const pool = (n: number, p: string) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), `${p}${i}.txt`]));
const manifest = (over = {}) => validateManifest({
  name: 'd', protocol_version: 'v0', domain_version: 'v0', wave: 1, artifact_type: 'text', evaluator_class: 'lay',
  stem_noun: 'poem', labeled_artifacts_per_session: 30, unlabeled_per_session: 8, attention_checks: 2,   // 30 + 2 + 8 = 40
  artifacts: { human: pool(20, 'h'), ai: pool(20, 'a') }, curation_criteria: 'c.md', osf_study: 'x', ...over,
});
const labeled = (p: ReturnType<typeof buildSessionPlan>) => p.labeled.filter((i): i is LabeledItem => i.kind === 'labeled');
const checks = (p: ReturnType<typeof buildSessionPlan>) => p.labeled.filter((i): i is AttentionItem => i.kind === 'attention');

test('counts: 15 human actual, 15 ai actual, 15 human stated, 15 ai stated, 8 unlabeled, 2 checks', () => {
  const p = buildSessionPlan(manifest(), new Rng(1));
  const L = labeled(p);
  expect(L).toHaveLength(30);
  expect(L.filter((i) => i.artifact.author === 'human')).toHaveLength(15);
  expect(L.filter((i) => i.stated_author === 'human')).toHaveLength(15);
  expect(checks(p)).toHaveLength(2);
  expect(p.unlabeled).toHaveLength(8);
});
test('actual crossed with stated: each cell has 7 or 8', () => {
  const L = labeled(buildSessionPlan(manifest(), new Rng(2)));
  for (const a of ['human', 'ai'] as const) for (const s of ['human', 'ai'] as const) {
    const n = L.filter((i) => i.artifact.author === a && i.stated_author === s).length;
    expect(n === 7 || n === 8).toBe(true);
  }
});
test('no artifact appears twice in a session, attention artifacts included', () => {
  const p = buildSessionPlan(manifest(), new Rng(3));
  const ids = [...p.labeled.map((i) => i.artifact.id), ...p.unlabeled.map((i) => i.artifact.id)];
  expect(ids).toHaveLength(40);
  expect(new Set(ids).size).toBe(40);
});
test('survey_pos is 1..38 across both blocks, skipping attention checks', () => {
  const p = buildSessionPlan(manifest(), new Rng(4));
  const pos = [...labeled(p).map((i) => i.survey_pos), ...p.unlabeled.map((i) => i.survey_pos)];
  expect(pos).toEqual(Array.from({ length: 38 }, (_, i) => i + 1));
});
test('attention checks at fixed positions: index 0 and 16 in a 30-item section', () => {
  const p = buildSessionPlan(manifest(), new Rng(5));
  const idx = p.labeled.map((i, k) => (i.kind === 'attention' ? k : -1)).filter((k) => k >= 0);
  expect(idx).toEqual([0, 16]);           // second check inserted before labeled pos 15, after one earlier insert
  for (const c of checks(p)) { expect(c.expected).toBeGreaterThanOrEqual(1); expect(c.expected).toBeLessThanOrEqual(10); }
});
test('attention checks fall back to the other author when one pool is exhausted', () => {
  // 2 labeled (1+1) + 1 unlabeled + 1 attention = 4 = whole pool; whichever author the check prefers, it must succeed
  const small = manifest({ labeled_artifacts_per_session: 2, unlabeled_per_session: 1, attention_checks: 1, artifacts: { human: pool(2, 'h'), ai: pool(2, 'a') } });
  for (let seed = 0; seed < 20; seed++) expect(checks(buildSessionPlan(small, new Rng(seed)))).toHaveLength(1);
});
test('deterministic for a seed', () => {
  expect(buildSessionPlan(manifest(), new Rng(hashSeed('S')))).toEqual(buildSessionPlan(manifest(), new Rng(hashSeed('S'))));
});
test('unlabeled draw is balanced when even', () => {
  const p = buildSessionPlan(manifest(), new Rng(6));
  expect(p.unlabeled.filter((i) => i.artifact.author === 'human')).toHaveLength(4);
});
test('ids follow the spec format', () => {
  const p = buildSessionPlan(manifest(), new Rng(7));
  expect(labeled(p)[0].artifact.id).toMatch(/^d_v0_(human|ai)_\d+$/);
});

// Golden value. A fixed session id must map to this exact plan for the life of the protocol version: it is what
// lets a recorded session be rebuilt from its id. Labeled entries are `<artifact id>:<stated author initial>`;
// attention checks are `A<check index>:<artifact id>:<expected answer>`. If this fails, the hash, generator, or
// draw order changed, and that is a protocol version bump, not a test update.
test('golden: session id "golden-session" maps to a fixed plan', () => {
  const p = buildSessionPlan(manifest(), new Rng(hashSeed('golden-session')));
  const labeledKey = p.labeled.map((i) => i.kind === 'attention'
    ? `A${i.check_index}:${i.artifact.id}:${i.expected}` : `${i.artifact.id}:${i.stated_author[0]}`);
  expect(labeledKey).toEqual([
    'A0:d_v0_ai_13:10', 'd_v0_ai_2:a', 'd_v0_ai_4:h', 'd_v0_human_1:a', 'd_v0_human_17:h', 'd_v0_ai_12:h',
    'd_v0_ai_10:a', 'd_v0_ai_16:h', 'd_v0_human_18:a', 'd_v0_ai_9:h', 'd_v0_human_15:a', 'd_v0_ai_6:h',
    'd_v0_ai_11:a', 'd_v0_human_9:h', 'd_v0_human_5:h', 'd_v0_human_19:a', 'A1:d_v0_human_12:5', 'd_v0_ai_15:a',
    'd_v0_ai_1:h', 'd_v0_ai_3:h', 'd_v0_human_11:a', 'd_v0_human_14:h', 'd_v0_human_10:h', 'd_v0_human_6:h',
    'd_v0_human_16:h', 'd_v0_human_7:a', 'd_v0_ai_0:a', 'd_v0_human_2:a', 'd_v0_human_8:a', 'd_v0_ai_7:a',
    'd_v0_ai_18:h', 'd_v0_ai_14:a',
  ]);
  expect(p.unlabeled.map((i) => i.artifact.id)).toEqual([
    'd_v0_ai_8', 'd_v0_human_3', 'd_v0_human_4', 'd_v0_human_13', 'd_v0_ai_19', 'd_v0_human_0', 'd_v0_ai_17', 'd_v0_ai_5',
  ]);
});

// Property test: every invariant, for any valid manifest shape and any seed.
import fc from 'fast-check';
import type { Author } from '../src/manifest';
const arbManifest = fc.record({
  n: fc.integer({ min: 1, max: 15 }),          // pool per author
  perAuthor: fc.integer({ min: 1, max: 10 }),  // labeled per author
  attention: fc.integer({ min: 0, max: 3 }),
  unlabeled: fc.integer({ min: 0, max: 6 }),
}).filter(({ n, perAuthor, attention, unlabeled }) => 2 * perAuthor + attention + unlabeled <= 2 * n)
  .map(({ n, perAuthor, attention, unlabeled }) => manifest({
    labeled_artifacts_per_session: 2 * perAuthor, attention_checks: attention, unlabeled_per_session: unlabeled,
    artifacts: { human: pool(n, 'h'), ai: pool(n, 'a') },
  }));
test('property: plan invariants hold for any valid manifest and seed', () => {
  fc.assert(fc.property(arbManifest, fc.integer(), (m, seed) => {
    const p = buildSessionPlan(m, new Rng(seed));
    const L = labeled(p), C = checks(p), perAuthor = m.labeled_artifacts_per_session / 2;
    const ids = [...p.labeled.map((i) => i.artifact.id), ...p.unlabeled.map((i) => i.artifact.id)];
    const cell = (a: Author, st: Author) => L.filter((i) => i.artifact.author === a && i.stated_author === st).length;
    const slotIdx = p.labeled.map((i, k) => (i.kind === 'attention' ? k : -1)).filter((k) => k >= 0);
    const wantIdx = C.map((_, k) => Math.floor((k * L.length) / C.length) + k);   // +k for the checks inserted before it
    const pos = [...L.map((i) => i.survey_pos), ...p.unlabeled.map((i) => i.survey_pos)];
    return L.length === 2 * perAuthor
      && L.filter((i) => i.artifact.author === 'human').length === perAuthor
      && L.filter((i) => i.stated_author === 'human').length === perAuthor
      && Math.abs(cell('human', 'human') - cell('ai', 'human')) <= 1            // crossing balanced to within one
      && C.length === m.attention_checks
      && p.unlabeled.length === m.unlabeled_per_session
      && Math.abs(p.unlabeled.filter((i) => i.artifact.author === 'human').length
                - p.unlabeled.filter((i) => i.artifact.author === 'ai').length) <= 1   // unlabeled split balanced
      && new Set(ids).size === ids.length                                        // no artifact twice
      && pos.every((v, i) => v === i + 1)                                        // survey_pos contiguous from 1
      && slotIdx.every((v, k) => v === wantIdx[k])                               // fixed attention slots
      && JSON.stringify(p) === JSON.stringify(buildSessionPlan(m, new Rng(seed))); // deterministic
  }), { numRuns: 300 });
});
