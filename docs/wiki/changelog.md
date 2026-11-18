# Changelog

One line per task: date, what changed.

- 2026-11-10 - Task 1: scaffolded Next.js (App Router, TypeScript strict, Tailwind, ESLint, `src/`), added Prettier, fixed `.gitignore` for `.env.example`, renamed `Claude.md` to `CLAUDE.md`, created `architecture.md`.
- 2026-11-10 - Task 2: Postgres 18 in Docker (`docker-compose.yml`, host port 5433), `.env`/`.env.example`, Prisma 7.10.1 initialised with no models, `npm run db:check` script.
- 2026-11-13 - Task 3: Prisma schema with User, Cv, JobPost, Application (uuid ids, jsonb data, cascade deletes, `expiresAt`), first migration `create_core_models`, scripts `db:migrate` and `db:studio`, new `database.md`.
- 2026-11-17 - Task 4: shared Prisma client (`src/lib/db.ts`), pino logger with redaction (`src/lib/logger.ts`), `GET /api/health` (DB check, 2 s timeout, never cached), privacy test (`npm test`), new `ops.md`.
- 2026-11-18 - Setup: four Claude Code subagents in `.claude/agents/` (`infra-db`, `frontend`, `backend`, read-only `reviewer`); `CLAUDE.md` gets a workflow section (branch per task, PRs to `main`, reviewer before merge) and an `AGENTS.md` pointer. No application code changed.
