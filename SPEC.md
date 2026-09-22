# Platform Spec

The platform is a typescript package that functions as the backbone for running the surveys. It is implemented with jsPsych and comes with a default data storage layer via DataPipe to OSF. It should be easy for new domain surveys to be spun up using this platform.

## Hosting

The survey will be hosted via GitHub pages.

## High Level Design

The platform should be modular as much as possible, with two layers:

- Collection
- Storage

### Collection Layer

This is the layer that uses jsPsych. Each new domain should accept a domainManifest.json which 
has the following structure

```json
{
    name: "",
    protocol_version: "v0.1",
    domain_version: "v0.1",
    wave: 1,
    artifact_type: "image" | "text" | "code",
    evaluator_class: "lay" | "expert",
    stem_noun: "", // e.g. poem, short story, etc.
    human_verb?: "", // default: created. Could be "drawn, written, painted"
    expected_minutes?: "5-10", // default: "5-10". Shown in consent as "about 5-10 minutes"
    attention_checks?: 1, // default: 1
    labeled_artifacts_per_session: 4, // Will be split 50/50 human/ai. Error if not even
    unlabeled_per_session: 1, // default 1
    avoid_pairs?: false, // default false. When true, human i and ai i never appear in the same session (labeled, attention or unlabeled)
    demographics?: [ // default []. Single-choice questions asked after the last rating, before the debrief
        { id: "ai_use", question: "How often do you use AI coding assistants?", options: ["Never", "Monthly", "Weekly", "Daily"] }
    ],
    artifacts: {
        human: {
            id: "paths/to/artifacts" // ids are 0-indexed integers, unique within human/ai. Important they remain stable
        },
        ai: {}
    },
    attribution?: { // default {}. Source credits, keyed by artifact index exactly as `artifacts` is; an artifact with no entry is not credited
        human: {
            "0": { title?: "", title_url?: "", author?: "", author_url?: "", licence?: "", licence_url?: "" } // every field optional, at least one required
        },
        ai: {}
    },
    storage?: "datapipe", // default (currently only supported)
    curation_criteria: "path/to/markdown_file.md", // contains criteria for curation of the artifacts which should be frozen and uploaded to OSF before data collection begins.
    completion_redirect?: "", // URL to redirect to once a survey is complete
    osf_study: "" // ID for datapipe
}
```

A spec should be validatable per the field types and other logic specified above.

Validation rules:

| Rule | Rationale |
|------|-------------|
| `labeled_artifacts_per_session % 2 == 0 ` | Must be able to split evenly AI/Human |
| `artifacts.human.length == artifacts.ai.length` | Must be an even sample |
| `labeled_artifacts_per_session + attention_checks + unlabeled_per_session <= artifacts.human.length + artifacts.ai.length` | Cannot attempt to show more artifacts than exist |
| with `avoid_pairs`: `labeled_artifacts_per_session + attention_checks + unlabeled_per_session <= artifacts.human.length` | Each pair can supply at most one artifact to a session |
| every key of `attribution.human` / `attribution.ai` names an artifact of that pool | A credit keyed to a missing index is a typo that would silently drop the source |
| `artifacts.human` and `artifacts.ai` must have keys 0, 1, ... N-1 | We want easily indexable artifacts. Are using a dict so the keys are stable. |
| `demographics[].id` snake_case and unique; `options` has at least two entries | Each id becomes a session-row column `demo_<id>` |
| with `artifact_type == "code"`: every artifact path has an extension registered in `src/highlight.ts` | The highlighting grammar comes from the file name, never auto-detected from the content, so colouring cannot differ between the human and AI halves of a pair |
| with `artifact_type == "image"`: every artifact path ends in `.jpg`, `.jpeg` or `.png` | The artifact is shown as it is in an `<img>`. A format the browser cannot decode renders the alt text instead, which on a labeled trial is the provenance sentence |

#### GET Parameters

| Name | Description |
|------|-------------|
| STUDY_ID | Study id (provided by prolific) |
| SESSION_ID | Session id (provided by prolific) |

#### Timeline creation

First, system generates a session id, if they aren't passed in via a get param.

Then, jsPsych should, for each run, generate a timeline that:

**Shows consent.**

**Ratings**

1. Pull in an even split of AI and human artifacts. With `avoid_pairs`, an artifact whose index has already been drawn for the session is skipped; this applies to every draw below (labeled, unlabeled, attention).
2. Randomize order (with the RNG seeded by the session id)
3. Randomize stated provenance, balanced between Human and AI (with the RNG seeded by the session id)
4. Insert the attention checks into the order, following the formula: Attention check k of N is inserted before labeled position `floor(k * L / N)` (k from 0). Attention checks use real artifacts. They carry no provenance label but have instruction text instead

**Unlabeled Block**

1. Choose random artifacts which did *not* appear in the ratings. Odd remainder goes to either at random. (with the RNG seeded by the session id)
2. Randomize order (with the RNG seeded by the session id)
3. Display, prompting to rate, and then guess provenance.

**Demographics**

A title page ("We will now ask some questions about you.", trial kind `demographics_title`) followed by one trial per `demographics` question, in manifest order, each a stacked single-choice list like the belief question. They come after the unlabeled block so that domains asking different questions (e.g. AI coding assistant use in the code domain) stay comparable on the ratings themselves, and before the disclosure so they are in the submission. A domain that asks nothing skips the block.

**Disclosure**
Shows a disclosure with a withdrawal checkbox and a submit button.

Below the submit button, the source credits of the artifacts this session showed, in the order they were shown: one
line per artifact the manifest's `attribution` block credits, reading title by author, licence, with each field and its
separator dropped when the entry has neither its text nor its URL, and a `*_url` rendering as a link on the URL itself
when its text is missing. Only the session's own artifacts are listed - the licences owe attribution for what was used,
and the credits are shown after every rating is made, so naming the shown human-made artifacts cannot affect the data.
Links open in a new tab: nothing has been submitted yet at this point, and following a source in the same tab would
lose the session. Nothing is rendered when no artifact of the session carries a credit.


On submit, passes results to the storage layer. Retry once if it fails. Displays a thank you page. Redirects back to Prolific if a callback URL was specified

#### Display

This package is accompanied by a `copy.ts` where all fixed participant facing copy is stored.

Code artifacts are shown in a monospace box with syntax highlighting from highlight.js (text escaped, tokens wrapped in `hljs-*` spans, github light theme). Highlighting applies only to `artifact_type: code`; the grammar is the one the artifact's file extension maps to in `src/highlight.ts` (`.py`, `.c`, `.ts`, `.java`, ...), so a pool may mix languages; anonymisation keeps extensions. Lines are never wrapped; wide code scrolls inside the box. `plaintext` (`.txt`) is available for a language that is not registered; adding a language means importing its grammar and its extensions in `src/highlight.ts`.

Image artifacts are shown in an `<img>` at their own aspect ratio, fitted to the column and to half the window height
(`max-width: 100%`, `max-height: 50vh`), never cropped, stretched or upscaled. The height cap is what keeps the stem and
the start of the rating scale on screen when an artifact is portrait; without it a tall image is rated after a scroll.
The pool a session draws is preloaded after consent, behind a progress bar, so a rating's response time never includes
download time. The preload is bounded (`PRELOAD_TIMEOUT_MS` in `src/run.ts`): an artifact that fails to load, or a pool
that has not arrived by then, ends the session on the platform's failure page rather than reaching a rating trial where
the browser would render the alt text. Because an image is shown at its own size and format, both stay visible to the
rater, so curation keeps dimensions, aspect ratios and formats comparable across the human and AI halves of the pool.

#### Notes
- We want to ensure that the true provenance of a piece of text or image isn't revealed. Image alt text should be set to the provenance label. File names should not leak. Option to create a utility script which gives all the artifacts a random string name and updates manifest accordingly.

## Storage Layer API


### Responses

With each submission, the storage API receives the following.

| Column | Meaning |
|---|---|
| `domain` | Domain name |
| `submission_time` | When the survey was submitted, datetime |
| `start_time` | When the survey was started, datetime |
| `session_id` | Session ID (equivalent to `run_id` for an AI evaluator) |
| `protocol_version` | from manifest |
| `domain_version` | from manifest |
| `evaluator_type` | (Optional) Default human |
| `evaluator_class` | from manifest |
| `wave` | from manifest |
| `study_id` | from GET param |
| `data` | JSON defined below |


The data JSON will contain 
| Column | Meaning |
|---|---|
| `attention_expected` | int[], 1-10 |
| `attention_answer` | int[] 1-10, actually submitted |
| `withdrawn` | True/False |
| `ratings` | JSON `[{"id": artifact id, "actual_author": human|ai, "stated_author": human|ai, "survey_pos": int, "rating": int, time_spent: ms}]` |
| `unlabeled_ratings` | JSON `[{id, actual_author, predicted_author, survey_pos, rating, rating_time_spent, belief_time_spent}]
| `demographics` | JSON `[{id, answer}]`, one per manifest question in manifest order; `answer` is the chosen option text |

Note:
- Artifact ids are constructed as `"{domain}_{domain version}_{author}_{index}"`
- `survey_pos` ignores the attention checks. It does not reset when we move to the unlabeled block.


### Storage layer

The data is split into three and transformed accordingly:
- Session Data: All metadata. Withdrawals, attention expected/responses (semicolon separated), avg rating, min time spent, median time spent. This data contains all we need to potentially disqualify data. Additional browser metadata is also collected and added: browser, jsPsych version, viewport. Demographic answers follow as the last columns, `demo_<id>` per manifest question, so the fixed columns keep their places across domains.
- Labeled Responses: one row per rating. Session id, and all rating information
- Unlabeled Responses: one row per rating. Session id, and all rating information

Note that User id is intentionally not saved. This data can be recovered by joining by the session id in prolific.

These three may contain duplicated data, as required.

Next, each is written to a storage location.

There should be a writeRow(data, destination, sink?) function, where data is a single level JSON of the row data, destination is either session or labeled_response or unlabeled_response and sink is a sink object.

Sink objects interface has four methods: writeSessionRow, writeLabeledResponseRow, writeUnlabeledResponseRow, and flush. Everything else is internal and up to the sink to be decide how to implement

Currently, the only db object will be a DataPipeSink implementation. Others may be added later.

DataPipeSink names files `<session|labeled|unlabeled>_<session id>_<start time>.csv`. The start time is fixed for the life of the page, so the single in-page retry reuses the names and skips files that already landed, while a reload gets new names instead of a duplicate-file rejection. Response rows also carry `start_time`.

## Example Use

A deployed domain holds only data; the shared page in `web/` is served at `domains/<name>/` by `vite.config.ts`. The curation criteria, prompts and artifact rename map stay in the study repo's curation folder and on OSF.

```
|- domains/
    |- domain_name/
        |- domainManifest.json
        |- artifacts/
            |- 7b1c5d95d5e45878.txt   (anonymised names)
            | ...
```

## Deferred for now

- Expert Domains
- LaTeX rendering
- Incomplete session tracking (we rely on prolific)