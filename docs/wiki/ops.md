# Operations: logging and health check

Code: `src/lib/logger.ts`, `src/lib/db.ts`, `src/app/api/health/route.ts`. Privacy test: `src/lib/logger.test.ts` (`npm test`).

## Logging

The app uses **pino**, a structured logger: every log line is one JSON object (`{"level":50,"time":...,"durationMs":2007,"errorCategory":"timeout","msg":"health check failed"}`) that tools can filter and count. In development the same data is shown in a readable, coloured format through `pino-pretty`. In production (and in tests) it is plain JSON on stdout.

```ts
import { logger } from "@/lib/logger";
logger.info({ cvId, sizeBytes, durationMs }, "cv extracted"); // ids, sizes, durations only
```

### Log levels

`LOG_LEVEL` (in `.env`, default `info`) is the minimum level that is printed. An unknown value falls back to `info`.

| Level   | Use it for                                          | Example                                  |
| ------- | --------------------------------------------------- | ---------------------------------------- |
| `debug` | Detail that is noisy in normal operation            | A successful health check                |
| `info`  | Normal events worth keeping                         | "cv extracted" with id, size, duration   |
| `warn`  | Something unexpected that the app recovered from    | A retry                                  |
| `error` | An operation failed                                 | A failed health check                    |
| `fatal` | The process cannot continue                         | Missing required configuration           |

(`trace` is below `debug`; `silent` turns logging off.)

### What is and is not logged (privacy, see `CLAUDE.md`)

**Log:** ids, sizes, durations, token counts, status, safe error categories.

**Never log:** CV content, job posting content, names, emails, phone numbers, passwords, tokens, cookies, `Authorization` headers, `DATABASE_URL`, API keys.

Three layers protect this, and none of them replaces the first rule (do not pass sensitive data to the logger):

1. **Redaction by field name.** These keys are replaced by `[REDACTED]` at the top level and one and two levels deep (`{ user: { email } }`): `password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`, `DATABASE_URL`, `databaseUrl`, `connectionString`, `email`, `phone`, `rawText`, `data`, `tailoredCv`, `analysis`, `coverLetter`, `cvText`, `jobText`, `text`, plus `set-cookie` headers. The content fields match the columns in `prisma/schema.prisma`. **Limit:** redaction works by name. It cannot find an email inside a sentence, so never build a log message out of user data.
2. **Errors are reduced to their type name.** Any value under the `err` or `error` key (or an `Error` passed as the first argument) is logged as `{"type":"Error"}`: no message, no stack.
3. **The privacy test** (`npm test`) fails if a fake password, email, CV text, nested field, header secret or error message reaches the output.

### Rule: never pass a caught error to the logger

A database or HTTP error message can contain the connection string, credentials or user data. In a `catch`, turn the error into a safe category and log that:

```ts
try {
  await something();
} catch (error) {
  logger.error({ errorCategory: categorize(error) }, "something failed"); // not: { err: error }
}
```

The serializer in layer 2 is a safety net for mistakes, not permission to log errors. The same rule applies to HTTP responses: never return an error message or stack to the client.

### Adding a field to redact

Add its name to `SENSITIVE_FIELDS` in `src/lib/logger.ts`, add a test case in `src/lib/logger.test.ts`, run `npm test`. Do this whenever a new column or request field holds personal data.

## Health check: `GET /api/health`

Answers "can the app reach its database right now?". It runs `SELECT 1` with a **2 second timeout**, so it cannot hang even if the database is unreachable.

```bash
curl -i http://localhost:3000/api/health
```

| Situation                      | HTTP | Body                                                                                          |
| ------------------------------ | ---- | --------------------------------------------------------------------------------------------- |
| Database reachable             | 200  | `{"status":"ok","database":"up","timestamp":"2026-11-17T18:54:48.407Z","durationMs":159}`      |
| Database refuses the connection | 503  | `{"status":"error","database":"down","error":"connection","timestamp":"...","durationMs":8}`  |
| Database does not answer in 2 s | 503  | `{"status":"error","database":"down","error":"timeout","timestamp":"...","durationMs":2007}`  |

- `error` is only ever `connection`, `timeout` or `unknown`. It is derived from the error **code**; the message is never read. No connection string, credentials, stack trace or raw error text is returned or logged.
- A successful check is logged at `debug` (monitors poll often); a failure is logged at `error` with `durationMs` and `errorCategory` only.
- The response is never cached: the handler calls `await connection()` (with `cacheComponents` enabled, a `GET` handler could otherwise be prerendered at build time and answer "ok" forever) and sends `Cache-Control: no-store`. `next build` lists the route as `ƒ (Dynamic)`.
- The endpoint is public and reveals only whether the database is up.

Note: when the timeout wins, the query itself is not cancelled; it ends when the connection settings in `src/lib/db.ts` (`connectionTimeoutMillis` 5 s, `query_timeout` 10 s) expire. The `query_timeout` option is accepted by the adapter types but its effect was not exercised in a test.

### Simulating a database outage

```bash
docker compose stop     # database down: /api/health returns 503, error "connection"
docker compose start    # database back: /api/health returns 200 again
```

To see the `timeout` category, start the app with a `DATABASE_URL` that points to an address that never answers (for example host `10.255.255.1`).

## Extending later

- **Sentry (Phase 2):** initialise it once on the server. Before sending, strip request bodies, headers and error messages (`beforeSend`) so the privacy rules hold there too. Keep reporting only ids and categories.
- **Langfuse (Phase 2):** trace LLM calls with ids, model, token counts and durations. Do not send prompt or completion text if it contains CV or job posting content (or mask it first).
- **Prometheus/Grafana (Phase 3):** `/api/health` stays the liveness check; metrics go to a separate endpoint.
- **Request ids:** when API routes exist, create a child logger per request (`logger.child({ requestId })`) so every line of one request can be correlated.
- **Log shipping:** in production, stdout JSON is collected by the platform. No file or transport configuration is needed in the app.
