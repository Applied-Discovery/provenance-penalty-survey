import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package root (the folder holding package.json and domains/). Resolved on demand: only the CLIs need it. */
export const pkgRoot = () => fileURLToPath(new URL('..', import.meta.url));
export const domainsDir = () => resolve(pkgRoot(), 'domains');

/**
 * Where curation folders live: the private study repo, checked out beside this one, unless `--curation DIR` or
 * `CURATION_DIR` says otherwise. A curation folder `<root>/<name>/` holds curationCriteria.md, the pre-anonymisation
 * artifacts (`artifacts/human_*.<ext>`, `artifacts/ai_*.<ext>`), the prompts that produced the AI artifacts
 * (`prompts/`) and, after `anonymize`, `artifact_map.json`. None of it is deployed; only the manifest and the
 * anonymised artifacts under domains/<name>/ are.
 */
const defaultCurationRoot = () => resolve(pkgRoot(), '..', 'provenance-penalty', '03_run', 'curation');
export const CURATION_OPTION = { curation: { type: 'string' as const } };

export function curationRoot(flag?: string): string {
  const root = resolve(flag ?? process.env.CURATION_DIR ?? defaultCurationRoot());
  if (!existsSync(root)) throw new Error(`curation root not found: ${root} (pass --curation DIR or set CURATION_DIR)`);
  return root;
}

export function checkName(name: string): void {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`name must be snake_case (got "${name}")`);
  if (name === 'example') throw new Error('"example" is the template; pick another name');
}
