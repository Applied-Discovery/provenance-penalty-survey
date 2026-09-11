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
test('session row posts one file immediately', async () => {
  const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await sink.writeSessionRows([{ session_id: 'S', wave: 1 }]);
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
  expect(files.map((f: any) => f.filename)).toEqual(['session_S.csv', 'labeled_S.csv', 'labeled_S.csv', 'unlabeled_S.csv']);
  expect(files[2].data).toBe('session_id,rating\nS,5\n');   // one row, not two
});
test('non-2xx throws with status', async () => {
  const fetchFn = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
  await expect(new DataPipeSink({ experimentId: 'EXP', fetchFn }).writeSessionRows([{ session_id: 'S' }])).rejects.toThrow(/500/);
});
test('unsafe session id is sanitized in the file name but left intact in the CSV body', async () => {
  // fileSafe replaces every character outside [A-Za-z0-9_-] with '_': '../x y/z' -> '___x_y_z',
  // so with the 'session_' prefix's own trailing '_' the file name is 'session____x_y_z.csv'.
  const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn });
  await sink.writeSessionRows([{ session_id: '../x y/z' }]);
  const [, init] = (fetchFn as any).mock.calls[0];
  const body = JSON.parse(init.body);
  expect(body.filename).toBe('session____x_y_z.csv');
  expect(body.data).toBe('session_id\n../x y/z\n');
});
test('a hung request is aborted after timeoutMs, causing writeSessionRows to reject', async () => {
  const fetchFn = ((_url: string, init: RequestInit) => new Promise((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
  })) as unknown as typeof fetch;
  const sink = new DataPipeSink({ experimentId: 'EXP', fetchFn, timeoutMs: 50 });
  await expect(sink.writeSessionRows([{ session_id: 'S' }])).rejects.toThrow();
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
