import { renderArtifact, loadArtifacts, escapeHtml } from '../src/artifacts';
import { CODE_LANGUAGES, highlightCode, isCodeLanguage } from '../src/highlight';

const art = { id: 'd_v0_human_0', author: 'human' as const, index: 0, path: 'artifacts/x.txt' };

test('escapes html in text', () => {
  expect(escapeHtml(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;');
});
test('text renders in an .artifact-text block with content escaped and whitespace intact', () => {
  const poem = 'line <1>\n    indented\n\nafter a blank line  two spaces';
  const html = renderArtifact({ artifact: art, content: poem }, { artifact_type: 'text' }, 'ignored');
  expect(html).toContain('class="artifact artifact-text"');
  expect(html).toBe(`<div class="artifact artifact-text">${escapeHtml(poem)}</div>`);   // nothing trimmed or collapsed
  expect(html).toContain('line &lt;1&gt;\n    indented\n\nafter a blank line  two spaces');
});
const py = 'def add(a, b):\n    return a + b  # <sum>\n';
test('code is highlighted with the manifest language: tokens in hljs spans, text escaped, whitespace intact', () => {
  const html = renderArtifact({ artifact: art, content: py }, { artifact_type: 'code', code_language: 'python' }, 'ignored');
  expect(html).toMatch(/^<pre class="artifact artifact-code"><code class="hljs language-python">.*<\/code><\/pre>$/s);
  expect(html).toContain('<span class="hljs-keyword">def</span>');
  expect(html).toContain('&lt;sum&gt;');
  expect(html).not.toContain('<sum>');
  expect(html.replace(/<\/?span[^>]*>/g, '').replace(/^<pre[^>]*><code[^>]*>/, '').replace(/<\/code><\/pre>$/, '')).toBe(escapeHtml(py));   // spans only, nothing added or dropped
});
test('the same grammar is applied whatever the content, never auto-detected', () => {
  const js = 'const x = () => 1;';
  const asPython = renderArtifact({ artifact: art, content: js }, { artifact_type: 'code', code_language: 'python' }, 'ignored');
  expect(asPython).toContain('language-python');
  expect(asPython).not.toContain('language-javascript');
  expect(highlightCode(js, 'javascript')).not.toBe(highlightCode(js, 'python'));
});
test('code without a language renders unhighlighted but escaped', () => {
  expect(renderArtifact({ artifact: art, content: 'a < b' }, { artifact_type: 'code' }, 'ignored')).toBe('<pre class="artifact artifact-code"><code class="hljs">a &lt; b</code></pre>');
});
test('every listed language is registered and highlights without throwing', () => {
  for (const lang of CODE_LANGUAGES) { expect(isCodeLanguage(lang)).toBe(true); expect(() => highlightCode(py, lang)).not.toThrow(); }
  expect(isCodeLanguage('cobol')).toBe(false);
  expect(highlightCode('x < y', 'plaintext')).toBe('x &lt; y');
});
test('image alt is the label, src is the resolved url', () => {
  const html = renderArtifact({ artifact: art, content: 'https://h.test/artifacts/x.png' }, { artifact_type: 'image' }, 'This was created by a person.');
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
