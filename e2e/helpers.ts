import type { Page } from '@playwright/test';

export const DATAPIPE = 'https://pipe.jspsych.org/api/data/';
export const EXAMPLE = '/domains/example/';
export interface Post { experimentID: string; filename: string; data: string }

/** Capture DataPipe POSTs. The first `failFirst` calls get HTTP 500 so the retry path can be exercised. */
export async function interceptDataPipe(page: Page, failFirst = 0) {
  const posts: Post[] = []; let calls = 0;
  await page.route(DATAPIPE, async (route) => {
    calls++;
    if (calls <= failFirst) return route.fulfill({ status: 500, body: 'simulated failure' });
    posts.push(JSON.parse(route.request().postData()!));
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return { posts, calls: () => calls };
}

/** Serve the example manifest with fields overridden. */
export async function patchManifest(page: Page, patch: Record<string, unknown>) {
  await page.route('**/domainManifest.json', async (route) => {
    const res = await route.fetch();
    return route.fulfill({ response: res, json: { ...(await res.json()), ...patch } });
  });
}

/** Minimal CSV reader for the captured files: handles quoted cells (the user agent contains commas). */
export function parseCsv(csv: string): Record<string, string>[] {
  const split = (line: string) =>
    [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map((m) => m[1].replace(/^"|"$/g, '').replace(/""/g, '"'));
  const [head, ...lines] = csv.trim().split('\n');
  const cols = split(head);
  return lines.map((l) => Object.fromEntries(split(l).map((v, i) => [cols[i], v])));
}

export const file = (posts: Post[], prefix: string) => {
  const p = posts.find((x) => x.filename.startsWith(prefix));
  if (!p) throw new Error(`no ${prefix}* file among ${posts.map((x) => x.filename).join(', ')}`);
  return parseCsv(p.data);
};

const rate = (page: Page, n: number) =>
  page.locator('button.rating-btn').filter({ has: page.locator('.rating-n', { hasText: new RegExp(`^${n}$`) }) }).click();

export interface Choices { attentionCorrect: boolean; withdraw: boolean; labeledRating: number; unlabeledRating: number }
export interface Clicked { labeled: number; unlabeled: number; beliefs: number; attention: { expected: number; picked: number }[] }

/** Drive one session from consent to the thank-you page by reacting to whatever is on screen. */
export async function runSession(page: Page, c: Choices): Promise<Clicked> {
  const clicked: Clicked = { labeled: 0, unlabeled: 0, beliefs: 0, attention: [] };
  for (let step = 0; step < 200; step++) {
    if (await page.getByRole('heading', { name: 'Thank you' }).isVisible()) return clicked;   // debrief body also says "Thank you", so match the heading
    if (await page.getByRole('button', { name: 'I agree' }).isVisible()) { await page.getByRole('button', { name: 'I agree' }).click(); continue; }
    if (await page.locator('.attention').isVisible()) {
      const expected = Number((await page.locator('.attention').innerText()).match(/select (\d+)/)![1]);
      const picked = c.attentionCorrect ? expected : (expected % 10) + 1;
      clicked.attention.push({ expected, picked }); await rate(page, picked); continue;
    }
    if (await page.locator('.label:not(.attention)').isVisible()) { clicked.labeled++; await rate(page, c.labeledRating); continue; }
    if (await page.getByRole('button', { name: 'Continue' }).isVisible()) { await page.getByRole('button', { name: 'Continue' }).click(); continue; }
    if (await page.getByRole('button', { name: 'A person' }).isVisible()) { clicked.beliefs++; await page.getByRole('button', { name: 'A person' }).click(); continue; }
    if (await page.locator('button.rating-btn').first().isVisible()) { clicked.unlabeled++; await rate(page, c.unlabeledRating); continue; }
    if (await page.getByRole('button', { name: 'Submit' }).isVisible()) {
      if (c.withdraw) await page.getByLabel(/withdraw/i).check();
      await page.getByRole('button', { name: 'Submit' }).click(); continue;
    }
    await page.waitForTimeout(50);
  }
  throw new Error('session did not reach the thank-you page');
}
