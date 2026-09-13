import surveyHtmlForm from '@jspsych/plugin-survey-html-form';
import htmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import { COPY } from '../copy';
import { escapeHtml } from '../artifacts';

export function disclosureTrial(platformSession: boolean) {
  const paragraphs = [...COPY.debriefBody];
  if (platformSession) paragraphs[paragraphs.length - 1] += ` ${COPY.debriefPaid}`;
  return {
    type: surveyHtmlForm,
    preamble: `<div class="debrief"><h1>${COPY.debriefTitle}</h1>${paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>`,
    html: `<p><label><input type="checkbox" name="withdraw"> ${COPY.withdrawLabel}</label></p>`,
    button_label: COPY.submitButton,
    data: { trial_kind: 'disclosure' },
  };
}

/** Replaces the blank screen jsPsych shows during the async submit trial. `#jspsych-content` is the display
 * element jsPsych mounts and clears between trials; absent (a bare test DOM) nothing is rendered. */
export function showSavingPage(doc: Document = document): void {
  const el = doc.getElementById('jspsych-content');
  if (el) el.innerHTML = `<div class="saving"><div class="spinner" aria-hidden="true"></div><h1>${COPY.savingTitle}</h1><p>${COPY.savingBody}</p></div>`;
}

/** With a redirect the page shows for REDIRECT_DELAY_MS and then the timeline's on_finish navigates; without one it stays up. */
export const REDIRECT_DELAY_MS = 3000;

export function thankYouTrial(redirect: string | undefined, sessionId: string, submitted: () => boolean) {
  return {
    type: htmlKeyboardResponse,
    stimulus: () => `<h1>${COPY.thanksTitle}</h1><p>${submitted() ? COPY.thanksBody : COPY.submitFailed + escapeHtml(sessionId)}</p>${redirect ? `<p>${COPY.thanksRedirect}</p>` : ''}`,
    choices: 'NO_KEYS',
    trial_duration: redirect ? REDIRECT_DELAY_MS : null,
    data: { trial_kind: 'thanks' },
  };
}
