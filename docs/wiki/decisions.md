# Decisions

Format: decision, why, alternatives considered.

## Next.js + TypeScript for frontend and backend
- Why: one language and one project for UI and API; phases 2 and 3 add to it without a rewrite.
- Alternatives: Gradio (good for ML demos, weak for auth and custom flows); separate React + FastAPI (more moving parts).

## Postgres in Docker for local development
- Why: same engine as production, reproducible with one command, no cloud dependency while developing.
- Alternatives: Supabase/Neon from day one (kept for production hosting).

## Prisma as ORM
- Why: schema defined in TypeScript-friendly format, generated types, migrations.

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
