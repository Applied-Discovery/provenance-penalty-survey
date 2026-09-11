# Survey Platform

Public hosting copy of the survey platform from the private
`Applied-Discovery/provenance-penalty` repository (tag
`survey-moved-to-public-repo`). It holds only what the survey needs to run:
the shared page, the domain manifests and anonymised artifacts. Curation
criteria, prompts and the artifact rename maps stay in the private repo and
on OSF. Pushes to `main` deploy `dist/` to GitHub Pages via
`.github/workflows/pages.yml`.

A jsPsych-based package that runs provenance-penalty surveys and pushes
responses to DataPipe/OSF. Each domain plugs in via a `domainManifest.json`
and a folder of artifacts; see `SPEC.md` for the full protocol. The page,
entry script and stylesheet in `web/` are shared: a domain folder holds no
frontend code, and `vite.config.ts` serves the shared page at
`domains/<name>/` for every domain.

## Install

```
npm install
```

## Develop

```
npm run dev
```

Opens the Vite dev server. Point your browser at a domain's page, e.g.
`domains/example/`.

## Test

```
npm test
```

Runs the Vitest suite (jsdom environment) under `test/`.

## Build

```
npm run build
```

Type-checks with `tsc --noEmit`, then builds the shared page once per
`domains/<name>/` into `dist/`. Manifests and artifacts are copied unchanged.
Curation criteria are not published with the survey; they live in the repo
and on OSF.

## Anonymize artifacts

```
npm run anonymize -- domains/<name>
```

Renames a domain's artifact files to random strings and updates its manifest
so filenames don't leak provenance. Prints the rename map and saves it to
`domains/<name>/prompts/artifact_map.json`, beside the prompts that produced
the AI artifacts, so each anonymised file traces back to its prompt. The build
copies only the manifest and `artifacts/`, so the map is never deployed.

## Add a domain

```
npm run new-domain -- <name> --type text|image|code --noun <stem noun> [--verb <human verb>] [--class lay|expert] [--labeled N] [--unlabeled N] [--checks N]
```

Creates `domains/<name>`: an empty `artifacts/` folder, a criteria stub, and a
manifest with empty pools. The page is shared (see above), so nothing else goes there.
Defaults: lay evaluators, one attention check, 30 labeled and 8 unlabeled
artifacts: 39 of the 40-artifact pool, the closest fit to the registered 2:2:1
ratio once the attention check has taken its artifact. Then:

1. Drop the artifact files into `domains/<name>/artifacts`, named
   `human_*.<ext>` and `ai_*.<ext>`.
2. `npm run index-artifacts -- domains/<name>` fills the manifest's pools in
   natural name order and refuses to write if the manifest would not validate.
3. `npm run anonymize -- domains/<name>`, which removes the prefixes.
4. Set `osf_study` and, for Prolific, `completion_redirect` in the manifest.
5. Write `curationCriteria.md`, then freeze it with the manifest and artifacts
   on OSF before data collection begins (see `02_design/BENCHMARK.md`, domain
   package, and `02_design/OSF_ACTIONS.md` §4.5).

## Simulate an export

```
npm run simulate-export -- --out <dir> [--sessions N] [--seed N] [--domains a,b,c]
```

Writes what a DataPipe download of a finished study looks like, produced by the
real pipeline: for each simulated participant the session plan, submission and
storage code run as in the browser, with ratings drawn from a known per-domain
penalty, and each session's three files land in `<dir>` under their DataPipe
names. Every twentieth session takes a role the analysis must exclude (a
half-landed submission, a reload-and-redo, a withdrawal, a failed attention
check). `truth_domains.csv` and `truth_params.csv` record what was planted.
`02_design/power_calc/test_pipeline.R` runs this and checks the analysis
against it.

## Security notes

The site is static, so everything the browser needs is public. Consequences:

- `domainManifest.json` maps each artifact to human or AI, and each trial's
  data holds the true author. A participant who opens the developer tools can
  read the truth; the deception design assumes they do not. Anonymised file
  names stop casual leaks only.
- The DataPipe experiment id is in the manifest, so anyone can post files to
  it. Turn on DataPipe's data validation for the experiment (CSV only, JSON
  off) and review uploads before analysis. Validation applies the same
  required-field list to every file, so require only the columns shared by
  the session, labeled and unlabeled files: `domain, session_id, start_time,
  protocol_version, domain_version, evaluator_type, evaluator_class, wave`.
  Requiring a session-only column such as `withdrawn` rejects the other two.
- `SESSION_ID` and `STUDY_ID` must match `[A-Za-z0-9_-]{1,128}`; anything
  else is ignored (a fresh session id is generated) and logged to the console.
- `completion_redirect` must be an http(s) URL; artifact paths must be relative
  to the domain folder with no `..`.
- `index.html` carries a Content-Security-Policy meta tag (GitHub Pages sends
  no headers). Keep it when copying the example; add hosts to `connect-src`
  only for a new storage sink.
- CSV string cells that start with `=`, `+`, `-` or `@` are prefixed with an
  apostrophe so a spreadsheet does not evaluate them.

## Output files

Each session writes `session_`, `labeled_` and `unlabeled_` CSVs named
`<prefix>_<session id>_<start time>.csv`. DataPipe rejects a file name that
already exists, so the start time lets a participant who reloads and redoes
the survey submit again instead of colliding with a half-landed first attempt.
Every row carries `session_id` and `start_time`, so a file set can be matched
to its session row from content alone. The analysis keeps the first complete
set per session id (see `02_design/ANALYSIS.md`, exclusions).

## Browser end-to-end tests

`npm run test:e2e` drives the example survey in a headless Chromium browser
(via Playwright) against the Vite dev server, with the DataPipe endpoint
stubbed so nothing leaves the machine. The six tests cover: a full session
producing one session/labeled/unlabeled write with correct columns; a failed
attention check plus withdrawal being recorded; a failed DataPipe write being
retried once without duplicating files; the same `SESSION_ID` reproducing the
same artifact order and labels; redirecting to `completion_redirect` after
the thank-you page; and a manifest that fails validation showing the failure
page instead of a survey.

## End-to-end check

`npm run test:datapipe` posts one full simulated session (built by the same
plan, submission and row code as the live page, 30 labeled and 8 unlabeled
rows, start-time file suffix) to DataPipe and OSF, to confirm `DataPipeSink`
still talks to the live service and passes its validation. A download of the
test component loads with `read_export()` in `02_design/power_calc`.
It needs its own DataPipe experiment id, pointed at an OSF test component
distinct from any study domain's component, in `E2E_OSF_STUDY` (see
`.env.example`). Never point it at a study experiment id. With that variable
unset the test skips; `npm test` never touches the network. Nothing loads `.env` automatically — export its variables into the shell first, e.g. `set -a; source .env; set +a`.
