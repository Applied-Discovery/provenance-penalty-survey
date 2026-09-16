import type { PlannedArtifact } from './plan';
import type { DomainManifest } from './manifest';
import { highlightCode, languageForPath } from './highlight';
export type ArtifactType = DomainManifest['artifact_type'];
/** What rendering needs from the manifest: the artifact type and, for code, the grammar to highlight with. */
export type RenderSpec = Pick<DomainManifest, 'artifact_type' | 'code_language'>;
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

export function renderArtifact(loaded: LoadedArtifact, spec: RenderSpec, alt: string): string {
  switch (spec.artifact_type) {
    case 'image': return `<img class="artifact artifact-image" src="${escapeHtml(loaded.content)}" alt="${escapeHtml(alt)}">`;
    case 'code': {
      // The manifest's code_language covers the whole pool; otherwise the artifact's extension picks the grammar (the manifest
      // checks every extension is known). Neither (a bare test spec) shows the code unhighlighted.
      const lang = spec.code_language ?? languageForPath(loaded.artifact.path);
      const body = lang ? highlightCode(loaded.content, lang) : escapeHtml(loaded.content);
      return `<pre class="artifact artifact-code"><code class="hljs${lang ? ` language-${lang}` : ''}">${body}</code></pre>`;
    }
    case 'text':  return `<div class="artifact artifact-text">${escapeHtml(loaded.content)}</div>`;   // whitespace rules: .artifact-text in style.css
  }
}
