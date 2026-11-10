# CV Tailor

Web app: the user uploads a CV and pastes a job posting. The app adapts the CV to the job and guides the user through writing a cover letter.

This is a portfolio project. The owner must be able to explain every part of it in an interview. Prefer simple, readable code over clever code.

## Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind
- Postgres in Docker (docker-compose) + Prisma
- LLM calls via the Claude API (Phase 2, server-side only)
- Auth.js for accounts (Phase 3)
- Logging with pino; Sentry, Langfuse, Prometheus/Grafana later
- Dev OS: Windows (Docker Desktop + WSL2). Give PowerShell-compatible commands.

## Phases

1. **Phase 1 - Prototype:** UI with mocked data, Docker Postgres, Prisma schema, pino logs, `/api/health`.
2. **Phase 2 - Real model:** orchestrator in `src/agents/`, Claude API, Sentry, Langfuse.
   - 2.5 (after Phase 2 works with the LLM alone): Python FastAPI microservice with a sentence-embedding encoder for CV-vs-job matching, compared against the LLM-only approach with a small evaluation set.
3. **Phase 3 - Accounts:** Auth.js, per-user CVs and applications, Prometheus/Grafana.

## Data flow

PDF -> text loader (`src/lib/extractors/`) -> cleaning -> LLM extracts structured JSON (zod schema) -> match against job posting JSON -> LLM rewrites only the JSON data -> fixed PDF template (`@react-pdf/renderer`) -> PDF.

- The LLM never decides layout in production. Layout lives in one fixed, ATS-friendly template (single column, standard fonts, selectable text, max 1-2 pages).
- The LLM must not invent experience. If the job asks for something missing from the CV, ask the user instead.
- The user reviews the tailored CV before download.

Only work on the current phase. Do not add features from later phases.

## How to work

- One task at a time. Finish it, tell me how to verify it, and stop.
- Before a task that touches more than 2 files, propose a short plan and wait for approval.
- Briefly explain the "why" of each decision. I want to learn, not just receive code.
- Read `docs/wiki/index.md` first. Load only the wiki pages relevant to the task.
- After each task: update the relevant wiki page and `docs/wiki/changelog.md`.
- Do not install new dependencies without saying why.
- Never commit `.env`. Keep `.env.example` up to date.

## Privacy rules (hard rules)

- A CV is personal data. NEVER write CV or job posting content to logs, traces or error reports.
- Log only IDs, sizes, durations, token counts and status.
- The Claude API key lives only on the server. Never expose it to the client.

## Conventions

- Code, comments, commits and docs in English.
- Commits: conventional style (`feat:`, `fix:`, `docs:`, `chore:`).
- Server logic in `src/lib/` and `src/agents/`; UI components in `src/components/`.
- Validate all API inputs (zod).