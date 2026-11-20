// Single source of truth for the input limits.
// NO imports on purpose: client components can import this file without pulling server
// code (pino, unpdf) into the browser bundle. Keep it constants only.

// 5 MiB: far above a normal CV (~100 KB).
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

// Below ~100 characters there is nothing to analyse (a title alone is not a posting).
export const MIN_JOB_TEXT_CHARS = 100;
// 20 000 characters is about 3 000-4 000 words: longer than any real posting, and it
// bounds the LLM cost of one request.
export const MAX_JOB_TEXT_CHARS = 20_000;

// CV text limits (in characters). Shared by the CV zod schema and by the edit form, which
// must not import zod, so they live here.
export const CV_SUMMARY_MAX_CHARS = 2000; // the professional summary
export const CV_ACHIEVEMENT_MAX_CHARS = 600; // one experience bullet
export const CV_SHORT_TEXT_MAX_CHARS = 100; // a single skill, a language level, a link label

// Cover letter question topic: a short noun phrase such as "running services on Kubernetes".
// In Phase 2 it derives from the untrusted job posting, so its length is capped.
export const COVER_LETTER_TOPIC_MAX_CHARS = 60;
