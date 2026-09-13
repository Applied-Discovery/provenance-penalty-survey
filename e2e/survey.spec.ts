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
