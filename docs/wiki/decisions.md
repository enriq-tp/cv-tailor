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
