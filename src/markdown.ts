import MarkdownIt from 'markdown-it';

// Markdown for `.md` artifacts of a text domain. Raw HTML is escaped rather than passed through, and links, images
// and reference definitions are off, so an artifact can neither send the rater off the page nor load anything, and
// nothing in the file is silently dropped: a link or a `[1]: url` line shows as its literal source. Typographer is off
// so quotes and dashes reach the rater exactly as the author typed them.
const md = new MarkdownIt('default', { html: false, linkify: false, typographer: false })
  .disable(['link', 'image', 'autolink', 'reference']);

/** True for a `.md` file, compared case-insensitively as the server serves it. */
export function isMarkdownPath(path: string): boolean {
  return /\.md$/i.test(path);
}

export function renderMarkdown(src: string): string {
  return md.render(src);
}
