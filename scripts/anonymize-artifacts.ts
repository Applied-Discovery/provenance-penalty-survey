import { readFileSync, writeFileSync, renameSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve, dirname, extname, join } from 'node:path';

export interface RawManifest { artifacts: { human: Record<string, string>; ai: Record<string, string> }; [k: string]: unknown }

export function anonymizePlan(manifest: RawManifest, random: () => string = () => randomBytes(8).toString('hex')) {
  const renames: { from: string; to: string }[] = [];
  const used = new Set<string>();
  const out: RawManifest = { ...manifest, artifacts: { human: {}, ai: {} } };
  for (const author of ['human', 'ai'] as const) {
    for (const [id, from] of Object.entries(manifest.artifacts[author])) {
      let to: string;
      let attempts = 0;
      do {
        if (attempts >= 1000) {
          throw new Error(
            `Could not generate a unique artifact name after 1000 attempts (author=${author}, id=${id}, from=${from})`,
          );
        }
        to = join(dirname(from), random() + extname(from)).replace(/\\/g, '/');
        attempts += 1;
      } while (used.has(to));
      used.add(to);
      out.artifacts[author][id] = to;
      renames.push({ from, to });
    }
  }
  return { manifest: out, renames };
}

/** Throws, listing every offending path, unless every rename's source exists and its
 * destination does not. Never touches the filesystem beyond existsSync checks. */
export function validatePlan(domainDir: string, renames: { from: string; to: string }[]): void {
  const missing = renames.filter((r) => !existsSync(resolve(domainDir, r.from))).map((r) => r.from);
  const collisions = renames.filter((r) => existsSync(resolve(domainDir, r.to))).map((r) => r.to);
  if (missing.length === 0 && collisions.length === 0) return;
  const parts: string[] = [];
  if (missing.length) parts.push(`source file(s) missing: ${missing.join(', ')}`);
  if (collisions.length) parts.push(`destination(s) already exist: ${collisions.join(', ')}`);
  throw new Error(`Refusing to rename artifacts - ${parts.join('; ')}`);
}

/** Applies the plan all-or-nothing: renames every artifact, then replaces domainManifest.json
 * via a temp file and rename. If any step fails, every completed rename is undone and the
 * original error is rethrown, so the domain folder is either fully anonymised or unchanged.
 * Should the rollback itself fail, the residual state is written to stderr before rethrowing. */
export function applyPlan(domainDir: string, renames: { from: string; to: string }[], manifest: RawManifest): void {
  validatePlan(domainDir, renames);
  const manifestPath = resolve(domainDir, 'domainManifest.json');
  const tmpPath = manifestPath + '.tmp';
  const done: { from: string; to: string }[] = [];
  try {
    for (const r of renames) {
      renameSync(resolve(domainDir, r.from), resolve(domainDir, r.to));
      done.push(r);
    }
    writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + '\n');
    renameSync(tmpPath, manifestPath);
  } catch (err) {
    rmSync(tmpPath, { force: true });
    const stuck: { from: string; to: string }[] = [];
    for (const r of done.reverse()) {
      try {
        renameSync(resolve(domainDir, r.to), resolve(domainDir, r.from));
      } catch {
        stuck.push(r);
      }
    }
    if (stuck.length) {
      process.stderr.write(
        `Rollback failed for ${stuck.length} of ${done.length} renamed artifacts; ` +
          `these still carry their new names and domainManifest.json was NOT rewritten.\n`,
      );
      process.stderr.write(JSON.stringify(stuck, null, 2) + '\n');
    }
    throw err;
  }
}

/** Where the rename map is saved: beside the prompts that produced the AI artifacts, so each anonymised file can be
 * traced back to its prompt. The build copies only the manifest and artifacts/, so prompts/ is never deployed. */
export const MAP_FILE = 'prompts/artifact_map.json';

function main(domainDir: string) {
  const manifestPath = resolve(domainDir, 'domainManifest.json');
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as RawManifest;
  const { manifest, renames } = anonymizePlan(raw);
  applyPlan(domainDir, renames, manifest);
  const mapPath = resolve(domainDir, MAP_FILE);
  mkdirSync(dirname(mapPath), { recursive: true });
  const map = JSON.stringify(renames, null, 2) + '\n';
  writeFileSync(mapPath, map);
  process.stdout.write(map);
  process.stderr.write(`Renamed ${renames.length} artifacts. Map saved to ${join(domainDir, MAP_FILE)} (not deployed).\n`);
}

if (process.argv[1] && process.argv[1].endsWith('anonymize-artifacts.ts')) {
  const dir = process.argv[2];
  if (!dir) { process.stderr.write('usage: npm run anonymize -- domains/<name>\n'); process.exit(1); }
  main(dir);
}
