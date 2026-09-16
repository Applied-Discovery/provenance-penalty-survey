import { renderArtifact, loadArtifacts, escapeHtml } from '../src/artifacts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CODE_LANGUAGES, highlightCode, languageForPath } from '../src/highlight';

const art = { id: 'd_v0_human_0', author: 'human' as const, index: 0, path: 'artifacts/x.txt' };

test('escapes html in text', () => {
  expect(escapeHtml(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;');
});
test('text renders in an .artifact-text block with content escaped and whitespace intact', () => {
  const poem = 'line <1>\n    indented\n\nafter a blank line  two spaces';
  const html = renderArtifact({ artifact: art, content: poem }, 'text', 'ignored');
  expect(html).toContain('class="artifact artifact-text"');
  expect(html).toBe(`<div class="artifact artifact-text">${escapeHtml(poem)}</div>`);   // nothing trimmed or collapsed
  expect(html).toContain('line &lt;1&gt;\n    indented\n\nafter a blank line  two spaces');
});
const py = 'def add(a, b):\n    return a + b  # <sum>\n';
const pyArt = { ...art, path: 'artifacts/x.py' };
test('code is highlighted with the grammar its extension names: tokens in hljs spans, text escaped, whitespace intact', () => {
  const html = renderArtifact({ artifact: pyArt, content: py }, 'code', 'ignored');
  expect(html).toMatch(/^<pre class="artifact artifact-code"><code class="hljs language-python">.*<\/code><\/pre>$/s);
  expect(html).toContain('<span class="hljs-keyword">def</span>');
  expect(html).toContain('&lt;sum&gt;');
  expect(html).not.toContain('<sum>');
  expect(html.replace(/<\/?span[^>]*>/g, '').replace(/^<pre[^>]*><code[^>]*>/, '').replace(/<\/code><\/pre>$/, '')).toBe(escapeHtml(py));   // spans only, nothing added or dropped
});
test('the grammar follows the file name whatever the content, never auto-detected', () => {
  const js = 'const x = () => 1;';
  const asPython = renderArtifact({ artifact: pyArt, content: js }, 'code', 'ignored');
  expect(asPython).toContain('language-python');
  expect(asPython).not.toContain('language-javascript');
  expect(highlightCode(js, 'javascript')).not.toBe(highlightCode(js, 'python'));
});
test('the artifact extension picks the grammar, case-insensitively', () => {
  expect(languageForPath('artifacts/7b1c5d95d5e45878.py')).toBe('python');
  expect(languageForPath('artifacts/x.C')).toBe('c');
  expect(languageForPath('artifacts/x.ts')).toBe('typescript');
  expect(languageForPath('artifacts/x.java')).toBe('java');
  expect(languageForPath('artifacts/x.txt')).toBe('plaintext');
  expect(languageForPath('artifacts/x.cobol')).toBeUndefined();
  expect(languageForPath('artifacts/noext')).toBeUndefined();
  const html = renderArtifact({ artifact: pyArt, content: py }, 'code', 'ignored');
  expect(html).toContain('class="hljs language-python"');
  expect(html).toContain('<span class="hljs-keyword">def</span>');
});
test('a text domain is never highlighted, whatever the extension says', () => {
  const html = renderArtifact({ artifact: pyArt, content: py }, 'text', 'ignored');
  expect(html).toBe(`<div class="artifact artifact-text">${escapeHtml(py)}</div>`);
  expect(html).not.toContain('hljs');
});
test('the example_code placeholders each highlight in their own language', () => {
  const cases = { 'h0.py': ['python', 'def'], 'a1.c': ['c', 'for'], 'h2.ts': ['typescript', 'function'], 'a3.java': ['java', 'public'] };
  for (const [file, [lang, keyword]] of Object.entries(cases)) {
    const content = readFileSync(join(__dirname, '../domains/example_code/artifacts', file), 'utf8');
    const html = renderArtifact({ artifact: { ...art, path: `artifacts/${file}` }, content }, 'code', 'ignored');
    expect(html, file).toContain(`class="hljs language-${lang}"`);
    expect(html, file).toContain(`<span class="hljs-keyword">${keyword}</span>`);
    const shown = document.createElement('div'); shown.innerHTML = html;
    expect(shown.textContent, file).toBe(content);   // spans only: what the rater reads is the file, byte for byte
  }
});
test('code with an unknown extension renders unhighlighted but escaped', () => {
  expect(renderArtifact({ artifact: { ...art, path: 'artifacts/x.cobol' }, content: 'a < b' }, 'code', 'ignored')).toBe('<pre class="artifact artifact-code"><code class="hljs">a &lt; b</code></pre>');
});
test('every listed language is registered and highlights without throwing', () => {
  for (const lang of CODE_LANGUAGES) expect(() => highlightCode(py, lang)).not.toThrow();
  expect(highlightCode('x < y', 'plaintext')).toBe('x &lt; y');
});
test('image alt is the label, src is the resolved url', () => {
  const html = renderArtifact({ artifact: art, content: 'https://h.test/artifacts/x.png' }, 'image', 'This was created by a person.');
  expect(html).toContain('alt="This was created by a person."'); expect(html).toContain('src="https://h.test/artifacts/x.png"');
});
test('loadArtifacts fetches text and resolves image urls', async () => {
  const fetchFn = vi.fn(async (url: string) => new Response('poem body', { status: 200 })) as unknown as typeof fetch;
  const m = await loadArtifacts([art], 'text', 'https://h.test/domains/d/', fetchFn);
  expect(m.get(art.id)?.content).toBe('poem body');
  expect(fetchFn).toHaveBeenCalledWith('https://h.test/domains/d/artifacts/x.txt');
  const im = await loadArtifacts([art], 'image', 'https://h.test/domains/d/', fetchFn);
  expect(im.get(art.id)?.content).toBe('https://h.test/domains/d/artifacts/x.txt');
});
test('loadArtifacts throws on a failed fetch', async () => {
  const fetchFn = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
  await expect(loadArtifacts([art], 'text', 'https://h.test/', fetchFn)).rejects.toThrow(/404/);
});
