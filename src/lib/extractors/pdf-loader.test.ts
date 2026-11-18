// Tests for the PDF loader. Run with: npm test
// All PDFs are built in memory from FAKE text (see test-pdf-builder.ts).

import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "@/lib/logger";
import { classifyPdfError, loadPdf, withTimeout } from "./pdf-loader";
import { buildTestPdf } from "./test-pdf-builder";

const FAKE_PAGE_1 = [
  "Jane Fake Candidate",
  "Software Engineer at Acme Test Corp",
  "Built a fake thing with TypeScript",
];
const FAKE_PAGE_2 = ["Skills: TypeScript, SQL, Testing", "Languages: English"];

function twoPagePdf(): Buffer {
  return buildTestPdf([FAKE_PAGE_1, FAKE_PAGE_2]);
}

/** A logger that writes into an array instead of stdout. */
function capture() {
  const lines: string[] = [];
  const logger = createLogger({
    write: (line: string) => void lines.push(line),
  });
  return { logger, output: () => lines.join("") };
}

test("extracts two pages with metadata", async () => {
  const result = await loadPdf(twoPagePdf());

  assert.ok(result.ok);
  assert.equal(result.value.pageCount, 2);
  assert.equal(result.value.pages.length, 2);
  assert.equal(result.value.pages[0].pageNumber, 1);
  assert.equal(result.value.pages[1].pageNumber, 2);
  assert.match(result.value.pages[0].text, /Jane Fake Candidate/);
  assert.match(result.value.pages[1].text, /Skills: TypeScript/);
  assert.ok(result.value.charCount > 50);
  assert.equal(result.value.hasExtractableText, true);
});

test("a blank PDF has no extractable text", async () => {
  const result = await loadPdf(buildTestPdf([[]]));

  assert.ok(result.ok);
  assert.equal(result.value.pageCount, 1);
  assert.equal(result.value.hasExtractableText, false);
});

test("a PDF with only a few characters has no extractable text", async () => {
  const result = await loadPdf(buildTestPdf([["Hi"]]));

  assert.ok(result.ok);
  assert.equal(result.value.hasExtractableText, false);
});

test("empty buffer -> empty", async () => {
  const result = await loadPdf(Buffer.alloc(0));
  assert.deepEqual(result, { ok: false, error: { category: "empty" } });
});

test("random bytes -> not_a_pdf", async () => {
  const result = await loadPdf(Buffer.from("this is definitely not a pdf"));
  assert.deepEqual(result, { ok: false, error: { category: "not_a_pdf" } });
});

test("PDF header followed by garbage -> corrupt", async () => {
  const result = await loadPdf(Buffer.from("%PDF-1.4\nnonsense nonsense"));
  assert.deepEqual(result, { ok: false, error: { category: "corrupt" } });
});

test("a truncated PDF -> corrupt", async () => {
  const result = await loadPdf(twoPagePdf().subarray(0, 200));
  assert.deepEqual(result, { ok: false, error: { category: "corrupt" } });
});

test("a file over the size limit -> too_large (tiny limit for the test)", async () => {
  const result = await loadPdf(twoPagePdf(), { maxFileBytes: 100 });
  assert.deepEqual(result, { ok: false, error: { category: "too_large" } });
});

test("more pages than allowed -> too_many_pages (tiny limit for the test)", async () => {
  const result = await loadPdf(twoPagePdf(), { maxPages: 1 });
  assert.deepEqual(result, {
    ok: false,
    error: { category: "too_many_pages" },
  });
});

test("withTimeout rejects with a timeout error when the work is too slow", async () => {
  // pdf.js on a tiny file finishes in microtasks, so we test the race with a promise
  // that never settles.
  const never = new Promise<string>(() => {});
  await assert.rejects(
    () => withTimeout(never, 5),
    (error) => classifyPdfError(error) === "timeout",
  );
  assert.equal(await withTimeout(Promise.resolve("done"), 1000), "done");
});

test("classifyPdfError maps error names to categories (never reads the message)", () => {
  assert.equal(classifyPdfError({ name: "PasswordException" }), "encrypted");
  assert.equal(classifyPdfError({ name: "InvalidPDFException" }), "corrupt");
  assert.equal(classifyPdfError({ name: "PdfTimeoutError" }), "timeout");
  assert.equal(classifyPdfError(new Error("anything")), "unknown");
  assert.equal(classifyPdfError("a string"), "unknown");
  assert.equal(classifyPdfError(null), "unknown");
  // A message that looks like a category must not matter.
  assert.equal(
    classifyPdfError({ name: "Error", message: "PasswordException" }),
    "unknown",
  );
});

test("the caller's Buffer is not modified or emptied", async () => {
  const original = twoPagePdf();
  const snapshot = Buffer.from(original); // an independent copy to compare with

  await loadPdf(original);

  assert.equal(original.length, snapshot.length);
  assert.ok(original.equals(snapshot), "the input bytes changed");
});

test("loadPdf never throws, whatever it receives", async () => {
  const inputs: unknown[] = [
    Buffer.alloc(0),
    Buffer.from("garbage"),
    Buffer.from("%PDF-1.4 garbage"),
    new Uint8Array([1, 2, 3]),
    twoPagePdf().subarray(0, 50),
    undefined,
    null,
  ];
  for (const input of inputs) {
    await assert.doesNotReject(() => loadPdf(input as Uint8Array));
  }
});

test("accepts a plain Uint8Array as well as a Buffer", async () => {
  const result = await loadPdf(new Uint8Array(twoPagePdf()));
  assert.ok(result.ok);
  assert.equal(result.value.pageCount, 2);
});

test("PRIVACY: a successful load logs sizes and counts, never the text", async () => {
  const { logger, output } = capture();
  const pdf = twoPagePdf();

  const result = await loadPdf(pdf, { logger });

  assert.ok(result.ok);
  const out = output();
  for (const line of [...FAKE_PAGE_1, ...FAKE_PAGE_2]) {
    assert.ok(!out.includes(line), `a line of CV text leaked: ${line}`);
  }
  assert.ok(!out.includes("Jane"), "a name from the CV leaked");
  assert.ok(out.includes(`"sizeBytes":${pdf.length}`));
  assert.ok(out.includes('"pageCount":2'));
  assert.ok(out.includes('"hasExtractableText":true'));
  assert.ok(out.includes('"durationMs"'));
});

test("PRIVACY: a failed load logs only size and category", async () => {
  const { logger, output } = capture();
  const bytes = Buffer.from("%PDF-1.4\nJane Fake secret text, not a real file");

  await loadPdf(bytes, { logger });

  const out = output();
  assert.ok(!out.includes("Jane"), "file content leaked");
  assert.ok(!out.includes("secret"), "file content leaked");
  assert.ok(out.includes('"errorCategory":"corrupt"'));
  assert.ok(out.includes(`"sizeBytes":${bytes.length}`));
});
