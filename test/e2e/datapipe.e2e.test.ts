import { DataPipeSink, sessionFileName } from '../../src/storage/datapipe';
import { storeSubmission } from '../../src/storage/writeRows';
import { simulateSubmission } from '../../scripts/simulate-export';

const study = process.env.E2E_OSF_STUDY;
const run = study ? test : test.skip;

// One full session, built by the same plan, submission and row code the live page runs, posted through the real
// sink so the test component on OSF holds files shaped exactly like study data: every column, the start-time
// suffix in the file names, 30 labeled rows, 8 unlabeled rows. DataPipe validation (PRE_GO_LIVE_CHECKLIST.md §2)
// is exercised on the way. `read_export()` in 02_design/power_calc can be run on a download of the component.
run('writes one full session, labeled and unlabeled files to the test DataPipe experiment', async () => {
  const sid = `e2e_${crypto.randomUUID()}`, start = new Date().toISOString();
  const { manifest, submission } = simulateSubmission('creative_writing', sid, start);
  const sink = new DataPipeSink({ experimentId: study!, startTime: start });
  const meta = { browser: 'datapipe e2e test (Node)', jspsych_version: '8.3.0', viewport_width: 1280, viewport_height: 800 };
  await storeSubmission(submission, meta, manifest, sink);   // any non-2xx throws and fails the test

  const token = process.env.OSF_TOKEN, node = process.env.E2E_OSF_NODE;
  if (token && node) {
    const url = `https://api.osf.io/v2/nodes/${node}/files/osfstorage/?filter[name]=${sessionFileName('session', sid, start)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  }
  console.log(`posted session ${sid} start ${start}`);
}, 180_000);   // three writes at 11 to 14 s each (measured 2026-09-10) plus the OSF lookup
