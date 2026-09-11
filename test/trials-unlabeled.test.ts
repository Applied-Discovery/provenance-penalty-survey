import { unlabeledTitleTrial, unlabeledRatingTrial, beliefTrial } from '../src/trials/unlabeled';
import { disclosureTrial, thankYouTrial } from '../src/trials/disclosure';
import { validateManifest } from '../src/manifest';
import { COPY } from '../src/copy';

const m = validateManifest({ name: 'd', protocol_version: 'v0', domain_version: 'v0', wave: 1, artifact_type: 'image', evaluator_class: 'lay',
  stem_noun: 'painting', labeled_artifacts_per_session: 2, unlabeled_per_session: 1,
  artifacts: { human: { '0': 'a.png', '1': 'c.png' }, ai: { '0': 'b.png', '1': 'd.png' } }, curation_criteria: 'c.md', osf_study: 'x' });
const art = { id: 'd_v0_ai_0', author: 'ai' as const, index: 0, path: 'b.png' };
const item = { kind: 'unlabeled' as const, artifact: art, survey_pos: 3 };
const loaded = { artifact: art, content: 'https://h.test/b.png' };

test('title trial shows the registered statement', () => { expect(unlabeledTitleTrial().stimulus).toContain(COPY.unlabeledStatement); });
test('unlabeled rating has neutral alt text and no label', () => {
  const t = unlabeledRatingTrial(item, loaded, m);
  expect(t.stimulus).toContain('alt="Artifact"'); expect(t.stimulus).not.toMatch(/AI system|by a person/);
  expect(t.data).toEqual({ trial_kind: 'unlabeled_rating', artifact_id: art.id, actual_author: 'ai', survey_pos: 3 });
});
test('belief trial re-shows the artifact and asks the registered question', () => {
  const t = beliefTrial(item, loaded, m);
  expect(t.stimulus).toContain(COPY.beliefQuestion); expect(t.choices).toEqual(['A person', 'An AI system']);
  expect(t).toMatchObject({ button_layout: 'grid', grid_columns: 1 });   // choices stack vertically
  expect(t.data).toEqual({ trial_kind: 'belief', artifact_id: art.id, survey_pos: 3 });
});
test('disclosure has withdrawal checkbox and submit button', () => {
  const t = disclosureTrial(true);
  expect(t.html).toContain('name="withdraw"'); expect(t.button_label).toBe('Submit'); expect(t.data).toEqual({ trial_kind: 'disclosure' });
});
test('debrief promises payment only when the session id came from the platform', () => {
  expect(disclosureTrial(true).preamble).toContain('tick the box below before submitting. You will be paid either way.');
  expect(disclosureTrial(false).preamble).toContain('tick the box below before submitting.');
  expect(disclosureTrial(false).preamble).not.toContain('paid');
});
test('thank-you mentions redirect only when given', () => {
  expect(thankYouTrial('https://p.test', 'S1', () => true).stimulus()).toContain(COPY.thanksRedirect);
  expect(thankYouTrial(undefined, 'S1', () => true).stimulus()).not.toContain(COPY.thanksRedirect);
});
test('thank-you stimulus is chosen at display time from whether the submission landed', () => {
  expect(thankYouTrial(undefined, 'S1', () => true).stimulus()).toContain(COPY.thanksBody);
  const failed = thankYouTrial(undefined, 'S1', () => false).stimulus();
  expect(failed).toContain(COPY.submitFailed);
  expect(failed).toContain('S1');
});
test('thank-you page escapes the session id it shows on failure', () => {
  const html = thankYouTrial(undefined, '<img src=x onerror=alert(1)>', () => false).stimulus();
  expect(html).not.toContain('<img'); expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
});
