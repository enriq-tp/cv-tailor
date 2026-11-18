import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "@/lib/logger";
import {
  MAX_JOB_TEXT_CHARS,
  MIN_JOB_TEXT_CHARS,
  validateJobText,
} from "./validate-job-text";

// Fake job text, longer than the minimum.
const FAKE_JOB =
  "Senior Fake Engineer at Acme Test Corp. We need five years of Fake-Script " +
  "experience and strong communication skills. Remote, full time, great fake benefits.";

function capture() {
  const lines: string[] = [];
  const logger = createLogger({
    write: (line: string) => void lines.push(line),
  });
  return { logger, output: () => lines.join("") };
}

test("limits are 100 and 20 000", () => {
  assert.equal(MIN_JOB_TEXT_CHARS, 100);
  assert.equal(MAX_JOB_TEXT_CHARS, 20_000);
});

test("accepts a normal text and returns the cleaned text and its length", () => {
  const result = validateJobText(`  ${FAKE_JOB}\r\n\r\n\r\n\r\n• Perk one  `);

  assert.ok(result.ok);
  // Only the light cleaning: outer trim, CRLF -> \n, blank lines collapsed, trailing
  // spaces trimmed. The bullet is NOT rewritten.
  assert.equal(result.value.text, `${FAKE_JOB}\n\n• Perk one`);
  assert.equal(result.value.charCount, [...result.value.text].length);
});

test("keeps line breaks, bullet characters and inner spaces exactly as pasted", () => {
  const pasted =
    "Requirements:\n" +
    "• Bullet item with  two spaces\n" +
    "- Dash item\n" +
    "* Star item\n" +
    "◦ Circle item\n" +
    "Hyphen-\nated line stays split\n" +
    "x".repeat(40);
  const result = validateJobText(pasted);

  assert.ok(result.ok);
  assert.equal(result.value.text, pasted);
});

test("a NUL is removed and the rest is unchanged (exact comparison)", () => {
  const clean = "Backend role.\n- Node.js\n- SQL\n" + "y".repeat(80);
  const dirty = clean.slice(0, 20) + "\u0000" + clean.slice(20);
  const result = validateJobText(dirty);

  assert.ok(result.ok);
  assert.equal(result.value.text, clean);
});

test("trims trailing spaces per line and collapses blank lines, keeps leading indentation", () => {
  const result = validateJobText(
    "Title   \n\n\n\n\n  indented line  \r\n" + "z".repeat(100),
  );

  assert.ok(result.ok);
  assert.equal(
    result.value.text,
    "Title\n\n  indented line\n" + "z".repeat(100),
  );
});

test("empty, whitespace-only and non-string input -> empty", () => {
  for (const input of [
    "",
    "   \n\t  ",
    "\u0000\u0001",
    undefined,
    null,
    42,
    {},
  ]) {
    assert.deepEqual(validateJobText(input), {
      ok: false,
      error: { category: "empty" },
    });
  }
});

test("a short text -> too_short", () => {
  assert.deepEqual(validateJobText("Developer wanted"), {
    ok: false,
    error: { category: "too_short" },
  });
});

test("exactly the minimum is accepted, one less is too_short", () => {
  assert.ok(validateJobText("a".repeat(MIN_JOB_TEXT_CHARS)).ok);
  const result = validateJobText("a".repeat(MIN_JOB_TEXT_CHARS - 1));
  assert.ok(!result.ok && result.error.category === "too_short");
});

test("exactly the maximum is accepted, one more is too_long", () => {
  assert.ok(validateJobText("a".repeat(MAX_JOB_TEXT_CHARS)).ok);
  const result = validateJobText("a".repeat(MAX_JOB_TEXT_CHARS + 1));
  assert.ok(!result.ok && result.error.category === "too_long");
});

test("a huge string is rejected as too_long without being processed", () => {
  const result = validateJobText("a".repeat(MAX_JOB_TEXT_CHARS * 2 + 1));
  assert.deepEqual(result, { ok: false, error: { category: "too_long" } });
});

test("length is counted in characters, not UTF-16 units (an emoji is 1)", () => {
  // 100 emoji = 200 UTF-16 units but 100 characters: must be accepted.
  assert.ok(validateJobText("😀".repeat(MIN_JOB_TEXT_CHARS)).ok);
});

test("strips control characters and DEL, keeps newlines and tabs", () => {
  const dirty = `${FAKE_JOB}\u0000\u0007\u001B\u007F\nSecond line\twith tab`;
  const result = validateJobText(dirty);

  assert.ok(result.ok);
  assert.ok(
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(result.value.text),
  );
  assert.equal(result.value.text, `${FAKE_JOB}\nSecond line\twith tab`);
});

test("custom limits can be passed (used to keep tests small)", () => {
  const result = validateJobText("abcdef", { minChars: 3, maxChars: 5 });
  assert.ok(!result.ok && result.error.category === "too_long");
});

test("PRIVACY: logs only the length (or the category), never the text", () => {
  const { logger, output } = capture();

  validateJobText(FAKE_JOB, { logger });
  validateJobText(`${FAKE_JOB} `.repeat(300), { logger }); // too long
  validateJobText("Acme short secret", { logger }); // too short

  const out = output();
  assert.ok(!out.includes("Acme"), "job text leaked");
  assert.ok(!out.includes("Fake-Script"), "job text leaked");
  assert.ok(!out.includes("secret"), "job text leaked");
  assert.ok(out.includes('"charCount"'));
  assert.ok(out.includes('"errorCategory":"too_long"'));
  assert.ok(out.includes('"errorCategory":"too_short"'));
});
