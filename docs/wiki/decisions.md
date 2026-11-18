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
