import type { PlannedArtifact } from './plan';
import type { DomainManifest } from './manifest';
import { highlightCode, languageForPath } from './highlight';
import { isMarkdownPath, renderMarkdown } from './markdown';
export type ArtifactType = DomainManifest['artifact_type'];
export interface LoadedArtifact { artifact: PlannedArtifact; content: string }

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function loadArtifacts(
  items: PlannedArtifact[], type: ArtifactType, baseUrl: string, fetchFn: typeof fetch = fetch,
): Promise<Map<string, LoadedArtifact>> {
  const out = new Map<string, LoadedArtifact>();
  await Promise.all(items.map(async (artifact) => {
    const url = new URL(artifact.path, baseUrl).toString();
    if (type === 'image') { out.set(artifact.id, { artifact, content: url }); return; }
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Failed to load artifact ${artifact.id}: HTTP ${res.status}`);
    out.set(artifact.id, { artifact, content: await res.text() });
  }));
  return out;
}

export function renderArtifact(loaded: LoadedArtifact, type: ArtifactType, alt: string): string {
  switch (type) {
    case 'image': return `<img class="artifact artifact-image" src="${escapeHtml(loaded.content)}" alt="${escapeHtml(alt)}">`;
    case 'code': {
      // The artifact's extension picks the grammar; the manifest checks every extension of a code domain is known, so an
      // unknown one (a bare test spec) only ever shows the code unhighlighted.
      const lang = languageForPath(loaded.artifact.path);
      const body = lang ? highlightCode(loaded.content, lang) : escapeHtml(loaded.content);
      return `<pre class="artifact artifact-code"><code class="hljs${lang ? ` language-${lang}` : ''}">${body}</code></pre>`;
    }
    case 'text':   // a .md artifact is rendered as Markdown; anything else keeps its whitespace (.artifact-text in style.css)
      return isMarkdownPath(loaded.artifact.path)
        ? `<div class="artifact artifact-markdown">${renderMarkdown(loaded.content)}</div>`
        : `<div class="artifact artifact-text">${escapeHtml(loaded.content)}</div>`;
  }
}
