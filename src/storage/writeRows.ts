import type { Submission } from '../submission';
import type { DomainManifest } from '../manifest';
import type { Row, Destination, Sink, BrowserMeta } from './types';
import { toSessionRow, toLabeledRows, toUnlabeledRows } from './transform';

export function writeRows(rows: Row[], destination: Destination, sink: Sink): Promise<void> {
  switch (destination) {
    case 'session': return sink.writeSessionRows(rows);
    case 'labeled_response': return sink.writeLabeledResponseRows(rows);
    case 'unlabeled_response': return sink.writeUnlabeledResponseRows(rows);
    default: throw new Error(`Unknown destination: ${String(destination as never)}`);
  }
}

export async function storeSubmission(s: Submission, meta: BrowserMeta, m: DomainManifest, sink: Sink): Promise<void> {
  await writeRows([toSessionRow(s, meta, m)], 'session', sink);
  await writeRows(toLabeledRows(s), 'labeled_response', sink);
  await writeRows(toUnlabeledRows(s), 'unlabeled_response', sink);
  await sink.flush();
}
