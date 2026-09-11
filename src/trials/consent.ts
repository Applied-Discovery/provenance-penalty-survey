import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import { COPY } from '../copy';
import { escapeHtml } from '../artifacts';
import type { DomainManifest } from '../manifest';

export function consentTrial(m: DomainManifest, platformSession: boolean) {
  const paragraphs = [...COPY.consentBody(escapeHtml(m.expected_minutes)), ...(platformSession ? [COPY.consentPlatformId] : []), COPY.consentClose];
  return {
    type: htmlButtonResponse,
    stimulus: `<div class="consent"><h1>${COPY.consentTitle}</h1>${paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>`,
    choices: [COPY.consentButton],
    data: { trial_kind: 'consent' },
  };
}
