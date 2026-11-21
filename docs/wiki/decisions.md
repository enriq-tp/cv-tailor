# Decisions

Format: decision, why, alternatives considered.

## Next.js + TypeScript for frontend and backend
- Why: one language and one project for UI and API; phases 2 and 3 add to it without a rewrite.
- Alternatives: Gradio (good for ML demos, weak for auth and custom flows); separate React + FastAPI (more moving parts).

## Postgres in Docker for local development
- Why: same engine as production, reproducible with one command (`docker compose up -d`), no cloud dependency while developing, and it does not touch the native PostgreSQL installed on the dev machine.
- Image pinned to a major version (`postgres:18`) so a pull never jumps to a new major. Data lives in a named volume so it survives container removal.
- Host port 5433 and bind to 127.0.0.1: the native Windows PostgreSQL already uses 5432, and the database should not be reachable from the network.
- Credentials come from `.env` (git-ignored); `.env.example` documents the variable names.
- Alternatives: Supabase/Neon from day one (kept for production hosting); the native Windows PostgreSQL (not reproducible for other machines or CI).

## Prisma as ORM (pinned to 7.10.1)
- Why: schema defined in one readable file, generated TypeScript types, migrations.
- Pinned to the last stable 7.x (7.10.1) because the npm `latest` tag pointed at a release candidate of v8 when the project started. Exact versions (no `^`) for `prisma`, `@prisma/client` and `@prisma/adapter-pg` so they never drift apart. Revisit when v8 is stable.
- Prisma 7 specifics: the connection URL lives in `prisma7.config.ts`, not in the schema; `.env` is not loaded automatically (we use `dotenv`); the client is generated into `generated/prisma` (git-ignored) and needs a driver adapter (`@prisma/adapter-pg` + `pg`).
- Alternatives: Drizzle (SQL-first, lighter, less tooling for migrations/studio); raw `pg` (no types, more boilerplate).

## Database schema (Task 3): see `database.md` for the full model
- **uuid ids** (native Postgres `uuid`): not guessable, which matters because ids will appear in URLs for anonymous users. Alternative: `Int autoincrement` (smaller, but enumerable).
- **Structured data as `Json` (jsonb)**, validated with zod in the app instead of columns: the CV shape changes with the prompts. Alternative: normalised tables (strict, but a migration for every shape change).
- **Optional `userId` on `Cv` and `JobPost`** (NULL = anonymous): Phase 3 can attach accounts without rewriting tables. `Application` has no `userId`; its owner is its `Cv`'s owner (single source of truth).
- **Cascade deletes everywhere**: deleting a user removes all their data and leaves no orphans. Alternative: `Restrict` (manual ordered deletes, easier to leave data behind).
- **Privacy by design**: no original files and no raw CV text are stored; `expiresAt` for anonymous records (cleanup job comes later).
- **Anonymous records are protected only by their unguessable UUID.** Acceptable for the prototype: no API routes yet, database reachable only from this PC, short-lived data, and no session machinery needed to try the core flow. Limits: anyone who obtains an id can read the record and it cannot be revoked. Alternative to decide in Phase 2, when the API routes exist: an `anonSessionId` column checked against an httpOnly cookie. It is an additive migration, so nothing is lost by waiting. Not added now.
- **`ExtractionMethod` = `PDF_TEXT`, `PDF_LLM`, `MANUAL`** (no OCR: it would be a feature from a later phase). Native enum: typo-safe; adding a value is a one-line migration.
- **Default Prisma table names** (`"JobPost"`, no `@@map`): simplest schema to read and explain. Cost: double quotes in psql.

## Logging with pino (Task 4): see `ops.md`
- Why pino: structured JSON logs, built-in redaction, fast, and Next.js already treats it as an external package (no bundling workaround). Alternatives: `winston` (heavier, slower, no built-in path redaction), `console.log` (unstructured, no levels, no redaction).
- Redaction by field name (including nested), plus errors reduced to their type name, plus a privacy test. Why layers: a CV is personal data and a single forgotten `logger.info(cv)` must not leak it. Redaction cannot see inside free text, so the rule "log ids, sizes, durations only" stays the first line of defence.
- Never pass a caught error to the logger: database errors can contain the connection string. Log a safe category instead.
- `pino-pretty` is a dev-only dependency, used through pino's `transport` only when `NODE_ENV` is `development`. Production and tests print plain JSON.
- `LOG_LEVEL` env var, default `info`; an invalid value falls back to `info`.

## Health check (Task 4)
- `GET /api/health` runs `SELECT 1` with a 2 s timeout and answers 200/503 with `status`, `database`, `timestamp`, `durationMs`, and only a safe `error` category (`timeout`, `connection`, `unknown`).
- `await connection()` plus `Cache-Control: no-store`: with `cacheComponents`, a `GET` route handler can be prerendered at build time. Verified: `next build` lists the route as dynamic and consecutive calls return different timestamps.
- Success is logged at `debug` (monitors poll it), failure at `error`.
- Shared Prisma client in `src/lib/db.ts`, cached on `globalThis` in development so hot reload does not open a new connection pool on every edit.
- Test runner: Node's built-in `node:test` run by `tsx` (already installed). Alternative: Vitest or Jest (more features, a new dependency and config); not needed for one small test file.

## Project subagents (setup task): see `architecture.md` > Agents
- **Four agents split by area** (`infra-db`, `frontend`, `backend`, `reviewer`). Why: each prompt carries only the rules and folders of its area, so the instructions stay short and the owner can explain who does what. Tasks still run one at a time on one short-lived branch each, so agents never work in parallel on the same files.
- **Health check split:** `infra-db` owns only `src/app/api/health/`; `backend` owns the rest of `src/app/api/`. The health check is infrastructure (it tests the database), the other routes are product logic.
- **No agent can spawn other agents:** `Agent` is left out of every `tools` list.
- **Folder limits are only instructions.** The Claude Code docs say a subagent file cannot restrict paths. Path limits need permission rules in settings (`Edit(path)`, session-wide, not per agent) or a `PreToolUse` hook. We chose neither, to keep the setup simple and explainable. Cost: an agent that ignores its prompt could edit outside its area. Mitigations: each agent must stop and ask if a task needs a file outside its area, and the reviewer flags changed files against the owner map using `git diff --stat`.
- **Reviewer is read-only by configuration only partly.** `Edit`, `Write`, `NotebookEdit` and `PowerShell` are removed from its tools by configuration (`tools` and `disallowedTools`). `Bash` is kept because it needs `git diff`, and **Bash cannot be technically restricted to read-only**: the docs say Bash rules match command text, are not a security boundary, and a command such as `sed -i` can still change files. So "never modify tracked files and never run state-changing git commands" is an instruction in its prompt (option A). Safety net: `git status` and `git diff` make any unexpected change visible and reversible, and the reviewer must run `git status --short` at the end to confirm it changed nothing.
- **Possible future hardening:** a `PreToolUse` hook defined in the reviewer's frontmatter that only lets read-only commands through (`git diff`, `git log`, `git status`, `git show`). On Windows it would run through `node` and requires accepting the workspace trust dialog. Not done now; revisit if the reviewer is ever trusted with more or if it misbehaves.
- **Destructive commands:** every agent with a shell is told never to run `docker compose down -v`, `prisma migrate reset`, `git push --force`, `git reset --hard` or delete branches without explicit permission, and never to commit or push. This is also an instruction, not enforcement (Prisma itself additionally blocks `migrate reset` when run by an AI agent).
- **Frontmatter typos are silent:** Claude Code ignores frontmatter fields it does not recognise, so a misspelt `tools` would give the agent every tool. After editing an agent file, check the result.

## Input screen (Task 5): see `ui.md`

- **`aria-disabled` instead of `disabled` on the main button.** A `disabled` button cannot be focused or activated, so it gives no feedback. With `aria-disabled="true"` it stays focusable; activating it shows all errors and moves focus to the first invalid field, and an always-present hint explains what is missing.
- **Light only; dark mode deferred.** Two palettes double the contrast checking. The template's dark block was removed and `color-scheme: light` set.
- **Fonts:** Bricolage Grotesque (headings) and Public Sans (body) through `next/font/google`: self-hosted, no new dependency, no request to Google from the browser. Geist was removed (unused).
- **Limits come from `src/lib/limits.ts`** (no imports), never from `pdf-loader.ts` or `validate-job-text.ts`: those import pino and unpdf, which must not end up in the browser bundle. Checked: no `pino` or `unpdf` in `.next/static`.
- **Client validation is only a convenience.** The server re-validates and is authoritative (it also normalises text, so counts can differ at the boundary).
- **A rejected file clears the previous one** (error = no file): one simple rule instead of "keep the old file next to an error".

## Result screen (Task 6): see `ui.md`

- **Accept / reject / edit as one pure reducer with derived counters.** State is one `Decisions` record (change id -> status and optional edited text) changed only by `reviewReducer` (accept, reject, undo, edit). The counters "pending, accepted, rejected" are calculated by `countDecisions` on every render and never stored, so they cannot disagree with the cards. A reducer is plain TypeScript, so it is tested without React; unknown ids are ignored. Undo and reject drop the user's edited text, so "pending" and "rejected" never carry stale wording.
- **The mock has ONE swap point and runs in the browser.** The UI imports only `getMockResult` and `getMockCoverLetterDraft` from `@/lib/mock`. In Phase 2 those two async functions are replaced by calls to the server with the same signatures and the UI does not change. The mock runs in the browser (client effect) because Phase 1 has no API route for it, and it never receives the user's CV or job text, only the cover letter answers.
- **`aria-disabled` for the download buttons**, same reasoning as the main button in Task 5: they stay focusable and the "Download is coming soon." note (always in the page, linked with `aria-describedby`) explains why nothing happens.
- **The draft is never overwritten silently.** If the user typed in the cover letter draft (`draftEdited`), a new draft from an answer is kept aside and offered with a "Replace with updated draft" button. Losing hand-written text because of a background update would be worse than a manual click.
- **Skip rule: a skipped question leaves the requirement out of the letter.** The letter claims only what the CV supports or what the user wrote in an answer. We never invent experience (CLAUDE.md).
- **`/result?demo=error` is a demo switch, ignored when `NODE_ENV` is `production`.** It exists only so the error screen can be looked at. The check is compiled into the build, so a production user can never be shown a fake error. It carries no user data. Remove it in Phase 2.
- **Sticky demo notice that gives way.** The notice must always be visible, so it is sticky. To keep WCAG 2.2 "focus not obscured", `html` has `scroll-padding-top` so a focused element is never left under the bar. On very short viewports (`max-height: 30rem`, for example 400% zoom) it becomes normal content instead of eating the screen.
- **One preview in the DOM, two wrappers (`useMediaQuery`).** At 1024 px and up the preview is a sticky, scrollable, keyboard-reachable region; below it is an open `<details>` without inner scroll. Rendering it twice and hiding one with CSS would duplicate content for screen readers.

## Sequential agent work, small verifiable tasks
- Why: tasks depend on each other; each step must be reviewable and explainable.
- Parallelism only for independent tasks, one git worktree per agent.

## Structured data + fixed PDF template (LLM does not lay out the CV)
- Why: predictable, testable layout (fits 1-2 pages, ATS-friendly), lower cost and latency per download. The LLM only edits JSON data.
- Template renderer: `@react-pdf/renderer` first; switch to HTML + Playwright only if more visual freedom is needed.
- LLM is used at development time to help design the template.
- Optional Phase 2 experiment: "free design" mode with the API pdf skill, compared against the template on quality and cost.

## Encoder for matching (Phase 2.5)
- Encoders (BERT-style) read and understand text; decoders (LLMs) generate. Use an encoder only where it adds measurable value.
- Plan: sentence embeddings for CV achievement vs job requirement similarity, in a Python FastAPI microservice called from Next.js.
- Evaluate against the LLM-only matching with a small set of CV/job pairs and report results in the README.
- Out of scope: fine-tuned NER for CV parsing (needs labelled data the project does not have).

## CV and job input handling (Task 4.5): see `schemas.md`

- **PDF library: `unpdf` 2.2.1** (MIT, zero dependencies, bundles a serverless build of pdf.js, needs Node >= 24). Alternatives: `pdf-parse` (depends on native `@napi-rs/canvas`, its documented API has no per-page text, and it recommends `serverExternalPackages`); `pdfjs-dist` directly (needs worker setup and our own line joining). Probe results on Node 24.18 with synthetic PDFs: `extractText(bytes, { mergePages: false })` returns one string per page; an empty buffer, garbage, a `%PDF` header plus garbage and a truncated file all throw `InvalidPDFException`; a blank page gives `""`; `getDocumentProxy` exposes `numPages`, so the page limit is checked before extracting; pdf.js takes ownership of the memory it gets, so we always pass a copy (`new Uint8Array(buffer)`). Encrypted PDFs throw `PasswordException`; not tested with a real encrypted file (only the classifier is tested, with a fake error). Verified that it bundles and runs inside Next.js 16.4.6 (`next build` + `next start`, and Turbopack dev) with no change to `next.config.ts`.
- **Result objects instead of exceptions** (`{ ok: true, value } | { ok: false, error: { category } }`): bad uploads are expected, not exceptional. The compiler forces the caller to handle failure, the category is safe to log and return (never a library message), and the function can never leak an error object. Errors are classified by `error.name` only, never by message.
- **Limits:** PDF 5 MiB (a CV is ~100 KB; room for embedded images), 10 pages (a CV is 1-2), 10 s extraction timeout (a hostile PDF must not hold a request; the work cannot be cancelled, only abandoned), at least 30 non-whitespace characters to count as "has text", job text 100 to 20 000 characters (under 100 there is nothing to analyse; 20 000 is far longer than any posting and bounds LLM cost). All are exported constants and can be overridden in tests.
- **Scanned PDFs** are images without a text layer: extraction returns almost nothing, so `hasExtractableText` is false and the app should ask the user to paste the text (`ExtractionMethod.MANUAL`). OCR is out of scope.
- **Test PDFs are generated in memory** (`src/lib/extractors/test-pdf-builder.ts`, fake text). No binary fixtures in the repo, nothing to review blindly, and no real CV can be committed by accident. `*.pdf` and `/fixtures-private/` are in `.gitignore` (for local manual experiments with real CVs).
- **Two levels of normalisation.** CV text (noisy PDF output) gets `cleanPdfText` (joins words hyphenated across a line break, a heuristic that can wrongly join a real hyphen such as `full-\nstack`) plus `normalizeText` (bullets to `- `, spaces collapsed). Pasted job text gets a LIGHT cleaning (`normalizeJobText`): control characters removed (NUL especially: Postgres cannot store it), line endings unified, trailing spaces trimmed, blank-line runs collapsed. Its line breaks and bullets are kept as pasted because the structure helps the LLM in Phase 2. `JobPost.rawText` therefore stores the validated, lightly normalised text, not a byte-identical paste (owner decision). Known limit: two-column CVs may come out interleaved (needs text item coordinates, later).
- **Prompt injection.** The pasted job text is untrusted input that will end up in an LLM prompt in Phase 2. It must be treated as DATA, never as instructions: clearly delimited in the prompt, and system instructions never built from it. The LLM output must always be validated with the zod schema before use (and "never invent experience" is checked against the CV data, not trusted to the model). The length and control-character validation here is NOT a defence against injection. The same applies, in a weaker form, to CV text (the user's own file, but a CV copied from elsewhere can carry hidden instructions, e.g. white text).
- **zod 4.6.7** for schemas (see `schemas.md`): lenient (`.nullish()`), capped sizes, unknown keys stripped, `schemaVersion` for future shape changes.

## Cover letter questions: the honest bridge (Task 6 extension)
- **Three question kinds.** `gap` (about a missing REQUIRED requirement), `followUp` (asked only when the user says they have no experience with its gap question) and `general` (not tied to a requirement). At most 6 questions are ever asked (`MAX_COVER_LETTER_QUESTIONS`; the mock's worst case is exactly 6).
- **Follow-ups are decided by pure code (`src/lib/result/question-flow.ts`), not by the model.** The rule "ask a follow-up only after `noExperience` on its parent" must always hold, so it is plain, testable logic. A `noExperience` answer on a non-gap question is invalid and ignored, so it cannot reveal anything.
- **Three answer outcomes:** `answered` (with text), `noExperience` (gap questions only) and `skipped`. `noExperience` counts as answered in the summary (it is a real outcome); a skipped follow-up counts as skipped.
- **Draft rules (`buildCoverLetter`):**

| Answer | What the letter gets |
| --- | --- |
| skipped, unanswered, or blank text | nothing (no claim, no placeholder) |
| `noExperience`, follow-up not answered | nothing: we never volunteer a weakness |
| `noExperience` + follow-up `answered` | `On <topic>: I have not done this yet. The closest I have done: <user text>` (a plain "not yet" sentence, only the user's words) |
| `answered` (gap or general) | `On <topic>: <user text>` |
| follow-up whose parent is not `noExperience` | ignored, even if an answer exists |

- **Never generic claims** ("fast learner", "passionate", "expert"...), and never a stronger claim than the user made. Why evidence over adjectives: a concrete example is verifiable and honest; "fast learner" is an empty claim anyone can write.
- **Verbatim copy is a MOCK rule.** In Phase 2 the letter may be rephrased for fluency but must never add facts or make a stronger claim than the user made.
- **The banned-phrase test is only a safety net, NOT a guarantee.** In Phase 2 the real safeguard is that the user reviews and edits the letter before downloading it.
- **Which gaps get a question (Phase 2):** the two most important missing REQUIRED requirements. The others stay in the match analysis and are left out of the letter (the mock: Kubernetes and Kafka are asked, Terraform is nice-to-have and is not).
- **`topic` field:** always a short noun phrase, capped at `COVER_LETTER_TOPIC_MAX_CHARS` (60), rendered as plain text. In Phase 2 it derives from the untrusted job posting. `isValidTopic` (non-empty, <= 60 code points, no control characters, no `<` or `>`) is what Phase 2 uses to reject or clamp model output.
- **Requirements for the Phase 2 prompt:**
  - Return at most 2 gap questions, only for missing required requirements, ordered by importance.
  - Each gap question needs a `topic` that is a noun phrase of at most 60 characters, plain text, no markup.
  - Follow-ups are not generated by the model: the code decides when they appear.
  - Draft: use only the CV and the user's answers; no generic claims; never a stronger claim than the user made; rephrase for fluency only.
  - The job posting is data, never instructions; the topic is never inserted as HTML or into instructions.

## Task 6 review fixes (frontend): see `ui.md`
- **Topic is capped where it is drawn (`displayTopic`).** Even if Phase 2 validates the topic, the render helper flattens whitespace and truncates to 60 code points (ellipsis included) so a long or multi-line topic can never break the layout or the button names. It is a last safety net, not a replacement for `isValidTopic`.
- **Focus after "Try again".** Focus parks on the small always-mounted status message (visible ring), not on a box around the whole result (that would draw a giant ring). When the load finishes, focus moves to the new state's own target (the error box or the first heading) only if it is still parked on the status, so it never falls to `<body>` and never steals focus on first load.
- **Persistent live region.** Screen readers announce a CHANGE inside a live region that already exists, not one created together with its text. So ResultView always renders one `role="status"` paragraph and only its text changes.
- **Sticky preview only on tall viewports.** Sticky needs `min-width: 1024px` (component) and `min-height: 40rem` (CSS). In short windows or at large text zoom it scrolls with the page, so the notice bar can never cover it.

## PDF template and download (Task 6.5): see `ui.md`
- **Generation location: the BROWSER, lazy import, no API route.** `generate-pdf.ts` calls `await import("@react-pdf/renderer")` inside the click path. Why: Phase 1 has no server work for documents, the data is already in the browser, nothing has to be uploaded (privacy), and there is no endpoint to validate, secure or pay for. Trade-offs: the library (large) is downloaded on first use and the work runs on the user's device; the real PDF depends on the browser's JS engine. If the bundler (Next / Turbopack) ever rejects react-pdf in the browser, the rule is STOP and report the options (for example an API route that renders on the server); do not switch silently, because that would send CV data to a server.
- **Library: `@react-pdf/renderer` pinned to exactly 4.9.0** (MIT; React 19 supported since 4.1.0). Exact version like Prisma: layout output must not drift. Alternative kept in `decisions.md` above: HTML + Playwright (heavier, needs a browser on the server).
- **Template: one fixed, ATS-friendly design** (single column, real text, standard fonts and headings, no tables, images or icons, no page numbers, A4, 18 mm margins). The LLM only supplies data. Section headings are fixed in ENGLISH on purpose: the target market is UK jobs, and a fixed list of standard headings is what ATS systems look for. A CV written in another language still gets English headings.
- **Fonts: Helvetica and Helvetica-Bold only**, the built-in PDF standard fonts (not embedded: small files, every reader has them). Discovery: react-pdf 4.9.0 draws characters outside the Western European set as WRONG characters WITHOUT any warning ("Łódź" became "Aódz"). So we DETECT AND BLOCK before generating (`supported-characters.ts`) and name the characters and sections to the user. No automatic replacement (ł to l): changing a person's name silently is worse than asking. Phase 2 path: embed a Unicode font (Noto Sans, SIL OFL). Until a full CV editing screen exists, a name with an unsupported character is a dead end (known limitation, documented in `ui.md`).
- **The supported set is proven, not assumed:** every character is rendered and read back in a test. It found that the micro sign "µ" reads back as the Greek "μ", so it is excluded; NBSP and the soft hyphen are normalised (space / removed).
- **Hyphenation is switched off** (`Font.registerHyphenationCallback((word) => [word])`): the default cuts long words ("expi-" / "alidocious") and the cut ends up in the text an ATS extracts.
- **Overflow: warn, never truncate or shrink.** CV with 3 or more pages (letter: more than 1) shows a warning with "Download anyway" and "Keep editing". Why: cutting content would lose the user's experience without asking, and shrinking the font hurts readability. The user decides.
- **Page count from the document's own render callback**, not from counting `/Type /Page` in the bytes. A `fixed` zero-impact Text receives `totalPages` from react-pdf's layout. Counting bytes is a guess about the file format and breaks with compressed object streams; the callback is the number the layout actually used, and a test checks it equals the real page count read back by the loader.
- **`URL.createObjectURL` exception.** The Task 5 ban was for the uploaded input file (never read), and stays. One exception: the generated output PDF, only in `generate-pdf.ts`, revoked one second after the click. A test enforces that no other file in `src/components/pdf` or `src/components/result` uses it.
- **Characters are checked first, library second.** The check is pure and instant, so a blocked download never pays for loading react-pdf.
- **Failures are categories, never messages.** `generate-pdf.ts` returns `{ ok: false, error: { category: "generation_failed" } }` (the shared `Result` type) and drops the caught error: library errors can contain pieces of the document. Nothing is downloaded after a failure.
- **A nested `package.json` (`{"type": "module"}`) in `src/components/pdf/`.** react-pdf and its hyphenation package are ES modules; tsx loads `.ts` files as CommonJS by default and then fails to resolve react-pdf's subpath imports. The nearest `package.json` decides, so this small file makes only that folder ES-module for tests. Alternative: change the root `package.json` or the test script (shared files, affects every test) or write the tests as `.mts` (the `npm test` glob would not find them). It has no effect on the Next.js build.
- **Supersedes** the Task 6 "inert `aria-disabled` download buttons with a coming soon note": the buttons are real now. `aria-disabled` stays, but only while a PDF is being prepared (so a second click does nothing and the button keeps focus).
