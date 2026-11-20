# Changelog

One line per task: date, what changed.

- 2026-11-10 - Task 1: scaffolded Next.js (App Router, TypeScript strict, Tailwind, ESLint, `src/`), added Prettier, fixed `.gitignore` for `.env.example`, renamed `Claude.md` to `CLAUDE.md`, created `architecture.md`.
- 2026-11-10 - Task 2: Postgres 18 in Docker (`docker-compose.yml`, host port 5433), `.env`/`.env.example`, Prisma 7.10.1 initialised with no models, `npm run db:check` script.
- 2026-11-13 - Task 3: Prisma schema with User, Cv, JobPost, Application (uuid ids, jsonb data, cascade deletes, `expiresAt`), first migration `create_core_models`, scripts `db:migrate` and `db:studio`, new `database.md`.
- 2026-11-17 - Task 4: shared Prisma client (`src/lib/db.ts`), pino logger with redaction (`src/lib/logger.ts`), `GET /api/health` (DB check, 2 s timeout, never cached), privacy test (`npm test`), new `ops.md`.
- 2026-11-18 - Setup: four Claude Code subagents in `.claude/agents/` (`infra-db`, `frontend`, `backend`, read-only `reviewer`); `CLAUDE.md` gets a workflow section (branch per task, PRs to `main`, reviewer before merge) and an `AGENTS.md` pointer. No application code changed.
- 2026-11-18 - Task 4.5: PDF text loader (`unpdf`, result object, limits, in-memory test PDFs), CV/job text cleaning, job text validator, zod schemas for the CV and the job posting analysis, logger redacts `pages`/`extractedText`/`pastedText`, `*.pdf` git-ignored, new `schemas.md`.
- 2026-11-19 - Task 5 step 1: shared `src/lib/limits.ts` (PDF size and job text limits, no imports, client-safe); `pdf-loader.ts` and `validate-job-text.ts` re-export them; stale comment fixed.
- 2026-11-19 - Task 5: input screen with mocked data (`/`: CV drop zone as a paper sheet, job notepad, `aria-disabled` button) and placeholder `/result`; fonts Bricolage Grotesque + Public Sans; light-only palette; client validation with tests; new `ui.md`. NOTE: these phrases are only true while mocked and will stop being true in Phase 2: "Nothing leaves your browser in this version" (home page), "Ready. Nothing is uploaded yet." (form helper text) and "Nothing was processed." (result page). Before changing any, search the code for "Nothing" and review every match.
