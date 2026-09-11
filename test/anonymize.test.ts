import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { anonymizePlan, validatePlan, applyPlan } from '../scripts/anonymize-artifacts';
const raw = { name: 'd', artifacts: { human: { '0': 'artifacts/human_poem_1.txt', '1': 'artifacts/human_poem_2.txt' }, ai: { '0': 'artifacts/gpt_1.txt' } } };
const SCRATCH = tmpdir();
test('renames every artifact to a random name in the same folder, keeping extension and ids', () => {
  let i = 0; const random = () => 'abcdef0123456789'.slice(0, 16 - 1) + String(i++);
  const { manifest, renames } = anonymizePlan(raw, random);
  expect(Object.keys(manifest.artifacts.human)).toEqual(['0', '1']);
  expect(manifest.artifacts.human['0']).toMatch(/^artifacts\/[0-9a-f]{15}\d\.txt$/);
  expect(renames).toHaveLength(3);
  expect(renames.map((r) => r.from)).toContain('artifacts/gpt_1.txt');
  expect(new Set(renames.map((r) => r.to)).size).toBe(3);
});
test('uses the supplied name generator', () => {
  const single = { name: 'd', artifacts: { human: {}, ai: { '0': 'artifacts/gpt_1.txt' } } };
  const once = anonymizePlan(single, () => 'ffffffffffffffff');
  expect(once.manifest.artifacts.ai['0']).toBe('artifacts/ffffffffffffffff.txt');
});
test('throws when the generator cannot produce unique names', () => {
  expect(() => anonymizePlan(raw, () => 'ffffffffffffffff')).toThrow(/unique/);
});
test('validatePlan throws before any rename when a source file is missing, and leaves existing files untouched', () => {
  const dir = mkdtempSync(join(SCRATCH, 'anon-validate-'));
  try {
    mkdirSync(join(dir, 'artifacts'));
    writeFileSync(join(dir, 'artifacts', 'human_poem_1.txt'), 'present');
    // artifacts/gpt_1.txt is intentionally never created, simulating a missing source file.
    const renames = [
      { from: 'artifacts/human_poem_1.txt', to: 'artifacts/aaaa.txt' },
      { from: 'artifacts/gpt_1.txt', to: 'artifacts/bbbb.txt' },
    ];
    expect(() => validatePlan(dir, renames)).toThrow(/gpt_1\.txt/);
    // Nothing renamed: the original file is still there under its original name.
    expect(existsSync(join(dir, 'artifacts', 'human_poem_1.txt'))).toBe(true);
    expect(existsSync(join(dir, 'artifacts', 'aaaa.txt'))).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('validatePlan throws when a destination path already exists', () => {
  const dir = mkdtempSync(join(SCRATCH, 'anon-validate-'));
  try {
    mkdirSync(join(dir, 'artifacts'));
    writeFileSync(join(dir, 'artifacts', 'human_poem_1.txt'), 'present');
    writeFileSync(join(dir, 'artifacts', 'aaaa.txt'), 'already here');
    const renames = [{ from: 'artifacts/human_poem_1.txt', to: 'artifacts/aaaa.txt' }];
    expect(() => validatePlan(dir, renames)).toThrow(/aaaa\.txt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('validatePlan does not throw when every source exists and no destination collides', () => {
  const dir = mkdtempSync(join(SCRATCH, 'anon-validate-'));
  try {
    mkdirSync(join(dir, 'artifacts'));
    writeFileSync(join(dir, 'artifacts', 'human_poem_1.txt'), 'present');
    const renames = [{ from: 'artifacts/human_poem_1.txt', to: 'artifacts/aaaa.txt' }];
    expect(() => validatePlan(dir, renames)).not.toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('applyPlan renames every file and rewrites the manifest, leaving no temp file', () => {
  const dir = mkdtempSync(join(SCRATCH, 'anon-apply-'));
  try {
    mkdirSync(join(dir, 'artifacts'));
    writeFileSync(join(dir, 'artifacts', 'a.txt'), 'A');
    writeFileSync(join(dir, 'artifacts', 'b.txt'), 'B');
    writeFileSync(join(dir, 'domainManifest.json'), '{"old":true}\n');
    const renames = [
      { from: 'artifacts/a.txt', to: 'artifacts/aaaa.txt' },
      { from: 'artifacts/b.txt', to: 'artifacts/bbbb.txt' },
    ];
    const manifest = { name: 'd', artifacts: { human: { '0': 'artifacts/aaaa.txt' }, ai: { '0': 'artifacts/bbbb.txt' } } };
    applyPlan(dir, renames, manifest);
    expect(readFileSync(join(dir, 'artifacts', 'aaaa.txt'), 'utf8')).toBe('A');
    expect(readFileSync(join(dir, 'artifacts', 'bbbb.txt'), 'utf8')).toBe('B');
    expect(existsSync(join(dir, 'artifacts', 'a.txt'))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, 'domainManifest.json'), 'utf8'))).toEqual(manifest);
    expect(readdirSync(dir).sort()).toEqual(['artifacts', 'domainManifest.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('applyPlan rolls back completed renames and leaves the manifest untouched when a later rename fails', () => {
  const dir = mkdtempSync(join(SCRATCH, 'anon-apply-'));
  try {
    mkdirSync(join(dir, 'artifacts'));
    writeFileSync(join(dir, 'artifacts', 'a.txt'), 'A');
    writeFileSync(join(dir, 'artifacts', 'b.txt'), 'B');
    writeFileSync(join(dir, 'domainManifest.json'), '{"old":true}\n');
    // Second destination's folder does not exist: validatePlan passes (source present, destination
    // absent) but renameSync throws ENOENT after the first rename has already happened.
    const renames = [
      { from: 'artifacts/a.txt', to: 'artifacts/aaaa.txt' },
      { from: 'artifacts/b.txt', to: 'missing/bbbb.txt' },
    ];
    const manifest = { name: 'd', artifacts: { human: { '0': 'artifacts/aaaa.txt' }, ai: { '0': 'missing/bbbb.txt' } } };
    expect(() => applyPlan(dir, renames, manifest)).toThrow(/ENOENT/);
    expect(readFileSync(join(dir, 'artifacts', 'a.txt'), 'utf8')).toBe('A');
    expect(readFileSync(join(dir, 'artifacts', 'b.txt'), 'utf8')).toBe('B');
    expect(existsSync(join(dir, 'artifacts', 'aaaa.txt'))).toBe(false);
    expect(readFileSync(join(dir, 'domainManifest.json'), 'utf8')).toBe('{"old":true}\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('applyPlan rolls back the renames when the manifest cannot be replaced', () => {
  const dir = mkdtempSync(join(SCRATCH, 'anon-apply-'));
  try {
    mkdirSync(join(dir, 'artifacts'));
    writeFileSync(join(dir, 'artifacts', 'a.txt'), 'A');
    // A directory where the manifest file should be: the atomic replace cannot succeed.
    mkdirSync(join(dir, 'domainManifest.json'));
    const renames = [{ from: 'artifacts/a.txt', to: 'artifacts/aaaa.txt' }];
    const manifest = { name: 'd', artifacts: { human: { '0': 'artifacts/aaaa.txt' }, ai: {} } };
    expect(() => applyPlan(dir, renames, manifest)).toThrow();
    expect(readFileSync(join(dir, 'artifacts', 'a.txt'), 'utf8')).toBe('A');
    expect(existsSync(join(dir, 'artifacts', 'aaaa.txt'))).toBe(false);
    expect(readdirSync(dir).sort()).toEqual(['artifacts', 'domainManifest.json']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
