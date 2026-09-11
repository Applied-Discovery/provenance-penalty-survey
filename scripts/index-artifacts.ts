import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateManifest } from '../src/manifest';

const collator = new Intl.Collator('en', { numeric: true });

/**
 * Fills the manifest's artifact pools from the files in <domain>/artifacts: `human_*` files become the human pool and
 * `ai_*` files the AI pool, each indexed 0..N-1 in natural name order. Run before `anonymize`, which removes the
 * prefixes. Validates the result before writing and throws, without writing, if it would not validate.
 */
export function indexArtifacts(domainDir: string): { human: number; ai: number } {
  const manifestPath = resolve(domainDir, 'domainManifest.json');
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  const files = readdirSync(resolve(domainDir, 'artifacts'), { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.')).map((d) => d.name).sort(collator.compare);
  const pool = (prefix: string) => Object.fromEntries(files.filter((f) => f.startsWith(prefix)).map((f, i) => [String(i), `artifacts/${f}`]));
  const human = pool('human_'), ai = pool('ai_');
  const stray = files.filter((f) => !f.startsWith('human_') && !f.startsWith('ai_'));
  if (stray.length) throw new Error(`artifacts must be named human_* or ai_* (already anonymized? index before anonymize): ${stray.join(', ')}`);
  const manifest = { ...raw, artifacts: { human, ai } };
  validateManifest(manifest);   // throws ManifestError listing the problems (unequal pools, pool too small, ...)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { human: Object.keys(human).length, ai: Object.keys(ai).length };
}

if (process.argv[1] && process.argv[1].endsWith('index-artifacts.ts')) {
  const dir = process.argv[2];
  if (!dir) { process.stderr.write('usage: npm run index-artifacts -- domains/<name>\n'); process.exit(1); }
  const n = indexArtifacts(dir);
  process.stdout.write(`Indexed ${n.human} human and ${n.ai} AI artifacts into ${join(dir, 'domainManifest.json')}\n`);
}
