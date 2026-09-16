import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import type { DemographicQuestion } from '../manifest';
import { escapeHtml } from '../artifacts';
import { RATING_LAYOUT } from './rating';

/** One single-choice question from the manifest's `demographics`, shown after the last rating so that domains
 * asking different questions stay comparable on the ratings themselves. The answer is stored as the option text. */
export function demographicTrial(q: DemographicQuestion) {
  return {
    type: htmlButtonResponse,
    stimulus: `<p class="stem demographic">${escapeHtml(q.question)}</p>`,
    choices: [...q.options],
    button_html: (choice: string) => `<button class="jspsych-btn">${escapeHtml(choice)}</button>`,
    ...RATING_LAYOUT,   // one option per row, stacked like the rating scale
    data: { trial_kind: 'demographic', question_id: q.id },
  };
}
