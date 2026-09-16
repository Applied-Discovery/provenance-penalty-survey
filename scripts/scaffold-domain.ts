import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { validateManifest } from '../src/manifest';
import { checkName, curationRoot, CURATION_OPTION, domainsDir } from './curation';

export interface ScaffoldOptions {
  name: string; artifactType: 'text' | 'image' | 'code'; stemNoun: string;
  humanVerb?: string; evaluatorClass?: 'lay' | 'expert'; expectedMinutes?: string;
  labeled?: number; unlabeled?: number; attentionChecks?: number; avoidPairs?: boolean;
}

/** Default session shape for the registered 40-artifact pool: 30 labeled (15 human-labeled, 15 AI-labeled), 8 unlabeled
 * and one attention check, which also uses a pool artifact. 39 of 40, the closest fit to the registered 2:2:1 ratio. */
export const DEFAULTS = { labeled: 30, unlabeled: 8, attentionChecks: 1, evaluatorClass: 'lay' as const };
export const POOL_SIZE = 40;   // artifacts per domain, BENCHMARK.md

const collator = new Intl.Collator('en', { numeric: true });

/** The curated pool: `human_*` and `ai_*` files in <curation>/<name>/artifacts, each in natural name order. */
export function readPool(curationDir: string): { human: string[]; ai: string[] } {
  const dir = resolve(curationDir, 'artifacts');
  if (!existsSync(dir)) throw new Error(`no artifacts folder at ${dir}; run new-domain first`);
  const files = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile() && !d.name.startsWith('.')).map((d) => d.name).sort(collator.compare);
  const stray = files.filter((f) => !f.startsWith('human_') && !f.startsWith('ai_'));
  if (stray.length) throw new Error(`artifacts must be named human_* or ai_*: ${stray.join(', ')}`);
  return { human: files.filter((f) => f.startsWith('human_')), ai: files.filter((f) => f.startsWith('ai_')) };
}

/**
 * Step 2 of adding a domain: builds domains/<name>/ from the curated pool in <curationRoot>/<name>/. Writes the
 * manifest with its pools filled 0..N-1 in natural name order and copies the artifacts, still under their
 * human_ and ai_ names; `anonymize` removes the prefixes. The page is shared (web/, served at domains/<name>/ by
 * vite.config.ts), so nothing else is written (D19). Validates the manifest first and writes nothing if it would not
 * validate or if domains/<name>/ already exists. Returns the pool sizes and the paths written, relative to domainsRoot.
 */
export function scaffoldDomain(curationRootDir: string, domainsRoot: string, o: ScaffoldOptions): { human: number; ai: number; written: string[] } {
  checkName(o.name);
  const template = join(domainsRoot, 'example'), dir = join(domainsRoot, o.name);
  if (!existsSync(join(template, 'domainManifest.json'))) throw new Error(`template not found at ${template}`);
  if (existsSync(dir)) throw new Error(`${dir} already exists; delete it to scaffold again`);
  const curationDir = join(curationRootDir, o.name);
  const pool = readPool(curationDir);
  const example = JSON.parse(readFileSync(join(template, 'domainManifest.json'), 'utf8')) as { protocol_version: string };
  const index = (files: string[]) => Object.fromEntries(files.map((f, i) => [String(i), `artifacts/${f}`]));

  const manifest: Record<string, unknown> = {
    name: o.name, protocol_version: example.protocol_version, domain_version: 'v0.1', wave: 1,
    artifact_type: o.artifactType, evaluator_class: o.evaluatorClass ?? DEFAULTS.evaluatorClass, stem_noun: o.stemNoun,
    ...(o.humanVerb ? { human_verb: o.humanVerb } : {}),
    ...(o.expectedMinutes ? { expected_minutes: o.expectedMinutes } : {}),
    attention_checks: o.attentionChecks ?? DEFAULTS.attentionChecks,
    labeled_artifacts_per_session: o.labeled ?? DEFAULTS.labeled, unlabeled_per_session: o.unlabeled ?? DEFAULTS.unlabeled,
    ...(o.avoidPairs ? { avoid_pairs: true } : {}),
    artifacts: { human: index(pool.human), ai: index(pool.ai) }, storage: 'datapipe',
    curation_criteria: 'curationCriteria.md',   // kept in the curation folder and on OSF, never deployed
    osf_study: 'REPLACE_WITH_DATAPIPE_EXPERIMENT_ID',
  };
  validateManifest(manifest);   // throws ManifestError listing the problems (unequal pools, pool too small, ...)

  mkdirSync(join(dir, 'artifacts'), { recursive: true });
  const written: string[] = [];
  for (const f of [...pool.human, ...pool.ai]) {
    copyFileSync(join(curationDir, 'artifacts', f), join(dir, 'artifacts', f));
    written.push(join(o.name, 'artifacts', f));
  }
  writeFileSync(join(dir, 'domainManifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  written.push(join(o.name, 'domainManifest.json'));
  return { human: pool.human.length, ai: pool.ai.length, written };
}

const USAGE = `usage: npm run scaffold -- <name> --type text|image|code --noun <stem noun>
       [--verb <human verb>] [--class lay|expert] [--minutes <consent duration>]
       [--labeled N] [--unlabeled N] [--checks N] [--avoid-pairs] [--curation DIR]`;

function main(argv: string[]) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    ...CURATION_OPTION, type: { type: 'string' }, noun: { type: 'string' }, verb: { type: 'string' }, class: { type: 'string' },
    minutes: { type: 'string' }, labeled: { type: 'string' }, unlabeled: { type: 'string' }, checks: { type: 'string' },
    'avoid-pairs': { type: 'boolean' },
  } });
  const name = positionals[0];
  const int = (v: string | undefined) => (v === undefined ? undefined : Number.parseInt(v, 10));
  if (!name || !values.type || !values.noun) { process.stderr.write(USAGE + '\n'); process.exit(1); }
  if (!['text', 'image', 'code'].includes(values.type)) throw new Error(`--type must be text, image or code`);
  if (values.class && !['lay', 'expert'].includes(values.class)) throw new Error(`--class must be lay or expert`);
  const n = scaffoldDomain(curationRoot(values.curation), domainsDir(), {
    name, artifactType: values.type as ScaffoldOptions['artifactType'], stemNoun: values.noun, humanVerb: values.verb,
    evaluatorClass: values.class as ScaffoldOptions['evaluatorClass'], expectedMinutes: values.minutes,
    labeled: int(values.labeled), unlabeled: int(values.unlabeled), attentionChecks: int(values.checks), avoidPairs: values['avoid-pairs'],
  });
  process.stdout.write(`Scaffolded domains/${name}: ${n.human} human and ${n.ai} AI artifacts, manifest validated.\n`);
  process.stdout.write(`\nNext:\n  1. npm run anonymize -- ${name}\n` +
    `  2. Set osf_study (and completion_redirect) in domains/${name}/domainManifest.json\n` +
    `  3. Freeze the manifest, artifacts and curationCriteria.md on OSF\n`);
}

if (process.argv[1] && process.argv[1].endsWith('scaffold-domain.ts')) {
  try { main(process.argv.slice(2)); } catch (err) { process.stderr.write(`Error: ${(err as Error).message}\n`); process.exit(1); }
}
