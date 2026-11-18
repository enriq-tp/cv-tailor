// Shared Prisma client. Import `db` everywhere in server code; never create another client.
// Server-only: it needs DATABASE_URL and must never be imported from a client component.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Say WHAT is missing, never print its value.
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }

  // Prisma 7 talks to Postgres through a driver adapter (the "pg" package).
  // These options belong to the pg connection pool.
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5000, // give up opening a connection after 5 s (default 0 = wait forever)
    query_timeout: 10000, // give up on a single query after 10 s
  });
  return new PrismaClient({ adapter });
}

// Why globalThis: in development, hot reload re-runs this file on every code change.
// Without this, each reload would create a new client with its own connection pool, and
// after enough edits Postgres would refuse new connections ("too many clients").
// globalThis survives hot reloads, so the same client is reused.
const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db = globalForDb.db ?? createClient();

// In production the module is loaded once, so no caching is needed.
if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
