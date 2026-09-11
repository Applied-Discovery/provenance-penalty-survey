import type { PlannedArtifact } from './plan';
import type { DomainManifest } from './manifest';
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
    case 'code':  return `<pre class="artifact artifact-code"><code>${escapeHtml(loaded.content)}</code></pre>`;
    case 'text':  return `<div class="artifact artifact-text">${escapeHtml(loaded.content)}</div>`;   // whitespace rules: .artifact-text in style.css
  }
}
