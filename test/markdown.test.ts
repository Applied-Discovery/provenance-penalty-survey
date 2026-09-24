import fc from 'fast-check';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMarkdownPath, renderMarkdown } from '../src/markdown';
import { renderArtifact, escapeHtml } from '../src/artifacts';

const mdArt = { id: 'd_v0_human_0', author: 'human' as const, index: 0, path: 'artifacts/x.md' };
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const tags = (html: string) => Array.from(dom(html).querySelectorAll('*')).map((e) => e.tagName.toLowerCase());

test('only a .md extension is Markdown, case-insensitively', () => {
  expect(isMarkdownPath('artifacts/7b1c5d95d5e45878.md')).toBe(true);
  expect(isMarkdownPath('artifacts/x.MD')).toBe(true);
  expect(isMarkdownPath('artifacts/x.txt')).toBe(false);
  expect(isMarkdownPath('artifacts/x.markdown')).toBe(false);
  expect(isMarkdownPath('artifacts/md')).toBe(false);
  expect(isMarkdownPath('artifacts/x.md.txt')).toBe(false);
});

test('a .md artifact of a text domain renders as Markdown in an .artifact-markdown block', () => {
  const src = '## Question\n\nCan I sue?\n\n## Answer\n\nYes, **usually**. It depends on _when_ you *ask*.\n';
  const html = renderArtifact({ artifact: mdArt, content: src }, 'text', 'ignored');
  expect(html).toMatch(/^<div class="artifact artifact-markdown">.*<\/div>$/s);
  expect(html).not.toContain('artifact-text');
  const d = dom(html);
  expect(Array.from(d.querySelectorAll('h2')).map((h) => h.textContent)).toEqual(['Question', 'Answer']);
  expect(d.querySelector('strong')?.textContent).toBe('usually');
  expect(Array.from(d.querySelectorAll('em')).map((e) => e.textContent)).toEqual(['when', 'ask']);
  expect(d.textContent).not.toMatch(/[#*_]/);   // no markup characters left for the rater to see
});

test('a .MD path renders as Markdown too, and a .txt artifact of the same text domain stays raw', () => {
  const src = '## Heading\n\n**bold**';
  expect(renderArtifact({ artifact: { ...mdArt, path: 'artifacts/x.MD' }, content: src }, 'text', 'x')).toContain('<h2>Heading</h2>');
  expect(renderArtifact({ artifact: { ...mdArt, path: 'artifacts/x.txt' }, content: src }, 'text', 'x'))
    .toBe(`<div class="artifact artifact-text">${escapeHtml(src)}</div>`);
});

test('Markdown applies to text domains only: a .md path in a code domain is not rendered as Markdown', () => {
  const html = renderArtifact({ artifact: mdArt, content: '## Heading' }, 'code', 'x');
  expect(html).not.toContain('<h2>');
  expect(html).not.toContain('artifact-markdown');
});

test('lists, blockquotes, a closed ATX heading and code render as their elements', () => {
  const src = '## Lack of confusion ##\n\n- one\n- two\n\n1. first\n2. second\n\n> quoted\n\nuse `x < y`\n\n    indented code\n';
  const d = dom(renderMarkdown(src));
  expect(d.querySelector('h2')?.textContent).toBe('Lack of confusion');
  expect(Array.from(d.querySelectorAll('ul > li')).map((l) => l.textContent)).toEqual(['one', 'two']);
  expect(Array.from(d.querySelectorAll('ol > li')).map((l) => l.textContent)).toEqual(['first', 'second']);
  expect(d.querySelector('blockquote')?.textContent?.trim()).toBe('quoted');
  expect(d.querySelector('p > code')?.textContent).toBe('x < y');
  expect(d.querySelector('pre > code')?.textContent).toBe('indented code\n');
});

test('raw HTML in an artifact is shown as text, never parsed', () => {
  const src = '<script>alert(1)</script>\n\nhi <img src=x onerror=alert(1)> <b>there</b>\n\n<div onclick="x()">block</div>';
  const html = renderMarkdown(src);
  expect(tags(html).filter((t) => ['script', 'img', 'b', 'div'].includes(t))).toEqual([]);
  expect(html).toContain('&lt;script&gt;');
  expect(dom(html).textContent).toContain('<img src=x onerror=alert(1)>');   // the rater sees what the author typed
});

test('links, autolinks, bare URLs and images show as their literal source: nothing clickable, nothing loaded', () => {
  const src = 'see [the post](https://law.stackexchange.com/q/1), <https://a.test>, https://b.test and ![alt](https://c.test/i.png)';
  const html = renderMarkdown(src);
  expect(tags(html)).toEqual(['p']);
  expect(dom(html).textContent?.trim()).toBe(src);
});

test('reference definitions are not swallowed: the line stays visible', () => {
  const src = 'a [follow up][1]\n\n  [1]: https://law.stackexchange.com/questions/8412';
  const d = dom(renderMarkdown(src));
  expect(d.querySelector('a')).toBeNull();
  expect(d.textContent).toContain('[follow up][1]');
  expect(d.textContent).toContain('[1]: https://law.stackexchange.com/questions/8412');
});

test('quotes and dashes reach the rater as typed: no typographic substitution', () => {
  const src = `"straight" 'single' -- --- ... (c)`;
  expect(dom(renderMarkdown(src)).textContent?.trim()).toBe(src);
});

test('single newlines join into one paragraph and blank lines split paragraphs, as on the source site', () => {
  const d = dom(renderMarkdown('one\ntwo\n\nthree'));
  expect(Array.from(d.querySelectorAll('p')).map((p) => p.textContent)).toEqual(['one\ntwo', 'three']);
  expect(d.querySelector('br')).toBeNull();
});

test('for any input, the output holds only plain formatting elements and no attribute beyond a list start or code language', () => {
  const allowed = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 's', 'ul', 'ol', 'li',
    'blockquote', 'code', 'pre', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
  const piece = fc.constantFrom('<', '>', '"', "'", '&', '[', ']', '(', ')', '!', '*', '_', '`', '#', '-', '|', ':',
    '\n', ' ', 'a', 'javascript:', 'http://x', '<script>', '<a href="x">', 'onerror=', '<img src=x>', '```', '> ', '1. ');
  fc.assert(fc.property(fc.array(piece, { maxLength: 60 }).map((a) => a.join('')), (src) => {
    const d = dom(renderMarkdown(src));
    for (const el of Array.from(d.querySelectorAll('*'))) {
      expect(allowed.has(el.tagName.toLowerCase()), el.outerHTML).toBe(true);
      for (const attr of Array.from(el.attributes)) expect(['start', 'class', 'style'].includes(attr.name), el.outerHTML).toBe(true);
      if (el.hasAttribute('style')) expect(el.getAttribute('style')).toMatch(/^text-align:(left|right|center)$/);
    }
  }), { numRuns: 500 });
});

test('the example_markdown placeholders render as Question and Answer sections with no markup left showing', () => {
  const dir = join(__dirname, '../domains/example_markdown/artifacts');
  const files = readdirSync(dir);
  expect(files.sort()).toEqual(['a0.md', 'a1.md', 'a2.md', 'a3.md', 'h0.md', 'h1.md', 'h2.md', 'h3.md']);
  for (const file of files) {
    const html = renderArtifact({ artifact: { ...mdArt, path: `artifacts/${file}` }, content: readFileSync(join(dir, file), 'utf8') }, 'text', 'x');
    const d = dom(html);
    expect(Array.from(d.querySelectorAll('h2')).slice(0, 1).map((h) => h.textContent), file).toEqual(['Question']);
    expect(Array.from(d.querySelectorAll('h2')).map((h) => h.textContent), file).toContain('Answer');
    expect(d.textContent, file).not.toMatch(/##|\*\*|(^|\s)_\w/);
  }
});
