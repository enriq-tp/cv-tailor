// GET /api/health: tells a human or a monitor whether the app can reach its database.
// See docs/wiki/ops.md.
//
// SAFETY RULES for this file:
// - Never pass a caught error to the logger or put its message/stack in the response.
//   Database errors can contain the connection string or credentials.
//   Only a safe category ("timeout" | "connection" | "unknown") leaves this file.
// - The response must be computed on every request, never served from a cache.

import { connection } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const DB_TIMEOUT_MS = 2000; // the health check must answer quickly, even if the database does not

type ErrorCategory = "timeout" | "connection" | "unknown";

class HealthTimeoutError extends Error {}

/** Rejects if `promise` takes longer than `ms`. The timer is always cleared. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HealthTimeoutError()), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Maps any error to a safe category. Looks only at the error code, never at the message. */
function categorize(error: unknown): ErrorCategory {
  if (error instanceof HealthTimeoutError) return "timeout";
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string") return "unknown";
  if (["ETIMEDOUT", "P1002", "P1008", "P2024"].includes(code)) return "timeout";
  if (
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EHOSTUNREACH",
      "P1001",
      "P1017",
    ].includes(code)
  ) {
    return "connection";
  }
  return "unknown";
}

export async function GET() {
  // Cache Components can prerender a GET handler at build time and serve it forever.
  // connection() makes this handler wait for a real request, so it runs on every call.
  await connection();

  const started = Date.now();
  let errorCategory: ErrorCategory | undefined;

  try {
    await withTimeout(db.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
  } catch (error) {
    errorCategory = categorize(error); // keep the category, drop the error
  }

  const durationMs = Date.now() - started;
  const ok = errorCategory === undefined;

  if (ok) {
    // debug, not info: monitors poll this often and would flood the logs.
    logger.debug({ durationMs }, "health check ok");
  } else {
    logger.error({ durationMs, errorCategory }, "health check failed");
  }

  return Response.json(
    {
      status: ok ? "ok" : "error",
      database: ok ? "up" : "down",
      ...(ok ? {} : { error: errorCategory }),
      timestamp: new Date().toISOString(),
      durationMs,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
