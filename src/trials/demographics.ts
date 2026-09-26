import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import { TITLE_PLACEHOLDER, type DemographicQuestion } from '../manifest';
import type { PlannedArtifact } from '../plan';
import { escapeHtml } from '../artifacts';
import { COPY } from '../copy';
import { RATING_LAYOUT } from './rating';

/** Title page separating the ratings from the demographic questions; only built when the manifest asks any. */
export function demographicsTitleTrial() {
  return { type: htmlButtonResponse, stimulus: `<h2>${COPY.demographicsStatement}</h2>`, choices: [COPY.continueButton], data: { trial_kind: 'demographics_title' } };
}

/** One single-choice question from the manifest's `demographics`, shown after the last rating so that domains
 * asking different questions stay comparable on the ratings themselves. The answer is stored as the option text.
 * A per-artifact question is built once per rated artifact, `artifact` naming it: its title fills TITLE_PLACEHOLDER
 * (escaped, like the rest of the text) and its id goes on the trial record. */
export function demographicTrial(q: DemographicQuestion, artifact?: PlannedArtifact) {
  const text = artifact ? escapeHtml(q.question).split(TITLE_PLACEHOLDER).join(escapeHtml(artifact.title ?? '')) : escapeHtml(q.question);
  return {
    type: htmlButtonResponse,
    stimulus: `<p class="stem demographic">${text}</p>`,
    choices: [...q.options],
    button_html: (choice: string) => `<button class="jspsych-btn">${escapeHtml(choice)}</button>`,
    ...RATING_LAYOUT,   // one option per row, stacked like the rating scale
    data: { trial_kind: 'demographic', question_id: q.id, ...(artifact ? { artifact_id: artifact.id } : {}) },
  };
}

/** Every demographic trial, in manifest order: a plain question once, a per-artifact one for each artifact the
 * participant rated, labeled then unlabeled in the order shown. Attention-check artifacts are not asked about. */
export function demographicTrials(questions: DemographicQuestion[], rated: PlannedArtifact[]) {
  return questions.flatMap((q) => (q.per_artifact ? rated.map((a) => demographicTrial(q, a)) : [demographicTrial(q)]));
}
