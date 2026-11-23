# Phase 1 closing checklist

Written in Task 7 (2026-11-23). It states what was verified, how, and what was NOT verified, so nobody has to guess what "done" means. Nothing here is a promise about the code beyond what is listed under "Verified".

## Verified

Each item says how it was checked.

**The same steps CI runs, on a clean copy of the final working tree** (scratch folder outside the project, no `.env`, no `DATABASE_URL` except the fake one in the build step; run on Windows, 2026-11-23):

- `npm ci`: passes with the new lockfile.
- `npm run db:generate`, `npm run lint`, `npm run format:check`: pass (after `prettier --write`, which only changed line endings in the 101 existing files).
- `npm test`: 211 of 211 pass.
- `npm run build`: passes with the fake `DATABASE_URL`. FAILS without it (reproduced): see the coupling in `decisions.md`.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities (with the `effect` override).

**The `effect` override against the real Docker database** (clean copy, `npm ci` from the new lockfile): `npm ls effect` shows 3.22.5, `npm run db:generate`, `npm run db:check` and `npx prisma migrate status` ("Database schema is up to date") succeed, 211 of 211 tests pass. Details and how to remove it: `decisions.md`, "Known issues and accepted risks".

**Line endings:** `git add --renormalize` on the real repository produces an identical tree (measured with a temporary index; nothing was staged), so `.gitattributes` changes no repository content.

**Earlier tasks (recorded in their own task reports and wiki pages):**

- `/api/health`: 200 with the database up, 503 `connection` with the container stopped, 503 `timeout` with an unreachable host, recovery after restart; no secret in the logs (Task 4).
- Logger redaction: a privacy test fails when a field leaks (the redaction was removed on purpose once to prove it) (Task 4).
- PDF loader, text cleaning, job text validation and zod schemas have tests; `unpdf` bundles and runs inside Next.js dev and production builds (checked with a temporary route, since deleted) (Task 4.5).
- Client code contains no `console.*`, `localStorage`, `sessionStorage`, `fetch` or logger/db imports; `createObjectURL` appears only in `src/components/pdf/generate-pdf.ts`; the PDF template tests render real PDFs and read them back with the project's own loader (reading order, accents, every supported character, long words, page count, metadata) (Tasks 5, 6, 6.5).
- No `pino`, `unpdf` or zod markers in the browser bundle after Task 6 (case-sensitive search of `.next/static`).

## Not verified

**Only GitHub can verify (the first CI run):**

- That the workflow file is accepted and runs: syntax was checked only by parsing the YAML and reading it. The `concurrency` expression and the `timeout-minutes` default were not confirmed in the parts of the GitHub docs that were available word for word (the rest came from a summary).
- Qualifier to remove: the README says "CI on GitHub Actions (configured; first run pending)". Remove "(configured; first run pending)" once the first CI run is green.
- Linux at run time: the lockfile contains the Linux binaries (Next SWC, Tailwind oxide, lightningcss, esbuild, sharp) and `npm ci` passes on Windows, but nothing has run on Ubuntu yet.
- That `actions/setup-node` installs Node 24 on `ubuntu-24.04` and caches npm; that the two pinned SHAs resolve on GitHub.
- Dependabot: its first pull requests (how it treats exact-pinned versions in `package.json`, whether the grouping and the Prisma ignore rules work).
- `ubuntu-26.04` was not checked (Node and Docker on that image are unknown).

**Never checked in a browser (no browser tool was available in any task):**

- Visual layout at 360 px and at 1280 px, including 768 to 1024 px with long file names; no horizontal scroll.
- Keyboard-only use, focus rings and focus placement after actions, drag and drop, reduced motion, 200% zoom with the sticky notice and the sticky CV preview.
- Screen reader announcements (live regions, errors, the follow-up question announcement).
- How the generated PDFs look in Acrobat, Chrome, Firefox and macOS Preview; text selection and copy in each; the real browser download and its file name.
- That react-pdf stays out of the initial JavaScript of `/result` (the commands were given in the Task 6.5 report; the result was not confirmed in this project's records).

**PDF generation (CV and cover letter):**

- Verified by tests (the template tests render real PDFs and read them back with the project's own loader) and by reading the code.
- Pending until the owner confirms them: the production build with react-pdf (`npm run build` with the dev server stopped) and the manual check in a browser (download, file name, how the PDFs open and look in real readers).

**Not exercised with real data:**

- Encrypted PDFs (only the error classifier is tested, with a fake error), scanned PDFs (simulated by a blank page) and two-column CVs. No real CV was ever used.
- Anything that writes to the database: no code does yet, and no integration test touches Postgres.
- A deployment: Node 24 on a host, and a step that runs `prisma migrate deploy` (needs the CLI, so dev dependencies).

## Known limitations carried into Phase 2

- A CV with a character Helvetica cannot show (for example "Ł") cannot be downloaded, and there is no screen yet to edit it. The Phase 2 path is an embedded Unicode font (`decisions.md`).
- `src/lib/db.ts` throws at import time without `DATABASE_URL`, which forces a fake value in CI and a `.env` before building. Follow-up for the `infra-db` agent: make the connection lazy.
- The `effect` override replaces Prisma's own pin and has not been tested by Prisma. Remove it when Prisma ships a patched release.
- The mock result, its notices and the sentence "Nothing leaves your browser in this version" must be replaced or removed in Phase 2; the full phrase list is in `ui.md` (note a).

## To do by hand (cannot be done from the repository)

- Add the screenshot (instructions in the README comment: synthetic data only).
- On GitHub: enable Dependabot alerts and security updates, and require the CI check before merging into `main`.
- Read the first CI run and the first Dependabot pull requests.
