import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import type { UnlabeledItem } from '../plan';
import type { LoadedArtifact } from '../artifacts';
import { renderArtifact } from '../artifacts';
import type { DomainManifest } from '../manifest';
import { COPY, RATING_CHOICES } from '../copy';
import { ratingButtonHtml, RATING_LAYOUT, stemHtml } from './rating';

const NEUTRAL_ALT = 'Artifact';

export function unlabeledTitleTrial() {
  return { type: htmlButtonResponse, stimulus: `<h2>${COPY.unlabeledStatement}</h2>`, choices: [COPY.continueButton], data: { trial_kind: 'unlabeled_title' } };
}

export function unlabeledRatingTrial(item: UnlabeledItem, loaded: LoadedArtifact, m: DomainManifest) {
  return {
    type: htmlButtonResponse,
    stimulus: renderArtifact(loaded, m.artifact_type, NEUTRAL_ALT) + stemHtml(m),
    choices: RATING_CHOICES,
    button_html: ratingButtonHtml,
    ...RATING_LAYOUT,
    data: { trial_kind: 'unlabeled_rating', artifact_id: item.artifact.id, actual_author: item.artifact.author, survey_pos: item.survey_pos },
  };
}

export function beliefTrial(item: UnlabeledItem, loaded: LoadedArtifact, m: DomainManifest) {
  return {
    type: htmlButtonResponse,
    stimulus: `${renderArtifact(loaded, m.artifact_type, NEUTRAL_ALT)}<p class="stem">${COPY.beliefQuestion}</p>`,
    choices: [...COPY.beliefChoices],
    ...RATING_LAYOUT,   // one choice per row, stacked like the rating scale
    data: { trial_kind: 'belief', artifact_id: item.artifact.id, survey_pos: item.survey_pos },
  };
}
