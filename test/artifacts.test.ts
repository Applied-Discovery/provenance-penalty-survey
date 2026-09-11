import { renderArtifact, loadArtifacts, escapeHtml } from '../src/artifacts';

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
test('code renders in pre/code', () => {
  expect(renderArtifact({ artifact: art, content: 'x' }, 'code', 'ignored')).toMatch(/<pre class="artifact artifact-code"><code>x<\/code><\/pre>/);
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
