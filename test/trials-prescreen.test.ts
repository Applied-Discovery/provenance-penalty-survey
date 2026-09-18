import { prescreenTrial, screenOutTrial } from '../src/trials/prescreen';
import { COPY } from '../src/copy';
import { REDIRECT_DELAY_MS } from '../src/trials/disclosure';

const p = { artifact: 'artifacts/prescreen.py', question: 'What is the best name for this function?',
  options: ['factorial', 'fibonacci', 'triangular_number', 'sum_of_digits'], answer: 'fibonacci', redirect: 'https://x.test/out' };
const loaded = { artifact: { id: 'prescreen', author: 'human' as const, index: 0, path: p.artifact }, content: 'def f(n):\n    return n' };

test('prescreen trial shows the intro, the highlighted artifact, the question and one button per option', () => {
  const t = prescreenTrial(p, loaded, 'code', () => {});
  expect(t.stimulus).toContain(COPY.prescreenIntro);
  expect(t.stimulus).toContain('language-python');
  expect(t.stimulus).toContain(p.question);
  expect(t.choices).toEqual(p.options);
  expect(t.data).toEqual({ trial_kind: 'prescreen' });
});
test('on finish records the chosen option and whether it is the answer, and reports the outcome', () => {
  const seen: boolean[] = [];
  const t = prescreenTrial(p, loaded, 'code', (ok) => seen.push(ok));
  const right: Record<string, unknown> = { response: 1 }, wrong: Record<string, unknown> = { response: 3 };
  t.on_finish(right); t.on_finish(wrong);
  expect(right).toMatchObject({ answer: 'fibonacci', passed: true });
  expect(wrong).toMatchObject({ answer: 'sum_of_digits', passed: false });
  expect(seen).toEqual([true, false]);
});
test('screen-out page thanks the participant and times out into the redirect', () => {
  const t = screenOutTrial();
  expect(t.stimulus).toContain(COPY.screenOutTitle);
  expect(t.choices).toBe('NO_KEYS');
  expect(t.trial_duration).toBe(REDIRECT_DELAY_MS);
  expect(t.data).toEqual({ trial_kind: 'screen_out' });
});
