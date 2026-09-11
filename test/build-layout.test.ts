// @vitest-environment node
import { build } from 'vite';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The survey fetches ./domainManifest.json and artifact paths relative to its own index.html, so the built site must
// put them beside it. This guards the static-copy layout, which the dev-server e2e tests cannot see.
test('build places each domain manifest and artifacts beside its index.html', async () => {
  const out = mkdtempSync(join(tmpdir(), 'survey-dist-'));
  try {
    await build({ configFile: resolve(__dirname, '../vite.config.ts'), logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
    for (const f of ['index.html', 'domainManifest.json', 'artifacts/h0.txt', 'artifacts/a0.txt'])
      expect(existsSync(join(out, 'domains/example', f)), f).toBe(true);
    expect(existsSync(join(out, 'domains/example/domains'))).toBe(false);
    expect(existsSync(join(out, 'domains/example/curationCriteria.md'))).toBe(false);
  } finally { rmSync(out, { recursive: true, force: true }); }
}, 30_000);
