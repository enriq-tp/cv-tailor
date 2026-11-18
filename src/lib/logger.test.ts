// Privacy test for the logger. Run with: npm test
// It proves that fake secrets and fake personal data never reach the log output.
// Uses Node's built-in test runner (node:test), executed through tsx. No extra dependency.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "./logger";

// Fake values: they must NEVER appear in the captured output.
const FAKE_PASSWORD = "s3cret-Passw0rd-FAKE";
const FAKE_EMAIL = "jane.doe.fake@example.com";
const FAKE_CV_TEXT =
  "FAKE CV: Senior engineer at Acme Corp, 10 years of experience";
const FAKE_CONNECTION =
  "postgresql://someuser:fakepass123@db.example.com:5432/prod";

/** A logger that writes into an array instead of stdout. */
function capture() {
  const lines: string[] = [];
  const logger = createLogger({
    write: (line: string) => void lines.push(line),
  });
  return { logger, output: () => lines.join("") };
}

test("redacts top-level password, email and CV text", () => {
  const { logger, output } = capture();

  logger.info(
    {
      password: FAKE_PASSWORD,
      email: FAKE_EMAIL,
      cvText: FAKE_CV_TEXT,
      durationMs: 12,
    },
    "test top-level",
  );

  const out = output();
  assert.ok(!out.includes(FAKE_PASSWORD), "password leaked");
  assert.ok(!out.includes(FAKE_EMAIL), "email leaked");
  assert.ok(!out.includes(FAKE_CV_TEXT), "CV text leaked");
  assert.ok(out.includes("[REDACTED]"), "expected the redaction marker");
  assert.ok(
    out.includes('"durationMs":12'),
    "non-sensitive fields must still be logged",
  );
});

test("redacts nested fields, one and two levels deep", () => {
  const { logger, output } = capture();

  logger.info(
    {
      user: { email: FAKE_EMAIL, id: "user-1" },
      request: { body: { password: FAKE_PASSWORD, cvText: FAKE_CV_TEXT } },
    },
    "test nested",
  );

  const out = output();
  assert.ok(!out.includes(FAKE_EMAIL), "nested email leaked");
  assert.ok(!out.includes(FAKE_PASSWORD), "deeply nested password leaked");
  assert.ok(!out.includes(FAKE_CV_TEXT), "deeply nested CV text leaked");
  assert.ok(
    out.includes('"id":"user-1"'),
    "non-sensitive nested fields must still be logged",
  );
});

test("redacts the fields that store CV and job posting content", () => {
  const { logger, output } = capture();

  logger.info(
    {
      cv: { data: FAKE_CV_TEXT },
      jobPost: { rawText: FAKE_CV_TEXT, analysis: FAKE_CV_TEXT },
    },
    "test schema fields",
  );

  assert.ok(
    !output().includes(FAKE_CV_TEXT),
    "content stored in a schema field leaked",
  );
});

test("redacts authorization and cookie headers", () => {
  const { logger, output } = capture();

  logger.info(
    {
      req: {
        headers: {
          authorization: `Bearer ${FAKE_PASSWORD}`,
          cookie: `session=${FAKE_PASSWORD}`,
          "set-cookie": `session=${FAKE_PASSWORD}`,
        },
      },
    },
    "test headers",
  );

  assert.ok(!output().includes(FAKE_PASSWORD), "a header secret leaked");
});

test("an error object never leaks its message or stack", () => {
  const { logger, output } = capture();
  const error = new Error(`connect failed for ${FAKE_CONNECTION}`);

  // Breaking the rule on purpose, to prove the safety net works.
  logger.error({ err: error }, "first form");
  logger.error({ error }, "second form");
  logger.error(error, "third form");

  const out = output();
  assert.ok(
    !out.includes(FAKE_CONNECTION),
    "connection string leaked through an error",
  );
  assert.ok(
    !out.includes("fakepass123"),
    "password in an error message leaked",
  );
  assert.ok(!out.includes("stack"), "stack trace leaked");
  assert.ok(
    out.includes('"type":"Error"'),
    "the error type should still be logged",
  );
});
