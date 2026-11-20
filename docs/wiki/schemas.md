# Schemas and input limits

Code: `src/lib/schemas/` (`cv.ts`, `job-posting.ts`, `index.ts`), `src/lib/text/validate-job-text.ts`, `src/lib/extractors/pdf-loader.ts`. Tests sit next to the code (`npm test`). Library: zod 4.6.7 (`import * as z from "zod"`).

## Cv (`CvSchema`)

The structured CV. Stored in `Cv.data` and, after tailoring, in `Application.tailoredCv` (same schema). Almost every field is optional (`.nullish()` = missing, `null` or a value). Arrays default to `[]`. Max sizes are in characters / items.

| Field                       | Type                          | Max                         |
| --------------------------- | ----------------------------- | --------------------------- |
| `schemaVersion`             | literal `1`, default `1`      |                             |
| `contact.fullName`          | string, optional              | 200                         |
| `contact.email`             | string, optional (no format check) | 200                    |
| `contact.phone`             | string, optional              | 100                         |
| `contact.location`          | string, optional              | 200                         |
| `contact.links[]`           | `{ label, url }` strings      | 10 items; label 100, url 500 |
| `summary`                   | string, optional              | 2000                        |
| `experience[]`              | `{ company, title, location, startDate, endDate, isCurrent, achievements[] }` | 30 items |
| `experience[].achievements` | string[]                      | 20 items of 600             |
| `experience[]` strings      | company, title, location 200; dates 40; `isCurrent` boolean |      |
| `education[]`               | `{ institution, degree, field, startDate, endDate }` | 20 items; texts 200, dates 40 |
| `skills`                    | string[]                      | 100 items of 100            |
| `languages[]`               | `{ name, proficiency }`       | 20 items; 100 each          |
| `projects[]`                | `{ name, description, url, technologies[] }` | 20 items; name 200, description 1000, url 500, 30 technologies of 100 |

`contact` itself is never missing after parsing (`prefault({})`), so `contact.links` is always an array.

## JobPosting (`JobPostingSchema`)

The structured **result** of analysing the pasted job text (Phase 2). It is NOT an input format: the user pastes plain text, validated by `validateJobText`, and the LLM analysis produces this JSON, stored in `JobPost.analysis`.

| Field                     | Type                                                           | Max                |
| ------------------------- | -------------------------------------------------------------- | ------------------ |
| `schemaVersion`           | literal `1`, default `1`                                       |                    |
| `title`, `company`, `location` | string, optional                                          | 200                |
| `seniority`               | `intern` / `junior` / `mid` / `senior` / `lead` / `principal` / `executive`, optional | |
| `requirements.required`   | string[] (default `[]`)                                        | 50 items of 600    |
| `requirements.niceToHave` | string[] (default `[]`)                                        | 50 items of 600    |
| `responsibilities`        | string[]                                                       | 50 items of 600    |
| `keywords`                | string[]                                                       | 50 items of 100    |

`requirements` is never missing after parsing (`prefault({})`).

## Design decisions

- **Dates are strings** ("2021-03", "2021", "Present", max 40). A JSON column cannot hold a `Date` (it would become a string anyway), and CVs use many formats. The PDF template just prints them.
- **Almost everything is optional.** Data extracted by an LLM from messy text is incomplete. A CV without a phone number or a job posting without a location must still be valid. Required fields would turn small gaps into hard errors. Strings are not format-checked (no email regex) for the same reason; check formats where a form needs them.
- **Max sizes everywhere.** A wrong or hostile LLM answer cannot store megabytes in the database or overflow the one-page template.
- **Unknown keys are stripped** (default `z.object`), not rejected. If the LLM invents one extra key, the document is still valid and the key is dropped. A strict object would throw away a whole CV for one stray key.
- **`schemaVersion`.** Json columns have no migrations: rows written today keep their shape forever. When the schema changes, the version number tells the code which shape a row has (and a migration function can upgrade old rows when they are read).
- **Input vs output type.** `z.infer<typeof CvSchema>` (`Cv`) is the type AFTER parsing: defaults are applied, so arrays are required. `z.input<typeof CvSchema>` (`CvInput`) is what may be passed IN: arrays optional. Use `Cv` for code that works with parsed data and `CvInput` for building one by hand. Same for `JobPosting` / `JobPostingInput`.

## Prisma Json compatibility

Checked in `src/lib/schemas/schemas.test.ts`:

- **Compile time:** a parsed `Cv` and a parsed `JobPosting` are assigned to `Prisma.InputJsonValue` (imported as a type from `generated/prisma/client`). If a schema ever gets a field that Json cannot hold (`Date`, `undefined` in a required position, a function), `npm run build` fails on that line. It passes today for `Cv.data`, `Application.tailoredCv` (both `Cv`) and `JobPost.analysis` (`JobPosting`). `prisma/` was not changed.
- **Runtime:** `JSON.parse(JSON.stringify(parsed))` deep-equals `parsed` for a full document, a sparse document and `{}`. Zod does not add keys with `undefined` values, so what is stored equals what was parsed.
- Reading back: `Cv.data` is typed `JsonValue` by Prisma. Always run it through `CvSchema.parse` (or `safeParse`) when reading, because the database does not enforce the shape.

### Overlap: title and company

`JobPost.title` and `JobPost.company` are columns, and `analysis.title` / `analysis.company` hold the same information. The app must write both from the same source (the parsed analysis) in the same operation, so they cannot disagree.

### Extraction method

The PDF loader is the producer of `ExtractionMethod.PDF_TEXT`. `PDF_LLM` is not produced by this loader, and `MANUAL` is what is used when the PDF has no text layer (`hasExtractableText: false`) and the user pastes the text instead.

## Input limits and result objects

Both input functions return `{ ok: true, value }` or `{ ok: false, error: { category } }` (`src/lib/result.ts`); they do not throw for expected problems.

| Input         | Function         | Limits                                                      | Categories |
| ------------- | ---------------- | ----------------------------------------------------------- | ---------- |
| PDF file (CV) | `loadPdf`        | 5 MiB, 10 pages, 10 s, at least 30 non-whitespace characters for `hasExtractableText` | `empty`, `not_a_pdf`, `corrupt`, `encrypted`, `too_large`, `too_many_pages`, `timeout`, `unknown` |
| Pasted job text | `validateJobText` | 100 to 20 000 characters (code points) after cleaning     | `empty`, `too_short`, `too_long` |

The PDF size and job text length limits are defined in `src/lib/limits.ts` (no imports, so client components can use them) and re-exported by `pdf-loader.ts` and `validate-job-text.ts`.

Both log only sizes, counts, durations and the category (see `ops.md`).

### What is stored in `JobPost.rawText`

The **validated, lightly normalised** text returned by `validateJobText`, not a byte-identical copy of the paste:

1. Control characters are removed (all C0 controls except `\n`, `\t`, plus DEL). **NUL (U+0000) must go because Postgres `text` columns cannot store it**: the insert would fail.
2. Line endings become `\n`, trailing spaces are trimmed on every line, 3+ newlines become one blank line, the whole text is trimmed.
3. Line breaks, bullet characters (`•`, `-`, `*`, `◦`) and spaces inside a line are kept exactly as pasted, and nothing is joined or rewritten. The structure helps the LLM understand the posting.

The CV path is different on purpose: `cleanPdfText` (hyphenated line-break joining) followed by `normalizeText` (bullets become `- `, spaces collapsed), because PDF extraction produces much noisier text. The CV raw text is never stored.
