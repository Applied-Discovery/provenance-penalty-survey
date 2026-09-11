import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export interface NewDomainOptions {
  name: string; artifactType: 'text' | 'image' | 'code'; stemNoun: string;
  humanVerb?: string; evaluatorClass?: 'lay' | 'expert'; labeled?: number; unlabeled?: number; attentionChecks?: number;
}

/** Default session shape for the registered 40-artifact pool: 30 labeled (15 human-labeled, 15 AI-labeled), 8 unlabeled
 * and one attention check, which also uses a pool artifact. 39 of 40, the closest fit to the registered 2:2:1 ratio. */
export const DEFAULTS = { labeled: 30, unlabeled: 8, attentionChecks: 1, evaluatorClass: 'lay' as const };
export const POOL_SIZE = 40;   // artifacts per domain, BENCHMARK.md

/**
 * Creates domains/<name>: an empty artifacts folder, a criteria stub, and a manifest with empty pools. The page is
 * shared (web/, served at domains/<name>/ by vite.config.ts), so no frontend file is written (D19). The manifest does not validate until `index-artifacts` fills the
 * pools. Returns the paths written, relative to domainsDir.
 */
export function scaffoldDomain(domainsDir: string, o: NewDomainOptions): string[] {
  if (!/^[a-z0-9_]+$/.test(o.name)) throw new Error(`name must be snake_case (got "${o.name}")`);
  if (o.name === 'example') throw new Error('"example" is the template; pick another name');
  const template = join(domainsDir, 'example'), dir = join(domainsDir, o.name);
  if (!existsSync(join(template, 'domainManifest.json'))) throw new Error(`template not found at ${template}`);
  if (existsSync(dir)) throw new Error(`${dir} already exists; refusing to overwrite`);
  const example = JSON.parse(readFileSync(join(template, 'domainManifest.json'), 'utf8')) as { protocol_version: string };

  const manifest: Record<string, unknown> = {
    name: o.name, protocol_version: example.protocol_version, domain_version: 'v0.1', wave: 1,
    artifact_type: o.artifactType, evaluator_class: o.evaluatorClass ?? DEFAULTS.evaluatorClass, stem_noun: o.stemNoun,
    ...(o.humanVerb ? { human_verb: o.humanVerb } : {}),
    attention_checks: o.attentionChecks ?? DEFAULTS.attentionChecks,
    labeled_artifacts_per_session: o.labeled ?? DEFAULTS.labeled, unlabeled_per_session: o.unlabeled ?? DEFAULTS.unlabeled,
    artifacts: { human: {}, ai: {} }, storage: 'datapipe', curation_criteria: 'curationCriteria.md',
    osf_study: 'REPLACE_WITH_DATAPIPE_EXPERIMENT_ID',
  };
  const criteria = `# Curation criteria: ${o.name}\n\nReplace with the frozen criteria for this domain's artifact pool: sources, date range,\nselection and exclusion rules, and how AI artifacts were generated. Upload with the\nmanifest and artifacts to the domain's OSF component before collection (02_design/BENCHMARK.md).\n`;

  mkdirSync(join(dir, 'artifacts'), { recursive: true });
  const written: string[] = [];
  const write = (rel: string, content: string) => { writeFileSync(join(dir, rel), content); written.push(join(o.name, rel)); };
  write('curationCriteria.md', criteria);
  write('artifacts/.gitkeep', '');
  write('domainManifest.json', JSON.stringify(manifest, null, 2) + '\n');
  return written;
}

const USAGE = `usage: npm run new-domain -- <name> --type text|image|code --noun <stem noun>
       [--verb <human verb>] [--class lay|expert] [--labeled N] [--unlabeled N] [--checks N]`;

function main(argv: string[]) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    type: { type: 'string' }, noun: { type: 'string' }, verb: { type: 'string' }, class: { type: 'string' },
    labeled: { type: 'string' }, unlabeled: { type: 'string' }, checks: { type: 'string' },
  } });
  const name = positionals[0];
  const int = (v: string | undefined) => (v === undefined ? undefined : Number.parseInt(v, 10));
  if (!name || !values.type || !values.noun) { process.stderr.write(USAGE + '\n'); process.exit(1); }
  if (!['text', 'image', 'code'].includes(values.type)) throw new Error(`--type must be text, image or code`);
  if (values.class && !['lay', 'expert'].includes(values.class)) throw new Error(`--class must be lay or expert`);
  const written = scaffoldDomain(join(process.cwd(), 'domains'), {
    name, artifactType: values.type as NewDomainOptions['artifactType'], stemNoun: values.noun, humanVerb: values.verb,
    evaluatorClass: values.class as NewDomainOptions['evaluatorClass'],
    labeled: int(values.labeled), unlabeled: int(values.unlabeled), attentionChecks: int(values.checks),
  });
  process.stdout.write(written.map((w) => `  domains/${w}`).join('\n') + '\n');
  process.stdout.write(`\nNext:\n  1. Drop artifacts into domains/${name}/artifacts named human_*.<ext> and ai_*.<ext>\n` +
    `  2. npm run index-artifacts -- domains/${name}\n  3. npm run anonymize -- domains/${name}\n` +
    `  4. Set osf_study (and completion_redirect) in domains/${name}/domainManifest.json\n` +
    `  5. Write domains/${name}/curationCriteria.md, then freeze all three on OSF\n`);
}

if (process.argv[1] && process.argv[1].endsWith('new-domain.ts')) main(process.argv.slice(2));
