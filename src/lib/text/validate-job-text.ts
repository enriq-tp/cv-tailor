// Validation of the pasted job posting TEXT (the job posting is not a PDF).
// The returned `text` is what will be stored in JobPost.rawText: it is the validated,
// lightly normalised text (control characters removed, line endings unified, trailing
// spaces trimmed, blank lines collapsed), not the byte-identical paste. Line breaks and
// bullets are preserved because that structure helps the LLM in Phase 2.
//
// SECURITY NOTE: checking length and control characters is NOT a defence against prompt
// injection. The text is untrusted and must be treated as data in the Phase 2 prompt
// (see docs/wiki/decisions.md).
//
// PRIVACY: we log only { charCount, errorCategory }. Never the text.

import type { Logger } from "pino";
import { logger as defaultLogger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { normalizeJobText } from "@/lib/text/normalize-text";

// The limits live in `@/lib/limits` (client-safe); re-exported so existing imports work.
import { MAX_JOB_TEXT_CHARS, MIN_JOB_TEXT_CHARS } from "@/lib/limits";
export { MAX_JOB_TEXT_CHARS, MIN_JOB_TEXT_CHARS };

export type JobTextErrorCategory = "empty" | "too_short" | "too_long";

export type JobTextResult = Result<
  { text: string; charCount: number },
  { category: JobTextErrorCategory }
>;

export type ValidateJobTextOptions = {
  minChars?: number;
  maxChars?: number;
  /** Only for tests, to capture what gets logged. */
  logger?: Logger;
};

// C0 control characters except tab (\t), line feed (\n) and carriage return (\r, which
// normalizeJobText turns into \n), plus DEL. This includes NUL (U+0000): Postgres text
// columns cannot store it.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function validateJobText(
  raw: unknown,
  options: ValidateJobTextOptions = {},
): JobTextResult {
  const {
    minChars = MIN_JOB_TEXT_CHARS,
    maxChars = MAX_JOB_TEXT_CHARS,
    logger = defaultLogger,
  } = options;

  const fail = (
    category: JobTextErrorCategory,
    charCount: number,
  ): JobTextResult => {
    logger.warn({ charCount, errorCategory: category }, "job text rejected");
    return { ok: false, error: { category } };
  };

  // Not a string (undefined, number, object...) counts as empty: nothing usable was sent.
  if (typeof raw !== "string") return fail("empty", 0);

  // Cheap early reject: do not run regexes over a huge string. Cleaning only removes
  // characters, so a string over 2x the limit is almost certainly still too long.
  if (raw.length > maxChars * 2) return fail("too_long", raw.length);

  // Light cleaning only: the line breaks and bullets are kept as pasted.
  const text = normalizeJobText(raw.replace(CONTROL_CHARS, ""));
  const charCount = [...text].length; // code points, so an emoji counts as 1

  if (charCount === 0) return fail("empty", 0);
  if (charCount < minChars) return fail("too_short", charCount);
  if (charCount > maxChars) return fail("too_long", charCount);

  logger.info({ charCount }, "job text accepted");
  return { ok: true, value: { text, charCount } };
}
