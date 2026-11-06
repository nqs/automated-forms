# UK Skilled Worker visa automation

A [Stagehand](https://docs.stagehand.dev) automation that fills in the Home Office online
**Skilled Worker visa** application from a single JSON document and returns a JSON status
report describing exactly what happened.

```
application.json ──▶ ukvisa-apply run ──▶ status.json
                        │
                        └── Chrome (local or Browserbase) driven by Stagehand + Claude
```

* **Input**: one JSON document validated against `schemas/skilled-worker-application.schema.json`
  (zod schema in `src/schema/application.ts`). See `examples/application.example.json`.
* **Output**: a status report validated against `schemas/application-status.schema.json`
  (`src/schema/status.ts`). See `examples/status.example.json`.
* **Safety**: the automation never submits or pays unless told to. By default it stops on the
  declaration page. Payment is never automated.

## How it works

The Home Office form is a long sequence of single-question GOV.UK pages whose order depends on
earlier answers. Instead of scripting a fixed path, the runner (`src/engine/runner.ts`) loops:

1. Read cheap facts about the current page with plain DOM code (heading, URL, GOV.UK error
   summary). No model call.
2. Find the first registered **step** whose heading pattern matches (`src/steps/*.ts`). Each
   step turns the input document into a list of **field intents**: "put *this value* in the
   field labelled *X*".
3. Fill each intent (`src/engine/fields.ts`). Text, dates and selects are filled
   **selector-first**: Stagehand `observe()` finds the input from its label, then the value is
   typed with `locator.fill()`. Personal data therefore never reaches the model; only labels do.
   If no selector is found, `act()` is used as a fallback with Stagehand variables so the value
   is still substituted outside the prompt. Passwords and email never fall back.
4. Press Continue, re-read the page. If it did not advance and shows validation errors, retry
   (up to 3 attempts), then hand over to a human with the errors in the report.
5. Pages no step recognises go through a **generic fallback** (`src/engine/fallback.ts`):
   Stagehand `extract()` lists the questions on the page, each is matched against every field
   intent the registry could produce, confident matches are filled, the rest are reported as
   `unansweredQuestions` and the page is flagged in `warnings` for review.
6. Repeat until a stop point (declaration, payment), the confirmation page, or a problem.

References found along the way (GWF application reference, UAN after submission) are captured
into `references`.

## Setup

```bash
npm install
cp .env.example .env     # add ANTHROPIC_API_KEY (or another provider's key)
```

Requirements: Node 22.18+, Chrome/Chromium for local runs (set `CHROME_PATH` if it is not on the
default path) or a Browserbase account (`BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`).

The default model is `anthropic/claude-opus-5-5`; override with `STAGEHAND_MODEL` or `--model`
(Stagehand accepts `openai/…`, `anthropic/…`, `google/…`).

## Usage

```bash
# 1. Validate the input document
npm run apply -- validate --input examples/application.example.json

# 2. Fill the form, stop at the declaration (default), write the report
npm run apply -- run --input application.json --output status.json --verbose

# 3. Submit for real: set declaration.authoriseSubmission=true in the JSON, then
npm run apply -- run --input application.json --output status.json --stop-at payment
```

Options: `--start-url` (defaults to https://www.gov.uk/skilled-worker-visa/apply),
`--stop-at declaration|payment|never`, `--artifacts <dir>` for screenshots and the report,
`--headed` to watch the browser, `--driver heuristic` to use the model-free driver (see below).

Exit code is 0 unless the run `failed`. The report is printed to stdout and written to
`<artifacts>/status.json`; screenshots of every page land in `<artifacts>/screenshots/`.

### As a library

```ts
import { runApplication, StagehandFormDriver } from "uk-skilled-worker-visa-automation";

const report = await runApplication(applicationJson, {
  stopAt: "declaration",
  resolveVerificationCode: async ({ email }) => await fetchCodeFromMailbox(email),
  onStep: (step) => console.log(step.id, step.status),
}, {
  createDriver: () => StagehandFormDriver.launch({ modelName: "anthropic/claude-opus-5-5", modelApiKey: process.env.ANTHROPIC_API_KEY }),
});
```

`extraSteps` lets you register additional pages (matched before the built-ins) without
forking the registry.

## The status report

| Field | Meaning |
| --- | --- |
| `status` | `submitted`, `stopped` (reached the configured stop point), `needs_attention` (a human must take over), `failed` (browser/model/input error) |
| `statusReason`, `nextActions` | Plain-English explanation and what to do next |
| `references.gwf` / `uan` / `ihs` | Application reference, Unique Application Number, IHS reference |
| `steps[]` | One record per page visited: heading, URL, outcome, fields filled (with redacted previews and the JSON pointer each value came from), validation errors, unanswered questions, screenshot path |
| `steps[].recognised` | `false` when the page was handled by the generic fallback |
| `progress` | Pages visited/completed, fields filled, rough percentage of known steps |
| `warnings` | Anything worth a human's eye: fallback-handled pages, fields the page did not have, unpaid IHS, … |
| `model` | Model name and token usage |

Passwords and email addresses are shown as `••••••••`; other free-text values are truncated.

## When it hands over to a human

The run stops with `needs_attention` when:

* the form asks for an email verification code and neither `account.emailVerificationCode`
  nor a `resolveVerificationCode` callback is available;
* a page keeps rejecting the answers (three attempts), with the GOV.UK error messages recorded;
* an unrecognised page has required questions that match nothing in the input;
* a security question / memorable word is requested (not part of the schema).

In every case the saved application can be resumed on the Home Office site with the GWF
reference from the report, or re-run with `account.existingApplicationReference` set.

## Development without a model

`npm run mock-server` starts a dependency-free, GOV.UK-styled mock of the form
(`src/mock/`): 45 pages covering every input type the real form uses, split date fields,
repeating groups ("add another"), required-field validation with an error summary, a GWF
reference and a UAN.

`--driver heuristic` swaps Stagehand for `src/engine/heuristicDriver.ts`, which resolves the
same `observe`/`act`/`extract` requests by matching labels in the DOM. Together they let you
run the whole loop offline:

```bash
npm run mock-server &
npm run apply -- run --driver heuristic --start-url http://localhost:3999/ \
  --input examples/application.example.json --artifacts runs/mock --verbose
```

## Tests

```bash
npm test            # schema, fallback matcher, runner control flow (scripted driver), and the
                    # browser end-to-end run against the mock form
npm run typecheck
```

The end-to-end test launches Chromium through Playwright; set `CHROME_PATH` if the bundled
browser is not installed.

## Scope and caveats

* Built for the **main applicant**, entry clearance (`route.applyingFrom = "outside-uk"`) and
  in-country switching. Dependant applications are flagged in the input but not filled.
* Step heading patterns were written from the structure of the live form; the Home Office
  changes wording regularly. Unmatched pages fall back to the generic handler and are reported,
  so a run degrades to "review this page" rather than failing silently. Add or adjust patterns
  in `src/steps/` as the form evolves; `test/mock-e2e.test.ts` guards the registry.
* The automation does not upload documents, pay fees, or book biometrics. Those remain in
  `nextActions`.
* Running against the live service with a real model has not been exercised in this
  repository's CI; it was verified end to end against the mock form with the heuristic driver.
