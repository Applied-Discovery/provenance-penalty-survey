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

## Add a domain

Curation happens in the private study repo, in a curation folder per domain;
this repo holds only what the survey deploys. The scripts find the curation
root at `../provenance-penalty/03_run/curation` (a sibling checkout); pass
`--curation DIR` or set `CURATION_DIR` to point elsewhere. Three steps:

```
npm run new-domain -- <name>
```

Creates the curation folder `<name>/` with a `curationCriteria.md` stub and
empty `artifacts/` and `prompts/` folders. Curate the pool into `artifacts/`,
named `human_<n>.<ext>` and `ai_<n>.<ext>`, keep the prompts that produced
the AI artifacts in `prompts/`, and write the criteria.

```
npm run scaffold -- <name> --type text|image|code --noun <stem noun> [--verb <human verb>] [--class lay|expert] [--minutes <consent duration>] [--labeled N] [--unlabeled N] [--checks N] [--avoid-pairs]
```

Builds `domains/<name>/` from the finished pool: copies the artifacts and
writes the manifest with its pools filled in natural name order. Validates
first and writes nothing if the manifest would not validate or the folder
exists. The page is shared (see above), so nothing else goes there. Defaults:
lay evaluators, one attention check, 30 labeled and 8 unlabeled artifacts: 39
of the 40-artifact pool, the closest fit to the registered 2:2:1 ratio once
the attention check has taken its artifact. `--avoid-pairs` sets
`avoid_pairs` in the manifest for domains where `human_<n>` and `ai_<n>` are
answers to the same prompt: a session then never shows both halves of a pair,
so it can draw at most one artifact per pair (20 with the standard pool) and
the session shape must be set smaller. A `--type code` domain is highlighted
by each artifact's file extension (`.py`, `.c`, `.ts`, `.java`, ...;
`src/highlight.ts` maps extensions to grammars, and `.txt` turns highlighting
off), so a pool may mix languages as long as every file has a known extension.
Highlighting is never auto-detected from the content, so a
human and AI artifact in the same language are always coloured by the same
rules. `domains/example_code/` is a placeholder code domain covering C, Python,
TypeScript and Java; open it on the dev server to check the highlighting.

A `--type text` domain shows each artifact as plain text with its whitespace kept, unless the pool is Markdown: `.md` artifacts are rendered (headings, bold, italics, lists, quotes), with raw HTML escaped and links and images left as literal text, so remove links while curating. A pool is all `.md` or none, which the manifest checks, because a mixed pool would render one half formatted and the other raw. `domains/example_markdown/` is a placeholder Markdown domain in the shape of a question-and-answer pool; open it on the dev server to check the styling.

A `--type image` domain shows each artifact in an `<img>` at its own aspect
ratio, fitted to the column and to half the window height, never cropped,
stretched or upscaled; the height cap is what keeps the stem and the start of
the rating scale on screen when an artifact is portrait. Only `.jpg`, `.jpeg`
and `.png` are accepted, and the manifest rejects anything else: an artifact
the browser cannot decode would render its alt text, which on a labeled trial
is the provenance sentence. The session's artifacts are preloaded after
consent behind a progress bar, so a rating's response time excludes download
time, and a pool that will not load within two minutes ends the session on the
failure page instead of reaching a rating trial. Because an image is shown at
its own size and format, both are visible to the rater: curation has to keep
dimensions, aspect ratios and formats comparable across the human and AI
halves, or a pool whose AI half is uniformly 1024x1024 PNG and whose human
half is 4032x3024 JPEG hands the rater a provenance cue that has nothing to do
with the artifact. `domains/example_image/` is a placeholder image domain
covering all three formats at four shapes, including a tall portrait; open it
on the dev server to check the display box.

To ask participants about themselves, add `demographics` to the manifest by
hand: a list of `{ id, question, options }` single-choice questions (snake_case
ids, at least two options). They are asked, behind their own title page, after
the last rating and before the debrief, so a domain-specific question, say AI coding assistant use in the code
domain, cannot prime the ratings, and each answer lands in the session row as
`demo_<id>` holding the chosen option text. Add a "Prefer not to say" option
where the question warrants one. `domains/test/` carries an example.

For an expert domain, `prescreener` adds a one-question expertise screen right
after consent: `{ artifact, question, options, answer, redirect }`. The
artifact (a file in the domain folder, rendered like the study artifacts; it
must not be one of the study pool) is shown above the question, and `answer`
must be one of `options`. A right answer continues into the study, and the
session row records `prescreen_answer` and `prescreen_passed` (before the
`demo_` columns). A wrong answer ends the session: a session row with
`prescreen_passed` false and no response files is posted in the background (a
keepalive request, no saving page, no retry), the screen-out page shows for
the redirect delay, and the participant is sent to `redirect`, the platform's
screen-out completion URL (on Prolific, a second completion code of the
"screened out" kind). The odd screened-out row may not land; the platform's
screen-out count is the reference. Fix the
question and answer before collection and record them in the run log; the
registration's pass mark is one out of one. `domains/test/` and
`domains/code/` carry examples.

```
npm run anonymize -- <name>
```

Renames the domain's artifact files to random strings and updates the manifest
so filenames don't leak provenance. Saves the rename map to the curation folder
as `artifact_map.json`, so each anonymised file traces back to its prompt, and
refuses to run on a domain that is already anonymised. Then set `osf_study`
and, for Prolific, `completion_redirect` in the manifest, and freeze the
manifest, artifacts and `curationCriteria.md` on OSF before data collection
begins (see `02_design/BENCHMARK.md`, domain package, and
`02_design/OSF_ACTIONS.md` §4.5 in the study repo).

## Smoke-test domain

`domains/test/` is a deployed smoke-test domain: eight artifacts that each read
TEST, a four-labeled, two-unlabeled session, and `osf_study` set to the DataPipe
e2e test experiment (never the study one). Open `domains/test/` on the live site
to check the page and the saving screen without touching study data.

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
- Artifact files are served as they are, so anything inside them is public.
  Anonymisation renames files; it does not rewrite their contents, and image
  metadata (EXIF, XMP, C2PA) travels with the file. Nothing a participant sees
  on the page exposes it, but a saved file can be inspected.
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
to its session row from content alone. The three files are posted at once (DataPipe
takes several seconds per request, so this is one wait rather than three), behind a
saving page that asks the participant to keep the tab open; a file that fails is
re-sent once while the ones that landed are not. The analysis keeps the first complete
set per session id (see `02_design/ANALYSIS.md`, exclusions). A session screened
out at the expertise question writes the `session_` file only, with zero counts,
empty statistics and `prescreen_passed` false.

## Browser end-to-end tests

`npm run test:e2e` drives the example survey in a headless Chromium browser
(via Playwright) against the Vite dev server, with the DataPipe endpoint
stubbed so nothing leaves the machine. The tests cover: a full session
producing one session/labeled/unlabeled write with correct columns; a failed
attention check plus withdrawal being recorded; a failed DataPipe write being
retried once without duplicating files; the saving page showing while the
three posts run concurrently; the same `SESSION_ID` reproducing the same artifact
order and labels; redirecting to `completion_redirect` after
the thank-you page; a manifest that fails validation showing the failure
page instead of a survey; an image domain fitting every artifact into the
display box, undistorted and never upscaled, with the rating scale reachable
without scrolling; and an image that will not load ending the session on the
failure page rather than on a rating trial.

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
