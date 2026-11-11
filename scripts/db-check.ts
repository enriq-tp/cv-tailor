// Checks that the app can reach Postgres through Prisma.
// Run with: npm run db:check
//
// Privacy/security: this script never prints the password or the full
// connection string. It only prints host, port and database name.

import "dotenv/config"; // loads .env into process.env (Node does not do it by itself)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/** Removes secrets from any text before it is printed. */
function redact(text: string, secrets: string[]): string {
  let safe = text;
  for (const secret of secrets) {
    if (secret) safe = safe.split(secret).join("[hidden]");
  }
  return safe;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "FAIL: DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
    process.exitCode = 1;
    return;
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    console.error(
      "FAIL: DATABASE_URL is not a valid URL (expected postgresql://user:password@host:port/db).",
    );
    process.exitCode = 1;
    return;
  }

  const target = `${url.hostname}:${url.port || "5432"}/${url.pathname.slice(1)}`;
  const secrets = [connectionString, decodeURIComponent(url.password)];

  // Prisma 7 talks to Postgres through a driver adapter (the "pg" package).
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5000, // fail fast instead of hanging if the DB is down
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const started = Date.now();
    // Trivial query: no tables needed. $queryRaw is a tagged template, so
    // values are sent as parameters, never concatenated into the SQL.
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    const elapsed = Date.now() - started;

    if (rows[0]?.ok !== 1) {
      console.error(
        "FAIL: connected, but the test query returned an unexpected result.",
      );
      process.exitCode = 1;
      return;
    }
    console.log(`OK: connected to ${target} and ran SELECT 1 (${elapsed} ms).`);
  } catch (error) {
    const err = error as { name?: string; code?: string; message?: string };
    console.error(`FAIL: could not query ${target}.`);
    console.error(
      `  Type: ${err.name ?? "Error"}${err.code ? ` (${err.code})` : ""}`,
    );
    console.error(
      `  Detail: ${redact(err.message ?? "unknown error", secrets)}`,
    );
    const text = `${err.code ?? ""} ${err.message ?? ""}`;
    if (text.includes("28P01")) {
      console.error(
        "  Hint: wrong user or password. If you changed .env after the first start, see 'Reset' in docs/wiki/architecture.md.",
      );
    } else {
      console.error(
        "  Hint: is the container running? Try: docker compose up -d",
      );
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect(); // close connections so the process can exit
  }
}

main();
