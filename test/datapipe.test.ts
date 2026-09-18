import { toCsv } from '../src/storage/csv';
import { DataPipeSink } from '../src/storage/datapipe';

test('csv quotes commas, quotes and newlines; null is empty', () => {
  expect(toCsv([{ a: 1, b: 'x,y' }, { a: null, b: 'he said "hi"\nbye', c: true }]))
    .toBe('a,b,c\n1,"x,y",\n,"he said ""hi""\nbye",true\n');
});
test('string cells that a spreadsheet would treat as formulas are neutralised; numbers are not', () => {
  expect(toCsv([{ id: '=HYPERLINK("http://x")', n: -5, s: '-abc', at: '@x', ok: 'a=b' }]))
    .toBe(`id,n,s,at,ok\n"'=HYPERLINK(""http://x"")",-5,'-abc,'@x,a=b\n`);
});
test('session row is buffered and posted as one file on flush', async () => {
  const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await sink.writeSessionRows([{ session_id: 'S', wave: 1 }]);
  expect(fetchFn).not.toHaveBeenCalled();
  await sink.flush();
  expect(fetchFn).toHaveBeenCalledTimes(1);
  const [url, init] = (fetchFn as any).mock.calls[0];
  expect(url).toBe('https://pipe.jspsych.org/api/data/');
  expect(JSON.parse(init.body)).toEqual({ experimentID: 'EXP', filename: 'session_S.csv', data: 'session_id,wave\nS,1\n' });
});
test('response rows are buffered and flushed as one labeled and one unlabeled file per session', async () => {
  const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await sink.writeLabeledResponseRows([{ session_id: 'S', rating: 5 }, { session_id: 'S', rating: 7 }]);
  await sink.writeUnlabeledResponseRows([{ session_id: 'S', rating: 2 }]);
  expect(fetchFn).not.toHaveBeenCalled();
  await sink.flush();
  expect(fetchFn).toHaveBeenCalledTimes(2);
  const bodies = (fetchFn as any).mock.calls.map((c: any) => JSON.parse(c[1].body));
  expect(bodies).toContainEqual({ experimentID: 'EXP', filename: 'labeled_S.csv', data: 'session_id,rating\nS,5\nS,7\n' });
  expect(bodies).toContainEqual({ experimentID: 'EXP', filename: 'unlabeled_S.csv', data: 'session_id,rating\nS,2\n' });
  await sink.flush(); expect(fetchFn).toHaveBeenCalledTimes(2);   // buffer cleared
});
test('a retried submission re-sends only the files that did not land, with no duplicated rows', async () => {
  let n = 0;
  const fetchFn = vi.fn(async () => new Response('', { status: ++n === 2 ? 500 : 200 })) as unknown as typeof fetch;   // labeled file fails once
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  const attempt = async () => {
    await sink.writeSessionRows([{ session_id: 'S' }]);
    await sink.writeLabeledResponseRows([{ session_id: 'S', rating: 5 }]);
    await sink.writeUnlabeledResponseRows([{ session_id: 'S', rating: 2 }]);
    await sink.flush();
  };
  await expect(attempt()).rejects.toThrow(/500/);
  await attempt();
  const files = (fetchFn as any).mock.calls.map((c: any) => JSON.parse(c[1].body));
  // First flush posts all three at once; the unlabeled file lands despite the labeled failure, so the retry re-sends labeled only.
  expect(files.map((f: any) => f.filename)).toEqual(['session_S.csv', 'labeled_S.csv', 'unlabeled_S.csv', 'labeled_S.csv']);
  expect(files[3].data).toBe('session_id,rating\nS,5\n');   // one row, not two
});
test('flush posts the session, labeled and unlabeled files concurrently, not one after another', async () => {
  const resolvers: (() => void)[] = [];
  const fetchFn = vi.fn(() => new Promise<Response>((resolve) => resolvers.push(() => resolve(new Response('', { status: 200 }))))) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await sink.writeSessionRows([{ session_id: 'S' }]);
  await sink.writeLabeledResponseRows([{ session_id: 'S', rating: 5 }]);
  await sink.writeUnlabeledResponseRows([{ session_id: 'S', rating: 2 }]);
  const flushed = sink.flush();
  expect(fetchFn).toHaveBeenCalledTimes(3);      // all three requests in flight before any has answered
  resolvers.forEach((r) => r());
  await flushed;
});
test('flush waits for every in-flight post before rejecting, so a retry cannot race a request that is still landing', async () => {
  let resolveUnlabeled: (() => void) | undefined;
  const fetchFn = vi.fn((_url: string, init: RequestInit) => {
    const { filename } = JSON.parse(init.body as string);
    if (filename.startsWith('labeled')) return Promise.resolve(new Response('', { status: 500 }));
    if (filename.startsWith('unlabeled')) return new Promise<Response>((resolve) => { resolveUnlabeled = () => resolve(new Response('', { status: 200 })); });
    return Promise.resolve(new Response('', { status: 200 }));
  }) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await sink.writeSessionRows([{ session_id: 'S' }]);
  await sink.writeLabeledResponseRows([{ session_id: 'S', rating: 5 }]);
  await sink.writeUnlabeledResponseRows([{ session_id: 'S', rating: 2 }]);
  let settled = false;
  const flushed = sink.flush().catch((e) => { settled = true; throw e; });
  await new Promise((r) => setTimeout(r, 10));
  expect(settled).toBe(false);                   // labeled already failed, but unlabeled is still in flight
  resolveUnlabeled!();
  await expect(flushed).rejects.toThrow(/500/);
  await sink.flush().catch(() => {});             // retry: only the labeled file goes again
  const names = (fetchFn as any).mock.calls.map((c: any) => JSON.parse(c[1].body).filename);
  expect(names).toEqual(['session_S.csv', 'labeled_S.csv', 'unlabeled_S.csv', 'labeled_S.csv']);
});
test('non-2xx throws with status', async () => {
  const fetchFn = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await sink.writeSessionRows([{ session_id: 'S' }]);
  await expect(sink.flush()).rejects.toThrow(/500/);
});
test('unsafe session id is sanitized in the file name but left intact in the CSV body', async () => {
  // fileSafe replaces every character outside [A-Za-z0-9_-] with '_': '../x y/z' -> '___x_y_z',
  // so with the 'session_' prefix's own trailing '_' the file name is 'session____x_y_z.csv'.
  const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await sink.writeSessionRows([{ session_id: '../x y/z' }]);
  await sink.flush();
  const [, init] = (fetchFn as any).mock.calls[0];
  const body = JSON.parse(init.body);
  expect(body.filename).toBe('session____x_y_z.csv');
  expect(body.data).toBe('session_id\n../x y/z\n');
});
test('a hung request is aborted after timeoutMs, causing flush to reject', async () => {
  const fetchFn = ((_url: string, init: RequestInit) => new Promise((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
  })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn, timeoutMs: 50 });
  await sink.writeSessionRows([{ session_id: 'S' }]);
  await expect(sink.flush()).rejects.toThrow();
});
test('with a start time, every file name carries it, so a reload-and-redo never collides with a half-landed attempt', async () => {
  const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn, startTime: '2026-09-09T10:00:00.000Z' });
  await sink.writeSessionRows([{ session_id: 'S' }]);
  await sink.writeLabeledResponseRows([{ session_id: 'S', rating: 5 }]);
  await sink.writeUnlabeledResponseRows([{ session_id: 'S', rating: 2 }]);
  await sink.flush();
  const names = (fetchFn as any).mock.calls.map((c: any) => JSON.parse(c[1].body).filename);
  expect(names).toEqual(['session_S_2026-09-09T10_00_00_000Z.csv', 'labeled_S_2026-09-09T10_00_00_000Z.csv', 'unlabeled_S_2026-09-09T10_00_00_000Z.csv']);
});
test('empty session id throws', async () => {
  const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await expect(sink.writeSessionRows([{ session_id: '' }])).rejects.toThrow(/empty/);
});

import fc from 'fast-check';
test('property: csv has one header line plus one line per row when no cell needs quoting', () => {
  const plain = fc.stringMatching(/^[A-Za-z0-9 _.-]{0,20}$/);
  fc.assert(fc.property(fc.array(fc.dictionary(fc.stringMatching(/^[a-z_]{1,8}$/), fc.oneof(plain, fc.integer(), fc.boolean()), { minKeys: 1 }), { minLength: 1 }), (rows) => {
    const out = toCsv(rows as any);
    return out.endsWith('\n') && out.split('\n').length === rows.length + 2;
  }));
});

test('keepalive: the post asks the browser to let the request outlive the page; off by default', async () => {
  const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
  const plain = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await plain.writeSessionRows([{ session_id: 'S' }]); await plain.flush();
  expect((fetchFn as any).mock.calls[0][1].keepalive).toBeFalsy();
  const keep = new DataPipeSink({ experimentId: 'EXP', fetchFn, keepalive: true });
  await keep.writeSessionRows([{ session_id: 'S' }]); await keep.flush();
  expect((fetchFn as any).mock.calls[1][1].keepalive).toBe(true);
});
