import type { Row, Sink } from './types';
import { toCsv } from './csv';

/** Session ids come from an unsanitized URL query param; strip anything that isn't safe in a file name. */
function fileSafe(id: unknown): string {
  const s = String(id).replace(/[^A-Za-z0-9_-]/g, '_');
  if (s.length === 0) throw new Error('fileSafe: session id produced an empty file name segment');
  return s;
}

/** `<prefix>_<session id>[_<start time>].csv`: the name a session's file gets on OSF. Shared with the simulated
 * export (scripts/simulate-export.ts) so test data is laid out exactly like a DataPipe download. */
export function sessionFileName(prefix: string, sessionId: unknown, startTime?: string): string {
  return `${prefix}_${fileSafe(sessionId)}${startTime ? `_${fileSafe(startTime)}` : ''}.csv`;
}

/**
 * File names are `<prefix>_<session id>[_<start time>].csv`. DataPipe refuses a name that already exists on OSF, so
 * without the start time a session whose first attempt half-landed could never be resubmitted. With it, the in-page
 * retry reuses the name (same page, same start time) while a reload-and-redo gets fresh files; the analysis keeps the
 * first complete set per session id (ANALYSIS.md, exclusions).
 */
export class DataPipeSink implements Sink {
  private buffer = new Map<string, Row[]>();      // filename -> rows, replaced (not appended) on each write; posted together by flush()
  private posted = new Set<string>();             // filenames that landed; a retried submission skips them
  private endpoint: string;
  private fetchFn: typeof fetch;
  private experimentId: string;
  private timeoutMs: number;
  private startTime?: string;

  constructor(opts: { experimentId: string; endpoint?: string; fetchFn?: typeof fetch; timeoutMs?: number; startTime?: string }) {
    this.experimentId = opts.experimentId;
    this.endpoint = opts.endpoint ?? 'https://pipe.jspsych.org/api/data/';
    this.fetchFn = opts.fetchFn ?? fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 60_000;   // DataPipe took 7 to 14 s per file in 2026-09; a client-side abort leaves the file on OSF and the retry then collides
    this.startTime = opts.startTime;
  }

  private name(prefix: string, sessionId: unknown): string { return sessionFileName(prefix, sessionId, this.startTime); }

  private async post(filename: string, data: string): Promise<void> {
    if (this.posted.has(filename)) return;        // already on OSF; DataPipe file names are unique per experiment
    const res = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: '*/*' },
      body: JSON.stringify({ experimentID: this.experimentId, filename, data }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`DataPipe write of ${filename} failed: HTTP ${res.status}`);
    this.posted.add(filename);
  }

  async writeSessionRows(rows: Row[]): Promise<void> {
    this.stage('session', rows);
  }

  /** Group rows by session and replace any earlier buffer for that key, so a retry never doubles the rows. */
  private stage(prefix: string, rows: Row[]) {
    const bySession = new Map<string, Row[]>();
    for (const row of rows) bySession.set(String(row.session_id), [...(bySession.get(String(row.session_id)) ?? []), row]);
    for (const [sid, group] of bySession) this.buffer.set(this.name(prefix, sid), group);
  }

  async writeLabeledResponseRows(rows: Row[]): Promise<void> {
    this.stage('labeled', rows);
  }

  async writeUnlabeledResponseRows(rows: Row[]): Promise<void> {
    this.stage('unlabeled', rows);
  }

  /**
   * Posts every buffered file at once: the files are independent and DataPipe's latency is per request, so a session's
   * three files take one round trip instead of three. Waits for all of them before reporting the first failure, so a
   * retry never starts while a request from this attempt is still landing (which would duplicate its file name).
   */
  async flush(): Promise<void> {
    const entries = [...this.buffer];
    const results = await Promise.allSettled(entries.map(([name, rows]) => this.post(name, toCsv(rows))));
    results.forEach((r, i) => { if (r.status === 'fulfilled') this.buffer.delete(entries[i][0]); });
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
  }
}
