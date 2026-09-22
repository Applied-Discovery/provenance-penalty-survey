import type { DomainManifest, AttributionEntry } from './manifest';
import type { SessionPlan } from './plan';
import { escapeHtml } from './artifacts';
import { COPY } from './copy';

/** A credit's text, linked when the manifest gave a URL for it. Links open in a new tab: the sources sit on the
 * disclosure page, above which nothing has been submitted yet, so following one in this tab would lose the session. */
function part(text: string | undefined, url: string | undefined): string {
  if (!text && !url) return '';
  const label = escapeHtml(text ?? url!);
  return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
}

/** One credit line: title, author and licence, each dropped along with its separator when the entry has neither its
 * text nor its URL. Without a title the author leads the line, so no line ever opens with a dangling "by". */
export function creditLine(e: AttributionEntry): string {
  const title = part(e.title, e.title_url), author = part(e.author, e.author_url), licence = part(e.licence, e.licence_url);
  const named = [title, author && (title ? `by ${author}` : author)].filter(Boolean).join(' ');
  return [named, licence].filter(Boolean).join(' · ');
}

/** The sources block for the artifacts this session actually showed, in the order they were shown; empty when none of
 * them carries a credit. Pool artifacts the participant never saw are not listed: the licences owe attribution for
 * what was used, and a full-pool list would credit work this session never displayed. */
export function attributionHtml(m: DomainManifest, plan: SessionPlan): string {
  const shown = [...plan.labeled.map((it) => it.artifact), ...plan.unlabeled.map((it) => it.artifact)];
  const seen = new Set<string>();
  const lines = shown.flatMap((a) => {
    const entry = m.attribution[a.author][String(a.index)];
    if (!entry || seen.has(a.id)) return [];
    seen.add(a.id);
    return [creditLine(entry)];
  }).filter(Boolean);
  if (!lines.length) return '';
  return `<div class="attribution"><h2>${escapeHtml(COPY.attributionTitle)}</h2><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul></div>`;
}
