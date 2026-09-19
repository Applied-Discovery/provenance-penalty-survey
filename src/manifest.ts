import { z } from 'zod';
import { CODE_EXTENSIONS, languageForPath } from './highlight';

export type Author = 'human' | 'ai';

/** The image formats every browser we target renders from a plain `<img>`. An image domain's artifacts are shown as
 * they are, so a format the browser cannot decode would leave the rater looking at the alt text - which on a labeled
 * trial is the provenance sentence. The manifest rejects anything else rather than let that reach a participant. */
export const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png'];

/** True when the path ends in one of IMAGE_EXTENSIONS, compared case-insensitively as the server serves it. */
export function isSupportedImagePath(path: string): boolean {
  const m = /\.([A-Za-z0-9]+)$/.exec(path);
  return !!m && IMAGE_EXTENSIONS.includes(m[1].toLowerCase());
}

/** Artifact paths are resolved relative to the manifest and copied to the deployed site from the domain folder,
 * so they must stay inside it: relative, no scheme, no `..` segment, no backslashes. */
export function isSafeArtifactPath(p: string): boolean {
  return p.length > 0 && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p) && !p.startsWith('/') && !p.includes('\\')
    && !p.split('/').some((seg) => seg === '..' || seg === '');
}

/** A single-choice question asked after the ratings; its answer lands in the session row as `demo_<id>`. */
const demographicQuestion = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'demographic question id must be snake_case'),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
}).strict();
export type DemographicQuestion = z.infer<typeof demographicQuestion>;

const artifactPath = z.string().refine(isSafeArtifactPath, 'artifact path must be relative to the domain folder, with no scheme, leading slash or ".."');
const httpUrl = z.string().url().refine((u) => /^https?:$/.test(new URL(u).protocol), 'must be an http(s) URL');

/** One single-choice competence question shown right after consent (registration: expertise screen for expert domains).
 * A wrong answer ends the session: a session row is written with `prescreen_passed` false and the participant is sent
 * to `redirect`, the platform's screen-out completion URL. `artifact` is shown above the question, rendered like the study artifacts. */
const prescreener = z.object({
  artifact: artifactPath,
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  answer: z.string().min(1),
  redirect: httpUrl,
}).strict().superRefine((p, ctx) => {
  if (!p.options.includes(p.answer)) ctx.addIssue({ code: 'custom', path: ['answer'], message: 'prescreener answer must be one of its options' });
});
export type Prescreener = z.infer<typeof prescreener>;

const artifactMap = z.record(z.string(), artifactPath).superRefine((obj, ctx) => {
  const rawKeys = Object.keys(obj);
  if (!rawKeys.every((k) => /^(0|[1-9]\d*)$/.test(k))) {
    ctx.addIssue({ code: 'custom', message: 'artifact keys must be exactly 0..N-1' });
    return;
  }
  const keys = rawKeys.map(Number).sort((a, b) => a - b);
  if (!keys.every((k, i) => k === i)) ctx.addIssue({ code: 'custom', message: 'artifact keys must be exactly 0..N-1' });
});

export const manifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/, 'name must be snake_case'),
  protocol_version: z.string().min(1),
  domain_version: z.string().min(1),
  wave: z.number().int().positive(),
  artifact_type: z.enum(['image', 'text', 'code']),
  evaluator_class: z.enum(['lay', 'expert']),
  stem_noun: z.string().min(1),
  human_verb: z.string().min(1).default('created'),
  expected_minutes: z.string().min(1).default('5-10'),   // shown in consent with "minutes" appended
  attention_checks: z.number().int().min(0).default(1),
  labeled_artifacts_per_session: z.number().int().positive(),
  unlabeled_per_session: z.number().int().min(0).default(1),
  avoid_pairs: z.boolean().default(false),      // never show human i and ai i in the same session
  artifacts: z.object({ human: artifactMap, ai: artifactMap }),
  demographics: z.array(demographicQuestion).default([]),   // asked after every rating, before the debrief, so the questions cannot prime the ratings
  prescreener: prescreener.optional(),
  storage: z.enum(['datapipe']).default('datapipe'),
  curation_criteria: z.string().min(1),
  completion_redirect: httpUrl.optional(),
  osf_study: z.string().min(1),                 // DataPipe experiment id
}).strict().superRefine((m, ctx) => {
  const everyArtifact = () => [...Object.values(m.artifacts.human), ...Object.values(m.artifacts.ai), ...(m.prescreener ? [m.prescreener.artifact] : [])];
  if (m.artifact_type === 'code') {   // the extension picks the highlighting grammar, so every artifact needs a known one
    const unknown = everyArtifact().filter((p) => !languageForPath(p));
    if (unknown.length) ctx.addIssue({ code: 'custom', path: ['artifacts'], message:
      `every artifact of a code domain needs a recognised extension (${CODE_EXTENSIONS.join(', ')}); not recognised: ${unknown.join(', ')}` });
  }
  if (m.artifact_type === 'image') {   // shown as-is in an <img>, so the browser has to be able to decode every one
    const unsupported = everyArtifact().filter((p) => !isSupportedImagePath(p));
    if (unsupported.length) ctx.addIssue({ code: 'custom', path: ['artifacts'], message:
      `every artifact of an image domain must be ${IMAGE_EXTENSIONS.join(', ')}; not a supported image format: ${unsupported.join(', ')}` });
  }
  if (m.labeled_artifacts_per_session % 2 !== 0)
    ctx.addIssue({ code: 'custom', message: 'labeled_artifacts_per_session must be even' });
  const human = Object.keys(m.artifacts.human).length, ai = Object.keys(m.artifacts.ai).length;
  if (human !== ai) ctx.addIssue({ code: 'custom', message: `human and ai pools must be equal in size (got ${human} and ${ai})` });
  const need = m.labeled_artifacts_per_session + m.attention_checks + m.unlabeled_per_session;
  if (m.avoid_pairs) {
    if (need > human) ctx.addIssue({ code: 'custom', message: `session needs ${need} pairs, pool has ${human}` });
  } else if (need > human + ai) ctx.addIssue({ code: 'custom', message: `session needs ${need} artifacts, pool has ${human + ai}` });
  const ids = m.demographics.map((q) => q.id), dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) ctx.addIssue({ code: 'custom', path: ['demographics'], message: `duplicate demographic question id "${dup}"` });
});

export type DomainManifest = z.infer<typeof manifestSchema>;

export class ManifestError extends Error {
  constructor(public issues: string[]) { super('Invalid domainManifest.json:\n' + issues.map((i) => '  - ' + i).join('\n')); }
}

export function validateManifest(raw: unknown): DomainManifest {
  const r = manifestSchema.safeParse(raw);
  if (!r.success) throw new ManifestError(r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  return r.data;
}

export function artifactId(m: DomainManifest, author: Author, index: number): string {
  return `${m.name}_${m.domain_version}_${author}_${index}`;
}

export function poolCounts(m: DomainManifest) {
  return { human: Object.keys(m.artifacts.human).length, ai: Object.keys(m.artifacts.ai).length };
}
