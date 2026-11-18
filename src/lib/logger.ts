// Application logger (pino). Import `logger` in server code. See docs/wiki/ops.md.
//
// PRIVACY RULES (CLAUDE.md):
// 1. Log only ids, sizes, durations, token counts and status. NEVER CV or job posting content.
// 2. NEVER pass a caught error object to the logger, and never put error.message in a
//    log message. Driver errors can contain the connection string or user data.
//    Log a safe category instead, e.g. logger.error({ errorCategory: "timeout" }, "...").
//    As a second line of defence the serializers below strip any error down to its type name.
// 3. Redaction below works by FIELD NAME. It cannot spot an email written inside a
//    sentence, so never build a message string out of user data.

import pino, { type DestinationStream, type Logger } from "pino";

const DEFAULT_LEVEL = "info";

/** Reads LOG_LEVEL; falls back to "info" if it is missing or not a real pino level. */
function resolveLevel(value: string | undefined): string {
  const level = value?.trim().toLowerCase();
  if (level && (level === "silent" || level in pino.levels.values))
    return level;
  return DEFAULT_LEVEL;
}

// Field names that must never reach a log line. Each name is also matched one and two
// levels deep ({ user: { email } }, { a: { b: { email } } }), because pino's "*" matches one level.
const SENSITIVE_FIELDS = [
  // secrets
  "password",
  "token",
  "secret",
  "apiKey",
  "authorization",
  "cookie",
  "DATABASE_URL",
  "databaseUrl",
  "connectionString",
  // personal data
  "email",
  "phone",
  // fields that hold CV or job posting content (see prisma/schema.prisma)
  "rawText",
  "data",
  "tailoredCv",
  "analysis",
  "coverLetter",
  "cvText",
  "jobText",
  "text",
  // text extracted from a PDF (the loader result has `pages: [{ text }]`) and pasted job text
  "pages",
  "extractedText",
  "pastedText",
];

const REDACT_PATHS = [
  ...SENSITIVE_FIELDS.flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
  // Header names contain dashes, so they need bracket syntax.
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  'headers["set-cookie"]',
];

// Any error under the "err" or "error" key is reduced to its type name: no message, no stack.
const stripError = (value: unknown) => ({
  type: value instanceof Error ? value.name : "NonError",
});

/**
 * Builds a logger. `destination` is only for tests (to capture the output).
 * - development: human-readable output through pino-pretty
 * - everything else (production, tests): one JSON object per line on stdout
 */
export function createLogger(destination?: DestinationStream): Logger {
  const options = {
    level: resolveLevel(process.env.LOG_LEVEL),
    base: undefined, // drop pid and hostname from every line
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    serializers: { err: stripError, error: stripError },
  };

  if (!destination && process.env.NODE_ENV === "development") {
    return pino({
      ...options,
      transport: { target: "pino-pretty", options: { colorize: true } },
    });
  }
  return pino(options, destination);
}

export const logger = createLogger();
