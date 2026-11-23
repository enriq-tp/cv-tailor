# CV Tailor

A web app where you upload your CV as a PDF and paste a job posting. It adapts the CV to the job (you accept, reject or edit every suggested change) and guides you through a cover letter without ever inventing experience you do not have.

<!--
  SCREENSHOT PLACEHOLDER (add it by hand, do not generate one):
  1. Open the result screen (/result) in the running app. Its sample data is synthetic.
  2. The image MUST show synthetic data only: never your real CV, your real name, your email
     or a real file name. Do NOT capture the input screen (/) with a real file selected,
     because it shows the file name.
  3. Save it as docs/images/result-screen.png.
  4. Replace the "Screenshot: not added yet" line below with:
     ![CV Tailor result screen with sample data](docs/images/result-screen.png)
-->

_Screenshot: not added yet._

## Status: a prototype (Phase 1)

This is an honest prototype. Some parts are real and some are mocked.

**Real and working**

- The input screen: PDF upload area and job posting box with client-side validation (PDF only, up to 5 MiB; job text 100 to 20,000 characters).
- The result screen: match analysis, a review of suggested changes (accept, reject or edit each one, with a live CV preview) and a guided cover-letter conversation. The questions are optional, and a skipped question never adds a claim to the letter.
- PDF generation: a fixed, ATS-friendly template (single column, standard font, real selectable text). The CV and the cover letter are generated **in your browser** and downloaded; nothing is uploaded.
- Server building blocks, tested but not connected to the screens yet: a PDF text loader with limits, text cleaning, job text validation, and zod schemas for the CV and the job posting.
- Infrastructure: Postgres schema (Prisma), a `/api/health` endpoint, structured logging that redacts personal data, and CI on GitHub Actions (configured; first run pending).

**Mocked**

- The analysis (match, suggested changes, questions, draft) comes from fixed, invented data in `src/lib/mock/`. It does not depend on what you upload, and the result screen always says so: "Sample result: this is demo data, not based on your CV."

**Not built yet**

- Your CV file is not read or sent anywhere in this version: the screen only checks its type and size. Nothing is written to the database. There are no accounts and no LLM calls.

**What becomes real in Phase 2:** the CV is uploaded to the server, text is extracted, and the Claude API (called only from the server) extracts structured data, matches it to the job and rewrites it. The mock, the "demo" notices and the sentence "Nothing leaves your browser in this version" go away. Details are in the [roadmap](#roadmap).

## How it works

Target flow (what the code is built for):

```
PDF -> text loader -> cleaning -> LLM extracts structured JSON (zod) -> match against the
job posting -> LLM rewrites ONLY the JSON -> fixed PDF template -> PDF
```

Two rules shape everything:

- **The LLM never decides layout.** The layout lives in one fixed template, so the output is predictable and readable by ATS (applicant tracking) software.
- **The LLM must not invent experience.** If the job asks for something the CV does not show, the app asks you. If you say you do not have it, the letter only says so plainly, using your own words.

What runs today: input screen -> `/result` (mocked analysis) -> review -> PDF download in the browser.

## Stack

| Choice                                        | Why                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Next.js 16 (App Router) + TypeScript (strict) | One language and one project for UI and API; later phases add to it without a rewrite.                   |
| Tailwind CSS 4                                | Styling next to the markup; small CSS output.                                                            |
| Postgres 18 in Docker + Prisma 7              | Same engine as production, one command to start; typed queries and migrations. Prisma is pinned exactly. |
| zod                                           | Validates every input and, later, the LLM's JSON answers.                                                |
| `unpdf`                                       | Extracts text from PDFs in Node without native dependencies.                                             |
| `@react-pdf/renderer`                         | Builds the PDF from one fixed template, in the browser, with real text.                                  |
| pino                                          | Structured logs with built-in redaction of personal data.                                                |
| `node:test` + `tsx`                           | Tests with no extra test runner.                                                                         |
| GitHub Actions + Dependabot                   | Lint, format, test and build on every pull request; weekly dependency updates.                           |

The reasoning and the alternatives considered for each choice are in [docs/wiki/decisions.md](docs/wiki/decisions.md).

## Run locally

**Requirements:** Node.js 24 or higher (`node -v`) and Docker Desktop (for the Postgres container). The screens work without the database; only `/api/health` and the database scripts need it.

**1. Install the dependencies**

```
npm ci
```

**2. Create your `.env`** from the template, then edit it: replace every `change_me`, using the same password in `POSTGRES_PASSWORD` and inside `DATABASE_URL`. `.env` is git-ignored and must never be committed.

PowerShell (Windows):

```powershell
Copy-Item .env.example .env
```

Unix shell (macOS, Linux, Git Bash):

```bash
cp .env.example .env
```

> `.env` must exist before `npm run build` or `npm start`: `src/lib/db.ts` throws at import time when `DATABASE_URL` is missing, and `next build` imports `/api/health`. (CI uses an obviously fake value.)

**3. Start the database** (the container is called `cv-tailor-db`, reachable only from your PC on port 5433)

```
docker compose up -d
```

Wait until `docker compose ps` shows the container as `healthy`.

**4. Create the tables and the Prisma client**

```
npx prisma migrate deploy
npm run db:generate
```

**5. Start the app**

```
npm run dev
```

Open <http://localhost:3000>. Optional checks: `npm run db:check` (connects and runs `SELECT 1`) and <http://localhost:3000/api/health>.

To see the error screen of the result page in development only, open `/result?demo=error` (it is ignored in a production build).

## Scripts

| Command                | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run dev`          | Starts the development server.                                        |
| `npm run build`        | Builds for production (needs `.env`, see above).                      |
| `npm start`            | Runs the production build.                                            |
| `npm run lint`         | ESLint.                                                               |
| `npm run format`       | Prettier, rewrites files.                                             |
| `npm run format:check` | Prettier, only checks.                                                |
| `npm test`             | Runs all tests (`node:test` through `tsx`).                           |
| `npm run db:check`     | Connects to Postgres through Prisma and runs `SELECT 1`.              |
| `npm run db:generate`  | Generates the Prisma client into `generated/prisma` (git-ignored).    |
| `npm run db:migrate`   | Creates and applies a migration after editing `prisma/schema.prisma`. |
| `npm run db:studio`    | Opens Prisma Studio in the browser.                                   |

## Privacy

A CV is personal data, so these are hard rules:

- **Nothing is stored yet.** No code writes to the database, and the uploaded file is never read in this version.
- **Never logged:** CV text, job posting text and cover-letter answers. Only ids, sizes, durations, token counts and status are logged, and the logger additionally redacts known personal-data fields. A test proves it.
- **Errors are reduced to a safe category** before they are logged or shown, because a library message can contain pieces of a document.
- **PDFs are generated in the browser.** No request is made when you download.
- **The Claude API key will live only on the server.** No key is used yet.

More in [docs/wiki/ops.md](docs/wiki/ops.md) and [docs/wiki/database.md](docs/wiki/database.md).

## Repository structure

```
src/app/          pages and layouts (/ and /result) and the only API route (/api/health)
src/components/   UI components, the PDF template (pdf/) and the result screen (result/)
src/lib/          server logic: PDF loader, text cleaning, schemas, logger, database client,
                  the mock service (mock/) and result logic (result/)
prisma/           database schema and migrations
scripts/          database check script (npm run db:check)
docs/wiki/        the project wiki: architecture, decisions, UI, schemas, ops, changelog
.github/          CI workflow and Dependabot configuration
```

Start with [docs/wiki/index.md](docs/wiki/index.md): one line per wiki page.

## Quality checks

Every pull request to `main` runs the same steps as a clean machine: install, generate the Prisma client, lint, format check, tests, build and an audit of the production dependencies (see [.github/workflows/ci.yml](.github/workflows/ci.yml)). Run the same checks locally with `npm run lint`, `npm run format:check`, `npm test` and `npm run build`.

## Roadmap

1. **Phase 1, prototype (this repository today):** UI with mocked analysis, real PDF template, Docker Postgres, Prisma schema, logging, health check, CI.
2. **Phase 2, real model:** an orchestrator in `src/agents/` that calls the Claude API from the server, with error reporting (Sentry) and LLM tracing (Langfuse). The CV is uploaded, the result is stored and addressed by an id.
   - **2.5, encoder matching:** a Python FastAPI microservice with a sentence-embedding model to match CV achievements to job requirements, compared against the LLM-only approach on a small evaluation set.
3. **Phase 3, accounts:** Auth.js, per-user CVs and applications, metrics with Prometheus and Grafana.
4. **Phase 4, fine-tuning:** an idea, not planned in detail yet.
