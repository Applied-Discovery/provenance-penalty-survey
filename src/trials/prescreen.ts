import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import htmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import type { Prescreener } from '../manifest';
import type { LoadedArtifact, ArtifactType } from '../artifacts';
import { renderArtifact, escapeHtml } from '../artifacts';
import { COPY } from '../copy';
import { RATING_LAYOUT } from './rating';
import { REDIRECT_DELAY_MS } from './disclosure';

/** The competence question from the manifest's `prescreener`, shown right after consent. `on_finish` records the
 * chosen option text and whether it is the answer on the trial record, and tells the timeline which branch to take. */
export function prescreenTrial(p: Prescreener, loaded: LoadedArtifact, type: ArtifactType, onResult: (passed: boolean) => void) {
  return {
    type: htmlButtonResponse,
    stimulus: `<p class="label prescreen">${escapeHtml(COPY.prescreenIntro)}</p>${renderArtifact(loaded, type, 'Screening item')}<p class="stem">${escapeHtml(p.question)}</p>`,
    choices: [...p.options],
    button_html: (choice: string) => `<button class="jspsych-btn">${escapeHtml(choice)}</button>`,
    ...RATING_LAYOUT,
    data: { trial_kind: 'prescreen' },
    on_finish: (data: Record<string, unknown>) => {
      const answer = p.options[Number(data.response)];
      const passed = answer === p.answer;
      data.answer = answer; data.passed = passed;
      onResult(passed);
    },
  };
}

/** Shown after a wrong answer, once the session row is saved; the timeline's on_finish then follows the screen-out redirect. */
export function screenOutTrial() {
  return {
    type: htmlKeyboardResponse,
    stimulus: `<h1>${COPY.screenOutTitle}</h1><p>${COPY.screenOutBody}</p><p>${COPY.thanksRedirect}</p>`,
    choices: 'NO_KEYS',
    trial_duration: REDIRECT_DELAY_MS,
    data: { trial_kind: 'screen_out' },
  };
}
