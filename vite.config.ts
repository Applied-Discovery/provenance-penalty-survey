import { defineConfig, type Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const domainsDir = resolve(__dirname, 'domains');
const domains = existsSync(domainsDir)
  ? readdirSync(domainsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
const pagePath = (d: string) => resolve(domainsDir, d, 'index.html');
const page = () => readFileSync(resolve(__dirname, 'web/index.html'), 'utf8');

/**
 * Serves the shared page `web/index.html` at `domains/<name>/` for every domain, in dev and in the
 * build, so a domain folder holds only data (D19). Build: each `domains/<name>/index.html` is a
 * virtual entry whose source is the shared page. Dev: a middleware answers the same URLs.
 */
function domainPages(): Plugin {
  const entries = new Set(domains.map(pagePath));
  return {
    name: 'domain-pages',
    resolveId(id) { return entries.has(id) ? id : undefined; },
    load(id) { return entries.has(id) ? page() : undefined; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const m = path.match(/^\/domains\/([^/]+)\/(index\.html)?$/);
        if (!m || !domains.includes(m[1])) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml(`/domains/${m[1]}/index.html`, page(), req.originalUrl));
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: { outDir: 'dist', rollupOptions: { input: Object.fromEntries(domains.map((d) => [d, pagePath(d)])) } },
  plugins: [
    domainPages(),
    // The plugin preserves each src path under dest, so dest is the outDir root: domains/<d>/index.html ends up
    // beside domains/<d>/domainManifest.json and domains/<d>/artifacts/, matching the relative fetches at runtime.
    viteStaticCopy({
      targets: domains.flatMap((d) => [
        { src: `domains/${d}/domainManifest.json`, dest: '.' },
        { src: `domains/${d}/artifacts`, dest: '.' },
      ]),
    }),
  ],
});
