# Phase 2 plan: the real model

Written 2026-11-25. This is a PLAN, nothing here is built. Items marked **(proposal)** are suggestions made when this page was written, not decisions. Decisions that are still open are listed under "Open decisions", with options and trade-offs, and are NOT decided here.

Phase 2 replaces the mock behind `@/lib/mock` (`getMockResult`, see `ui.md` and `decisions.md`, "Result screen") with a server-side pipeline that calls the Claude API. One model vendor is used. Rules that do not change: the LLM never decides layout (the PDF template is fixed), the LLM must not invent experience (if the job asks for something the CV lacks, the user is asked), the user reviews everything before download, and CV and job text never go to logs, traces or error reports (`ops.md`, CLAUDE.md privacy rules).

## The pipeline: three roles and no judge

```
PDF -> loadPdf -> cleanPdfText -> normalizeText ---+
                                                   +--> [1 Extractor] --> Cv + JobPosting
pasted job text -> validateJobText ----------------+
Cv + JobPosting ------------------------------------> [2 Comparer]  --> match analysis
Cv + JobPosting + match analysis -------------------> [3 Generator] --> SuggestedChange[]
                                                  (optional) in-code check --> warnings per change
                                  review screen: the user accepts / rejects / edits
                                  applyChanges(originalCv, changes, decisions) --> Cv --> PDF template
```

- **There is NO LLM judge.** The end user is the judge, through the review screen that already exists (accept, reject, edit, live preview). Why this is acceptable: every change is shown next to the original text, nothing is applied without a decision, and `applyChanges` is plain code. See "Ideas not planned".
- **The orchestrator is plain code, not a model.** It lives in `src/agents/` (CLAUDE.md) and only sequences the three roles, validates what each returns and decides what happens on failure. The tailored CV is never written by a model: it is always `applyChanges(...)`, as in the current UI.
- **Roles 1 and 2 are independent for the CV and the job text.** The CV and the job posting can be extracted in parallel (proposal; saves latency, costs nothing extra).

### Rules shared by all three roles

- Server-side only. The API key never reaches the client (check in a later task: no key and no LLM module in the browser bundle).
- Inputs are DATA, never instructions: delimited in the prompt, and system instructions are never built from CV or job text (`decisions.md`, "Prompt injection").
- Every output is parsed with the zod schemas (`schemas.md`) or checked by code before it is used. A role returns the shared result object (`{ ok: true, value } | { ok: false, error: { category } }`, `src/lib/result.ts`), never throws for expected problems, and never passes a library or model message to the caller (messages can contain user data).
- Every call has a timeout and a maximum output size (values to decide with the evaluation).
- Logs, Sentry and Langfuse receive only ids, sizes, durations, token counts, role name, model name and status. Langfuse normally records prompts and outputs: how to send ONLY metadata (or nothing) must be checked in its task; if that cannot be guaranteed, content is not traced.
- Retry policy: on invalid output, at most one retry per call (proposal), then a failure category.

## Contract of each role

File names under `src/agents/` are a proposal.

### 1. Extractor (`extractor.ts`)

| | |
| --- | --- |
| Input | CV text: the cleaned and normalised text from `loadPdf` (or the text the user pastes when `hasExtractableText` is false, `ExtractionMethod.MANUAL`). Job text: the output of `validateJobText`. Which one is read by the model when the PDF layout is hard (text loader or the PDF itself) is an open decision. |
| Output | `Cv` (`CvSchema`) and `JobPosting` (`JobPostingSchema`), both from `src/lib/schemas/`. |
| Existing code it uses | `loadPdf`, `cleanPdfText`, `normalizeText`, `validateJobText`, the two schemas. |
| Rules | Copy, do not infer: every value must come from the text; what is not there stays missing (the schemas are almost all optional on purpose). No invented dates, companies or numbers. Unknown keys are stripped by zod; a document that fails the schema is a failure, not a guess. |
| Failure categories | to define in its task (proposal: `invalid_output`, `timeout`, `unavailable`). |

### 2. Comparer (`comparer.ts`)

| | |
| --- | --- |
| Input | `Cv` and `JobPosting`. |
| Output | `{ items: MatchItem[] }`, the shape already used by the UI (`src/lib/result/types.ts`): one item per requirement with `id`, `requirement`, `kind` (`required` / `niceToHave`), `status` (`covered` / `partial` / `missing`) and `justification`. |
| Rules | The code checks that every requirement of the `JobPosting` appears exactly once and that ids are unique (the model does not decide which requirements exist). A `justification` is shown to the user, so it must refer to what the CV actually says. The statuses feed the cover letter questions: a missing REQUIRED requirement is what the user is asked about, never something the model fills in. |

### 3. Generator (`generator.ts`)

| | |
| --- | --- |
| Input | `Cv`, `JobPosting` and the match analysis. |
| Output | `SuggestedChange[]` (`src/lib/result/types.ts`): `target` (a `ChangeTarget`: the summary, one achievement by `experienceIndex` and `achievementIndex`, or one skill by `skillIndex`), `before`, `after`, `section` and `label`. |
| Slot-targeted, not freely rewritten | The model proposes new wording for EXISTING slots only. It never returns a whole CV and never changes structure, order or layout. Today the types cannot express "add a new bullet": that would be a change to the types, not part of this plan. |
| Checked by code | The target exists in the CV (an out-of-range index is discarded). `before` is read from the CV by code, not trusted from the model, and the change `id` is assigned by code (both proposals). `after` goes through the same limits as the edit form (`normalizeEditedText` and `validateEditedText` in `src/lib/result/validate-edit.ts`, limits in `src/lib/limits.ts`); a change that fails them is discarded and counted. |
| Never | Invent experience. A requirement with no support in the CV is not "fixed" by a change; it stays in the match analysis and the user is asked. |

### The deterministic check (recommended, optional for the first version)

A check written in code, not a model. It is recommended because it is cheap, testable and catches the most damaging error (an invented fact). It is optional for the first version: the pipeline works without it, and it can be added as its own task.

- **What it does.** For every suggested change it compares the `after` text with its sources: the original `Cv` (every text field) and the user's answers (`CoverLetterAnswers`, the texts of `answered`). A company, date, job title, tool or number in `after` that does not appear in those sources produces a warning for that change. (Comparison is normalised: case, accents and spacing ignored. A change the user has edited is the user's own wording, so only the model's `after` is checked (proposal).)
- **How (proposal).** Candidates come from three simple detectors: numbers and percentages; years, month names and `2021-03` style dates; and capitalised words and terms from the `JobPosting` (keywords and requirements) that occur in `after`. The last one targets the most likely error: copying a tool from the job posting into a bullet the CV does not support. Pure function in `src/lib/result/`, no imports of server code, so the UI can run it too.
- **It FLAGS, it never hides or blocks.** The review screen shows a visible warning next to the change (icon and words, not colour alone, inside the card so screen readers read it with the change) naming the unsupported text. Accept, Reject and Edit work exactly as before. The user decides.
- **What it cannot catch.** It looks for NEW pieces of text, not new meaning. "Contributed to" rewritten as "led", or a claim of more responsibility with the same words, passes. It will also warn about harmless new words (false positives), for example a capitalised word at the start of a sentence. It is a safety net, not a guarantee, like the banned-phrase test (`decisions.md`, "honest bridge").
- **Privacy.** The warning text contains CV fragments: it stays in UI state, like the rest of the result. Logs may count warnings, never include them.
- **Also useful offline.** The same function can measure invented values in the extractor output against the source text during evaluation.

### Not covered by the three roles

The cover letter questions and the draft (`questions`, `initialDraft` and `getMockCoverLetterDraft` in the mock) are not part of the three-role design. They are a core part of the product (CLAUDE.md), so this is listed as an open decision below. Requirements already recorded for their prompt are in `decisions.md`, "Cover letter questions: the honest bridge" (at most 2 gap questions, a `topic` of at most 60 characters, follow-ups decided by code, no generic claims).

## Tasks

Numbering continues from Phase 1. Same rules as before: one task at a time, a short plan first when it touches more than 2 files, one branch per task, the owner commits, the `reviewer` runs before the merge. "Owner" is the subagent in `.claude/agents/`. Every task updates the wiki and `changelog.md`.

**Task 8: LLM client and configuration.** Owner: `backend` (the new dependency, `.env.example` and `package.json` are shared files: say why and keep them minimal).
- Goal: one server-only module that calls the Claude API with a timeout, returns the shared result object, and reports only token counts, duration, model name and status. Adds the official SDK and the API key variable to `.env.example` (placeholder only).
- Verify: unit tests with a fake transport (no network, no key). A test that the logger output of a call contains none of the prompt text. A search shows no client file imports the module. After `npm run build` (the owner runs it), a search of `.next/static` finds no key and no SDK code.

**Task 9: synthetic evaluation set and harness.** Owner: `backend`.
- Goal: the evaluation data and a command that runs a role over it and prints a table, built BEFORE the roles so each one is measured as it is written. Details in "Evaluation plan".
- Verify: the harness runs with a fake model and reports the expected numbers on a hand-made case; the set contains only invented people and companies; `git status` shows no real file.

**Task 10: extractor.** Owner: `backend`.
- Goal: role 1, with the zod schemas as the contract and the prompt-injection rule (CV and job text are delimited data).
- Verify: tests with a stub model (valid output, invalid output, retry, timeout, unavailable); a posting that contains instructions does not change the output of the stub path; run the evaluation set and record schema validity and invented-value numbers.

**Task 11: comparer.** Owner: `backend`.
- Goal: role 2; code checks that every requirement appears once.
- Verify: tests with a stub model (a dropped requirement, a duplicated id, an unknown status are failures); run the evaluation set and record agreement with the hand labels.

**Task 12: generator.** Owner: `backend`.
- Goal: role 3, slot-targeted changes, `before` and `id` assigned by code, `after` validated against the existing limits.
- Verify: tests with a stub model (target out of range, over-long `after`, a change for a missing requirement); `applyChanges` still produces the expected CV from generated changes; run the evaluation set and record the numbers.

**Task 13 (recommended, optional): in-code check of invented facts.** Owner: `backend` for the function; `frontend` for the warning on the change card (two steps, so a plan first).
- Goal: the deterministic check described above and its visible warning.
- Verify: pure tests with invented CVs (a new number, a new company, a new tool from the job, a name that is in the user's answer: each case flagged or not as expected); a change with a warning can still be accepted, rejected and edited (reducer unchanged); with a screen reader or by reading the markup, the warning is inside the card and has text, not only colour. Checked in a browser by the owner (no browser tool was available in Phase 1).

**Task 14: persistence of results.** Owner: `infra-db`.
- Goal: the result must be reloadable by id (README, `ui.md` note d). `Application` today stores `tailoredCv`, `coverLetter` and `status`, and `JobPost.analysis` stores the `JobPosting`, but there is NO column for the match analysis or the suggested changes. Where they go (for example new Json columns on `Application`) is decided in the plan of this task. Also decide, with the open decision on retention, how `expiresAt` is set for anonymous records.
- Verify: migration applies on a clean database and on the existing one (`prisma migrate status`); a round trip writes and reads the new fields through the zod schemas; nothing stores raw CV text (`database.md` privacy rules).

**Task 15: orchestrator and API routes.** Owner: `backend`.
- Goal: `src/agents/orchestrator.ts` runs the roles, validates every API input with zod (the PDF upload and the job text, with the limits in `schemas.md`), stores the result, returns its id. The uploaded file is never stored; only sizes, durations and statuses are logged.
- Verify: route tests with stub roles (bad PDF category, too short job text, a role failure maps to a safe category); logs checked for the absence of content; `/api/health` unchanged.

**Task 16: UI switched from the mock to the real result.** Owner: `frontend`.
- Goal: replace the two swap-point functions with real calls (same signatures), upload the file from the input screen, address the result by id (`/result/<id>`), and remove every sample phrase: the full list is in `ui.md` (note a and the lists after it, including "Nothing leaves your browser in this version", the sample notice and the `?demo=error` switch). Validate the model's cover letter topics with `isValidTopic` before they reach the UI.
- Verify: the search recipe in `ui.md` finds no remaining sample phrase; the review screen behaves as before with generated changes; manual keyboard and screen reader check by the owner; `npm run build`.

**Task 17: Sentry and Langfuse.** Owner: `backend` for the server code; config files are shared files.
- Goal: error reporting and LLM tracing with content excluded (see the shared rules).
- Verify: trigger a handled failure and a traced call with a synthetic CV; inspect what arrives in both tools and confirm that no CV, job or answer text is present.

**Task 18: evaluation run and report.** Owner: `backend`.
- Goal: run the whole set, fill the results page with the numbers (accuracy per stage, cost and latency), use them to close the open decisions on models and budget, and add the headline numbers to the README.
- Verify: the numbers can be reproduced with the documented command; every claim in the README matches the results page.

Phase 2.5 (the encoder microservice) starts only after these tasks work with the LLM alone, and reuses the same evaluation set (`decisions.md`, "Encoder for matching").

## Evaluation plan

Without numbers the model choice and the budget are guesses, so the evaluation is built first (Task 9) and every role is measured when it is written.

**Data.**
- A small set of SYNTHETIC CV and job pairs: invented people, companies and texts only. Real CVs are never used (the repository ignores `*.pdf` and `/fixtures-private/` for private local experiments, and nothing from there goes into the set). A first size of about 10 pairs is a proposal to confirm; small enough to label by hand.
- Each pair has hand-written expected results: the `Cv` and `JobPosting` JSON, the status of each requirement, and a list of "forbidden facts" (things the job asks for that the CV does not contain).
- Cases to include (proposal): a CV that matches well; one that matches partly; one with several missing required requirements (the trap for invention); accents and punctuation in names; noisy text like the loader's output for a two-column CV; a job posting that contains instructions aimed at the model (prompt injection); one long CV and one short one.
- The text of the CVs is produced the way the product receives it (through `loadPdf` for PDF cases), so the extractor is measured on realistic input. Test PDFs are built in memory (`test-pdf-builder.ts`).

**Metrics per stage.**

| Stage | Measured | Why |
| --- | --- | --- |
| Extractor | Share of outputs that pass the zod schema on the first try and after the retry. Field accuracy against the expected JSON (contact, experience count, titles, dates, bullets). Invented values: values not found in the source text. Omissions: values in the text that were not extracted. For the job: recall and precision of the requirement list. | An invented value here is copied into everything downstream. |
| Comparer | Agreement with the hand-labelled status per requirement, as a confusion matrix. Count of FALSE "covered" separately (the worst error: it hides a gap). Spot check that justifications refer to real CV content. Requirements dropped or duplicated. | A false "covered" means the user is never asked about a real gap. |
| Generator | Share of changes with a valid target and a valid length. Changes that contain a forbidden fact (any hit is a bug to investigate). Changes aimed at a requirement the CV does not cover. Warnings of the in-code check against the hand labels, if it exists (precision and recall on seeded inventions). All changes of a small set are also read by hand. | The generator is where an invented claim would reach the user's CV. |
| Whole pipeline | Failure rate by category; share of runs that end with a usable result. | The user sees this. |

The accept rate of real users cannot be measured with synthetic data and is not claimed.

**Cost and latency.** For every role and for the whole pipeline: input and output tokens (from the API response), calls per result, cost (computed from the provider's price list on the day of the run, which is written next to the result and not hard-coded), and latency (median and 95th percentile, plus total wall time). Each pair runs a few times (3, a proposal) because model output varies. This is also what makes the "which model per role" decision measurable.

**Privacy of the evaluation.** Only synthetic text is sent to the API. Raw outputs of a run go to a git-ignored folder; the summary tables are written to the wiki. Logs follow the same rules as production (ids, sizes, durations, token counts).

**Results.** Recorded in a results page created when the first run exists (name to decide then), and summarised in the README. Nothing is claimed before it is measured.

## Ideas not planned

- **An LLM judge**, possibly from another vendor, that scores or vetoes the generator's output. Not planned: the end user is the judge, and the in-code check covers the most damaging error without a model.
  - **Criterion to revisit:** only if measurement on the evaluation set shows that a judge catches errors that BOTH the in-code check and the user's review would miss. To measure that, run the judge offline on the synthetic set and compare its flags with the hand labels. An offline experiment on synthetic data has no privacy cost.
  - **Privacy cost of a second vendor (if it ever ran in production):** the CV, the job posting and the generated text, which are personal data, would be sent to a second company. That means a second processor with its own retention and training terms to read and accept, a second place where data can leak or be requested, a longer privacy statement for users, and a rule in CLAUDE.md that today assumes one vendor. It would also add cost and latency to every request.

## Open decisions

None of these is decided. Each needs a measurement or an owner decision, and each is linked to the task that needs it.

**1. Which model for each role, and the cost budget** (needed by Task 8; settled with Task 18).
- Options: (a) one model for all three roles: simplest, one setting, probably the highest cost; (b) a larger model for the generator and a smaller, cheaper one for extraction and comparison: lower cost, more configuration, and the saving is only real if the smaller model passes the evaluation; (c) the smallest model everywhere: cheapest, highest risk of invented or missing values.
- The budget also needs a value: a ceiling per result and a ceiling per month, and what happens at the ceiling (reject, queue, degrade). Anonymous users cost money and have no account to limit (Phase 3), so abuse protection (a rate limit per client) is part of this decision.
- Model names and prices change: read them from the provider's current documentation when deciding.

**2. Very long CVs** (needed by Task 10).
- Today's limits: PDF 5 MiB and 10 pages, no limit on the number of characters of CV text; the job text is capped at 20 000 characters; the `Cv` schema caps sizes (for example 30 experiences, 600 characters per bullet) (`schemas.md`).
- Options: (a) keep the page limit and reject anything above: bounded cost and the simplest; may reject a legitimate long CV (academic, 10 or more years of work); (b) cut the text to a limit: cheap, but silently losing experience contradicts the project's rule of never cutting content without asking; (c) extract in chunks by section and merge: handles any length, but more calls, more latency and cost, and merge errors; (d) ask the user to shorten the CV first, with a clear message: honest, but pushes the work to the user.
- A related question: what happens when the extracted data exceeds the schema caps (fail, or keep the first N items and say so).

**3. Read the PDF directly or go through the text loader first** (needed by Task 10).
- Current documented flow (CLAUDE.md): PDF -> text loader -> cleaning -> LLM extracts. Changing it means updating CLAUDE.md. The database enum already has `PDF_LLM` for a model-read PDF, which `loadPdf` does not produce (`schemas.md`).
- Options: (a) text loader first (today): text tokens only, predictable, easy to test with in-memory PDFs, and the loader's text is the "source text" for the in-code check and for the evaluation; weaknesses: two-column CVs can come out interleaved, and scanned PDFs have no text (the user is asked to paste it); (b) give the PDF to the model: may handle layout and scans better; cost per page is probably higher (to measure), file limits and provider behaviour apply, results are harder to reproduce and test, and the in-code check would still need text; (c) hybrid: loader first, the PDF directly only when `hasExtractableText` is false or the text looks interleaved: best coverage, two code paths to maintain, and it quietly adds OCR-like ability that `decisions.md` marks as out of scope.
- Either way the file content leaves the server for the model vendor: this is a privacy statement the README and the input screen must make true (they say the opposite today).

**4. How long results are kept for anonymous users** (needed by Task 14).
- Facts: `expiresAt` exists on `Cv` and `JobPost`; `Application` disappears with them by cascade; NO cleanup job exists yet; anonymous records are protected only by their unguessable uuid, and a cookie-based `anonSessionId` was left to decide in Phase 2 (`database.md`, `decisions.md`).
- Options for the period: hours (strongest privacy, the user loses the result on a page reload later the same day), days (a user can come back to finish; more personal data kept), until the user deletes it (needs a visible delete button and still needs a limit to avoid keeping data forever). Also: a fixed deadline versus one that extends each time the result is opened; whether the cover letter answers are stored at all (today they stay in the browser).
- Whatever is chosen needs the cleanup job, the rule "no `userId` means `expiresAt` is set" enforced in the app, and a sentence on the site saying how long data is kept. The vendor's own retention is a separate fact to check and state.

**5. Cover letter questions and draft** (added when this page was written; not in the three-role design, needed by Task 15).
- Options: (a) keep the mock behaviour until a later task and ship the review of CV changes first: smallest scope, but the product is incomplete and the mock phrases of the letter stay; (b) produce the questions in the comparer and the draft in the generator (same two roles, more output): fewer calls, bigger prompts; (c) a fourth role for the letter: cleaner contract and separate measurement, one more role to evaluate and pay for.
- Constraints already recorded: follow-ups are decided by code (`question-flow.ts`), topics are validated, and the user's answers are the only source of new facts.
