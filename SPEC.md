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
    artifacts: {
        human: {
            id: "paths/to/artifacts" // ids are 0-indexed integers, unique within human/ai. Important they remain stable
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
| `artifacts.human` and `artifacts.ai` must have keys 0, 1, ... N-1 | We want easily indexable artifacts. Are using a dict so the keys are stable. |

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

1. Pull in an even split of AI and human artifacts
2. Randomize order (with the RNG seeded by the session id)
3. Randomize stated provenance, balanced between Human and AI (with the RNG seeded by the session id)
4. Insert the attention checks into the order, following the formula: Attention check k of N is inserted before labeled position `floor(k * L / N)` (k from 0). Attention checks use real artifacts. They carry no provenance label but have instruction text instead

**Unlabeled Block**

1. Choose random artifacts which did *not* appear in the ratings. Odd remainder goes to either at random. (with the RNG seeded by the session id)
2. Randomize order (with the RNG seeded by the session id)
3. Display, prompting to rate, and then guess provenance.

**Disclosure**
Shows a disclosure with a withdrawal checkbox and a submit button.


On submit, passes results to the storage layer. Retry once if it fails. Displays a thank you page. Redirects back to Prolific if a callback URL was specified

#### Display

This package is accompanied by a `copy.ts` where all fixed participant facing copy is stored.

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

Note:
- Artifact ids are constructed as `"{domain}_{domain version}_{author}_{index}"`
- `survey_pos` ignores the attention checks. It does not reset when we move to the unlabeled block.


### Storage layer

The data is split into three and transformed accordingly:
- Session Data: All metadata. Withdrawals, attention expected/responses (semicolon separated), avg rating, min time spent, median time spent. This data contains all we need to potentially disqualify data. Additional browser metadata is also collected and added: browser, jsPsych version, viewport.
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

An example use would look something like the following, where domain_name.js invokes the package with the domainManifest.

```
|- domain_name/
    |- domainManifest.json
    |- artifacts
        |- ai_1.txt
        | ...
    |- curationCriteria.md
    |- index.html
    |- domain_name.js
```

## Deferred for now

- Expert Domains
- LaTeX rendering
- Incomplete session tracking (we rely on prolific)