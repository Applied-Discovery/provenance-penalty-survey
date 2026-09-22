import { test, expect } from '@playwright/test';
import { EXAMPLE, interceptDataPipe, patchManifest, runSession, file } from './helpers';

const happy = { attentionCorrect: true, withdraw: false, labeledRating: 4, unlabeledRating: 6 };

test('full session stores one session row, one labeled table and one unlabeled table', async ({ page }) => {
  const dp = await interceptDataPipe(page);
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-1&STUDY_ID=ST1`);
  const clicked = await runSession(page, happy);
  const stamp = file(dp.posts, 'session_')[0].start_time.replace(/[:.]/g, '_');

  expect(clicked).toMatchObject({ labeled: 2, unlabeled: 1, beliefs: 1 });
  expect(clicked.attention).toHaveLength(1);
  expect(dp.posts.map((p) => p.filename).sort()).toEqual([`labeled_e2e-1_${stamp}.csv`, `session_e2e-1_${stamp}.csv`, `unlabeled_e2e-1_${stamp}.csv`]);
  expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}_\d{2}_\d{2}_\d{3}Z$/);           // session start time, file-safe

  const [session] = file(dp.posts, 'session_');
  expect(session).toMatchObject({ session_id: 'e2e-1', study_id: 'ST1', domain: 'example', attention_passed: 'true', withdrawn: 'false',
    n_labeled: '2', n_unlabeled: '1', evaluator_type: 'human', evaluator_class: 'lay' });
  expect(session.attention_expected).toBe(String(clicked.attention[0].expected));
  expect(session.browser).toContain('Mozilla');
  expect(Number(session.min_time_spent)).toBeGreaterThan(0);

  const labeled = file(dp.posts, 'labeled_');
  expect(labeled.map((r) => r.survey_pos)).toEqual(['1', '2']);
  expect(labeled.every((r) => r.rating === '4' && Number(r.time_spent) > 0)).toBe(true);
  expect(labeled.map((r) => r.stated_author).sort()).toEqual(['ai', 'human']);   // half each
  expect(labeled.map((r) => r.actual_author).sort()).toEqual(['ai', 'human']);   // even split

  const unlabeled = file(dp.posts, 'unlabeled_');
  expect(unlabeled).toHaveLength(1);
  expect(unlabeled[0]).toMatchObject({ survey_pos: '3', rating: '6', predicted_author: 'human' });
  expect(Number(unlabeled[0].belief_time_spent)).toBeGreaterThan(0);

  const ids = [...labeled, ...unlabeled].map((r) => r.artifact_id);
  expect(new Set(ids).size).toBe(3);                                             // no artifact twice
  expect(JSON.stringify(dp.posts)).not.toMatch(/PROLIFIC|user_id/);              // no participant identifier anywhere
});

test('demographic questions from the manifest are asked after the ratings and land in the session row', async ({ page }) => {
  const dp = await interceptDataPipe(page);
  await patchManifest(page, { demographics: [
    { id: 'ai_use', question: 'How often do you use AI coding assistants?', options: ['Never', 'Weekly', 'Daily'] },
    { id: 'role', question: 'What best describes you?', options: ['Student', 'Professional'] },
  ] });
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-demo`);
  const clicked = await runSession(page, { ...happy, demographicOption: 1 });
  expect(clicked).toMatchObject({ labeled: 2, unlabeled: 1, beliefs: 1, demographics: ['Weekly', 'Professional'] });
  const [session] = file(dp.posts, 'session_');
  expect(session).toMatchObject({ demo_ai_use: 'Weekly', demo_role: 'Professional' });
  expect(Object.keys(session).slice(-2)).toEqual(['demo_ai_use', 'demo_role']);
  expect(file(dp.posts, 'labeled_')[0]).not.toHaveProperty('demo_ai_use');
});

test('failed attention check and withdrawal are recorded', async ({ page }) => {
  const dp = await interceptDataPipe(page);
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-2`);
  const clicked = await runSession(page, { ...happy, attentionCorrect: false, withdraw: true });
  const [session] = file(dp.posts, 'session_');
  expect(session.attention_passed).toBe('false');
  expect(session.withdrawn).toBe('true');
  expect(session.attention_answer).toBe(String(clicked.attention[0].picked));
  expect(session.attention_answer).not.toBe(session.attention_expected);
});

test('submission is retried once after a failed write, without duplicating files', async ({ page }) => {
  const dp = await interceptDataPipe(page, 1);
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-3`);
  await runSession(page, happy);
  expect(dp.calls()).toBe(4);                                                    // 1 failure + 3 files
  expect(dp.posts.map((p) => p.filename.replace(/_\d{4}-.*\.csv$/, '')).sort()).toEqual(['labeled_e2e-3', 'session_e2e-3', 'unlabeled_e2e-3']);
});

test('a saving page with a spinner shows while the files are in flight, and the three posts run concurrently', async ({ page }) => {
  const started: number[] = []; let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route('https://pipe.jspsych.org/api/data/', async (route) => {
    started.push(Date.now()); await gate;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-spin`);
  const session = runSession(page, happy);
  await expect(page.getByRole('heading', { name: 'Saving your responses' })).toBeVisible();
  await expect(page.locator('.spinner')).toBeVisible();
  await expect.poll(() => started.length).toBe(3);                              // all three requests open before any answer
  release();
  await session;
  await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
});

test('the same SESSION_ID reproduces the same artifact order and labels', async ({ page }) => {
  const a = await interceptDataPipe(page);
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-4`); await runSession(page, happy);
  const first = file(a.posts, 'labeled_').map((r) => `${r.artifact_id}:${r.stated_author}`);
  await page.unroute('https://pipe.jspsych.org/api/data/');
  const b = await interceptDataPipe(page);
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-4`); await runSession(page, happy);
  expect(file(b.posts, 'labeled_').map((r) => `${r.artifact_id}:${r.stated_author}`)).toEqual(first);
  expect(b.posts[0].filename).not.toBe(a.posts[0].filename);                    // a redo gets its own files
});

test('redirects to completion_redirect after the thank-you page', async ({ page }) => {
  await interceptDataPipe(page);
  await page.route('**/prolific-done*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>done</h1>' }));
  await patchManifest(page, { completion_redirect: 'http://localhost:5173/prolific-done?cc=ABC' });
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-5`);
  await runSession(page, happy);
  await page.waitForURL(/prolific-done\?cc=ABC/, { timeout: 10_000 });
});

test('a manifest that fails validation shows the failure page, not a survey', async ({ page }) => {
  await interceptDataPipe(page);
  await patchManifest(page, { labeled_artifacts_per_session: 3 });
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-6`);
  await expect(page.getByText('could not be started')).toBeVisible();
});

test('creative writing keeps its line breaks and indentation on screen', async ({ page }) => {
  await interceptDataPipe(page);
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-ws&STUDY_ID=ST1`);
  await page.getByRole('button', { name: 'I agree' }).click();
  const text = page.locator('.artifact-text').first();
  await expect(text).toBeVisible();
  expect(await text.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
  const shown = await text.innerText();          // innerText honours white-space, so this is what the rater sees
  expect(shown).toMatch(/\n\n/);                 // blank line between title and stanza survives
  expect(shown).toMatch(/\n {4}\S/);             // every example poem indents lines 4 and 6 by four spaces
});

test('a code domain highlights each artifact by its file extension, inside a scrolling box', async ({ page }) => {
  await interceptDataPipe(page);
  const seen = new Set<string>();
  for (const id of ['e2e-code-1', 'e2e-code-2', 'e2e-code-3']) {   // several sessions, so all four languages of example_code come up
    await page.goto(`/domains/example_code/?SESSION_ID=${id}`);
    await page.getByRole('button', { name: 'I agree' }).click();
    await page.getByRole('button', { name: 'fibonacci' }).click();  // example_code screens; the item is the recursive Fibonacci function
    for (let i = 0; i < 4; i++) {                                    // attention check + 2 labeled + 1 unlabeled
      const code = page.locator('pre.artifact-code code.hljs');
      await expect(code).toBeVisible();
      const lang = (await code.getAttribute('class'))!.match(/language-(\S+)/)![1];
      seen.add(lang);
      await expect(code.locator('span.hljs-keyword').first()).toBeVisible();
      const keywordColor = await code.locator('span.hljs-keyword').first().evaluate((el) => getComputedStyle(el).color);
      expect(keywordColor).not.toBe(await code.evaluate((el) => getComputedStyle(el).color));   // the theme stylesheet is loaded
      expect(await code.evaluate((el) => getComputedStyle(el.parentElement!).overflowX)).toBe('auto');
      const next = page.locator('button.rating-btn').first();
      if (await page.getByText('attention check').isVisible()) await page.locator('button.rating-btn').nth(2).click(); else await next.click();
      if (await page.getByRole('button', { name: 'Continue' }).isVisible()) await page.getByRole('button', { name: 'Continue' }).click();
      if (await page.getByRole('button', { name: 'A person' }).isVisible()) await page.getByRole('button', { name: 'A person' }).click();
    }
  }
  expect([...seen].sort()).toEqual(['c', 'java', 'python', 'typescript']);
});

// Expertise screen (manifest `prescreener`): the example's h0.txt stands in for the screening item.
const prescreener = { artifact: 'artifacts/h0.txt', question: 'Which word describes the item above?', options: ['wrong', 'right', 'other'], answer: 'right',
  redirect: 'https://app.prolific.com/submissions/complete?cc=SCREENOUT' };

test('a right prescreen answer continues into the study and lands in the session row', async ({ page }) => {
  const dp = await interceptDataPipe(page);
  await patchManifest(page, { prescreener, demographics: [{ id: 'role', question: 'Role?', options: ['Student', 'Professional'] }] });
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-screen-pass`);
  const clicked = await runSession(page, { ...happy, prescreenOption: 1 });
  expect(clicked).toMatchObject({ prescreen: 'right', labeled: 2, unlabeled: 1, beliefs: 1, demographics: ['Student'] });
  expect(dp.posts.map((p) => p.filename.split('_')[0]).sort()).toEqual(['labeled', 'session', 'unlabeled']);
  const [session] = file(dp.posts, 'session_');
  expect(session).toMatchObject({ prescreen_answer: 'right', prescreen_passed: 'true', n_labeled: '2', demo_role: 'Student' });
  expect(Object.keys(session).slice(-3)).toEqual(['prescreen_answer', 'prescreen_passed', 'demo_role']);
});

test('a wrong prescreen answer saves a session row only, shows the screen-out page and follows the screen-out redirect', async ({ page }) => {
  const dp = await interceptDataPipe(page);
  await patchManifest(page, { prescreener, completion_redirect: 'https://app.prolific.com/submissions/complete?cc=DONE' });
  await page.route('https://app.prolific.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>prolific</h1>' }));
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-screen-out`);
  const clicked = await runSession(page, { ...happy, prescreenOption: 2 });
  expect(clicked).toMatchObject({ prescreen: 'other', labeled: 0, unlabeled: 0, beliefs: 0, attention: [] });
  await expect(page.getByText('did not match')).toBeVisible();
  await page.waitForURL(/cc=SCREENOUT/);
  expect(dp.posts.map((p) => p.filename.split('_')[0])).toEqual(['session']);
  const [session] = file(dp.posts, 'session_');
  expect(session).toMatchObject({ session_id: 'e2e-screen-out', prescreen_answer: 'other', prescreen_passed: 'false', n_labeled: '0', n_unlabeled: '0', withdrawn: 'false' });
});

test('a passing participant follows the completion redirect, not the screen-out one', async ({ page }) => {
  await interceptDataPipe(page);
  await patchManifest(page, { prescreener, completion_redirect: 'https://app.prolific.com/submissions/complete?cc=DONE' });
  await page.route('https://app.prolific.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>prolific</h1>' }));
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-screen-done`);
  await runSession(page, { ...happy, prescreenOption: 1 });
  await page.waitForURL(/cc=DONE/);
});

// Images are shown as they are, at their own aspect ratio: the display box has to hold a 600x1800 portrait without
// pushing the rating scale off screen, and must never upscale or distort what the rater is being asked to judge.
test('an image domain shows every artifact inside the display box, with the rating scale still on screen', async ({ page }) => {
  await interceptDataPipe(page);
  const shapes = new Set<string>();
  const vh = page.viewportSize()!.height;
  for (const id of ['e2e-img-1', 'e2e-img-2', 'e2e-img-3']) {
    await page.goto(`/domains/example_image/?SESSION_ID=${id}`);
    await page.getByRole('button', { name: 'I agree' }).click();
    for (let i = 0; i < 4; i++) {                                   // attention check + 2 labeled + 1 unlabeled
      const img = page.locator('img.artifact-image');
      await expect(img).toBeVisible();
      const m = await img.evaluate((el: HTMLImageElement) => ({
        w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height,
        nw: el.naturalWidth, nh: el.naturalHeight, decoded: el.complete && el.naturalWidth > 0,
      }));
      expect(m.decoded, 'artifact decoded, so the rater never sees the alt text').toBe(true);
      shapes.add(`${m.nw}x${m.nh}`);
      expect(m.h, `${m.nw}x${m.nh} height fits the display box`).toBeLessThanOrEqual(vh * 0.51);
      expect(m.w, `${m.nw}x${m.nh} not upscaled`).toBeLessThanOrEqual(m.nw + 1);
      expect(Math.abs(m.w / m.h - m.nw / m.nh), `${m.nw}x${m.nh} undistorted`).toBeLessThan(0.02);
      // The ten stacked choices run past the fold in every domain, text included, so what the artifact must not do is
      // push the start of the scale off screen: the first choice stays fully visible without scrolling.
      const btn = (await page.locator('#jspsych-html-button-response-btngroup button').first().boundingBox())!;
      expect(btn.y + btn.height, `${m.nw}x${m.nh} leaves the scale reachable without scrolling`).toBeLessThanOrEqual(vh);
      if (await page.getByText('attention check').isVisible()) await page.locator('button.rating-btn').nth(2).click();
      else await page.locator('button.rating-btn').first().click();
      if (await page.getByRole('button', { name: 'Continue' }).isVisible()) await page.getByRole('button', { name: 'Continue' }).click();
      if (await page.getByRole('button', { name: 'A person' }).isVisible()) await page.getByRole('button', { name: 'A person' }).click();
    }
  }
  expect([...shapes], 'the tall portrait comes up across these sessions').toContain('600x1800');
});

test('an image that will not load stops the study on the failure page, never on a rating trial', async ({ page }) => {
  await interceptDataPipe(page);
  await page.route('**/domains/example_image/artifacts/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/domains/example_image/?SESSION_ID=e2e-img-404');
  await page.getByRole('button', { name: 'I agree' }).click();
  await expect(page.getByText('could not be started')).toBeVisible();
  await expect(page.locator('button.rating-btn')).toHaveCount(0);   // the alt text is the provenance sentence: it must never be what the rater sees
  await expect(page.locator('img.artifact-image')).toHaveCount(0);
});

const credit = (n: string) => ({ title: `Title ${n}`, title_url: `https://example.test/${n}`, author: `Author ${n}`, licence: 'CC BY 4.0', licence_url: 'https://creativecommons.org/licenses/by/4.0/' });

test('the disclosure page credits every artifact it showed, below the submit button', async ({ page }) => {
  await interceptDataPipe(page);
  // The example pool is four artifacts and a session shows all four, so every credit in the manifest is owed here.
  await patchManifest(page, { attribution: { human: { '0': credit('h0'), '1': credit('h1') }, ai: { '0': credit('a0'), '1': credit('a1') } } });
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-attribution`);
  await runSession(page, { ...happy, stopAtDisclosure: true });

  const sources = page.locator('.attribution');
  await expect(sources).toBeVisible();
  await expect(sources.getByRole('listitem')).toHaveCount(4);
  await expect(sources.getByRole('link').first()).toHaveAttribute('target', '_blank');
  await expect(sources.getByRole('link', { name: 'CC BY 4.0' }).first()).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');

  const button = (await page.getByRole('button', { name: 'Submit' }).boundingBox())!;
  const block = (await sources.boundingBox())!;
  expect(block.y).toBeGreaterThan(button.y + button.height);
});

test('a manifest that credits nothing shows no sources block', async ({ page }) => {
  await interceptDataPipe(page);
  await page.goto(`${EXAMPLE}?SESSION_ID=e2e-no-attribution`);
  await runSession(page, { ...happy, stopAtDisclosure: true });
  await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
  await expect(page.locator('.attribution')).toHaveCount(0);
});
