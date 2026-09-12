import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { checkName, curationRoot, CURATION_OPTION } from './curation';

/**
 * Step 1 of adding a domain: creates the curation folder <curationRoot>/<name>/ with a criteria stub and empty
 * artifacts/ and prompts/ folders. Nothing is written under domains/ until `scaffold` runs on the finished pool.
 * Returns the paths written, relative to curationRoot.
 */
export function newDomain(root: string, name: string): string[] {
  checkName(name);
  const dir = join(root, name);
  if (existsSync(dir)) throw new Error(`${dir} already exists; refusing to overwrite`);
  const criteria = `# Curation criteria: ${name}\n\nReplace with the frozen criteria for this domain's artifact pool: sources, date range,\nselection and exclusion rules, and how AI artifacts were generated. Freeze it with the\nmanifest and artifacts on the domain's OSF component before collection (02_design/BENCHMARK.md).\n\nPool files go in artifacts/ as human_<n>.<ext> and ai_<n>.<ext>; the prompts that produced\nthe AI artifacts go in prompts/. \`scaffold\` reads artifacts/ and \`anonymize\` writes\nartifact_map.json here.\n`;
  mkdirSync(join(dir, 'artifacts'), { recursive: true });
  mkdirSync(join(dir, 'prompts'), { recursive: true });
  const written: string[] = [];
  const write = (rel: string, content: string) => { writeFileSync(join(dir, rel), content); written.push(join(name, rel)); };
  write('curationCriteria.md', criteria);
  write('artifacts/.gitkeep', '');
  write('prompts/.gitkeep', '');
  return written;
}

const USAGE = 'usage: npm run new-domain -- <name> [--curation DIR]';

function main(argv: string[]) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: CURATION_OPTION });
  const name = positionals[0];
  if (!name) { process.stderr.write(USAGE + '\n'); process.exit(1); }
  const root = curationRoot(values.curation);
  const written = newDomain(root, name);
  process.stdout.write(written.map((w) => `  ${join(root, w)}`).join('\n') + '\n');
  process.stdout.write(`\nNext:\n  1. Curate the pool into ${join(root, name, 'artifacts')} as human_<n>.<ext> and ai_<n>.<ext>,\n` +
    `     keep the prompts in prompts/, and write curationCriteria.md\n` +
    `  2. npm run scaffold -- ${name} --type text|image|code --noun <stem noun> [--verb <human verb>] ...\n` +
    `  3. npm run anonymize -- ${name}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('new-domain.ts')) {
  try { main(process.argv.slice(2)); } catch (err) { process.stderr.write(`Error: ${(err as Error).message}\n`); process.exit(1); }
}
