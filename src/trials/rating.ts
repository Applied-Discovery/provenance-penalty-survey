import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import type { LabeledItem, AttentionItem } from '../plan';
import type { LoadedArtifact } from '../artifacts';
import { renderArtifact, escapeHtml } from '../artifacts';
import type { DomainManifest } from '../manifest';
import { COPY, RATING_CHOICES, RATING_ANCHORS, ratingStem, humanLabel, AI_LABEL } from '../copy';

export function labelSentence(m: DomainManifest, author: 'human' | 'ai'): string {
  return author === 'human' ? humanLabel(m.human_verb) : AI_LABEL;
}

/** jsPsych 8 button_html callback: the number and its verbal anchor side by side, equally prominent (D17). */
export const ratingButtonHtml = (choice: string, index: number) =>
  `<button class="jspsych-btn rating-btn"><span class="rating-n">${choice}</span><span class="rating-anchor">${RATING_ANCHORS[index]}</span></button>`;

/** One button per row, top to bottom, so the scale reads as a list on any screen width. The plugin inserts `prompt`
 * below the buttons, so the question goes into the stimulus instead and `prompt` stays null. */
export const RATING_LAYOUT = { button_layout: 'grid', grid_columns: 1, prompt: null } as const;
export const stemHtml = (m: DomainManifest) => `<p class="stem">${escapeHtml(ratingStem(m.stem_noun))}</p>`;

export function labeledRatingTrial(item: LabeledItem, loaded: LoadedArtifact, m: DomainManifest) {
  const label = labelSentence(m, item.stated_author);
  return {
    type: htmlButtonResponse,
    stimulus: `<p class="label">${escapeHtml(label)}</p>${renderArtifact(loaded, m, label)}${stemHtml(m)}`,
    choices: RATING_CHOICES,
    button_html: ratingButtonHtml,
    ...RATING_LAYOUT,
    data: { trial_kind: 'labeled', artifact_id: item.artifact.id, actual_author: item.artifact.author,
            stated_author: item.stated_author, survey_pos: item.survey_pos },
  };
}

export function attentionTrial(item: AttentionItem, loaded: LoadedArtifact, m: DomainManifest) {
  return {
    type: htmlButtonResponse,
    stimulus: `<p class="label attention">${escapeHtml(COPY.attentionInstruction(item.expected))}</p>${renderArtifact(loaded, m, 'Artifact')}${stemHtml(m)}`,
    choices: RATING_CHOICES,
    button_html: ratingButtonHtml,
    ...RATING_LAYOUT,
    data: { trial_kind: 'attention', check_index: item.check_index, expected: item.expected,
            artifact_id: item.artifact.id, actual_author: item.artifact.author },
  };
}
