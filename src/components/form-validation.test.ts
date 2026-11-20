// Tests for the client-side input checks. Imports only form-validation.ts and
// src/lib/limits.ts, so no server code (pino, unpdf) is loaded.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_JOB_TEXT_CHARS, MAX_PDF_BYTES } from "@/lib/limits";
import {
  MSG_CHOOSE_PDF,
  MSG_EMPTY_FILE,
  MSG_ONE_PDF,
  countCharacters,
  formatFileSize,
  validateCvFile,
  validateCvFiles,
  validateJobTextInput,
} from "./form-validation";

const pdf = (
  over: Partial<{ name: string; type: string; size: number }> = {},
) => ({
  name: "cv.pdf",
  type: "application/pdf",
  size: 1000,
  ...over,
});

describe("validateCvFile", () => {
  it("accepts a PDF by MIME type", () => {
    assert.equal(validateCvFile(pdf({ name: "cv" })), null);
  });
  it("accepts a PDF by extension when the MIME type is empty", () => {
    assert.equal(validateCvFile(pdf({ type: "" })), null);
  });
  it("accepts an uppercase .PDF extension", () => {
    assert.equal(validateCvFile(pdf({ name: "CV.PDF", type: "" })), null);
  });
  it("rejects a .docx file", () => {
    const type =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    assert.equal(
      validateCvFile(pdf({ name: "cv.docx", type })),
      MSG_CHOOSE_PDF,
    );
  });
  it("accepts exactly the maximum size", () => {
    assert.equal(validateCvFile(pdf({ size: MAX_PDF_BYTES })), null);
  });
  it("rejects one byte over the maximum and names the limit", () => {
    assert.equal(
      validateCvFile(pdf({ size: MAX_PDF_BYTES + 1 })),
      "That file is over 5 MiB. Choose a smaller PDF.",
    );
  });
  it("rejects an empty file with a clear message", () => {
    assert.equal(validateCvFile(pdf({ size: 0 })), MSG_EMPTY_FILE);
  });
});

describe("validateCvFiles", () => {
  it("rejects several files", () => {
    assert.equal(validateCvFiles([pdf(), pdf()]), MSG_ONE_PDF);
  });
  it("rejects no files", () => {
    assert.equal(validateCvFiles([]), MSG_CHOOSE_PDF);
  });
  it("accepts one valid file", () => {
    assert.equal(validateCvFiles([pdf()]), null);
  });
});

describe("countCharacters", () => {
  it("counts an emoji as one character", () => {
    assert.equal(countCharacters("a\u{1F600}b"), 3);
  });
  it("counts whitespace-only text as zero", () => {
    assert.equal(countCharacters(" \n\t  "), 0);
  });
  it("ignores leading and trailing whitespace", () => {
    assert.equal(countCharacters("  hi  "), 2);
  });
});

describe("validateJobTextInput", () => {
  it("rejects 99 characters", () => {
    assert.equal(
      validateJobTextInput("a".repeat(99)),
      "Add at least 100 characters. You have 99.",
    );
  });
  it("accepts 100 characters", () => {
    assert.equal(validateJobTextInput("a".repeat(100)), null);
  });
  it("accepts the maximum", () => {
    assert.equal(validateJobTextInput("a".repeat(MAX_JOB_TEXT_CHARS)), null);
  });
  it("rejects one character over the maximum", () => {
    assert.equal(
      validateJobTextInput("a".repeat(MAX_JOB_TEXT_CHARS + 1)),
      "Too long: remove 1 character.",
    );
  });
  it("reports how many characters to remove", () => {
    assert.equal(
      validateJobTextInput("a".repeat(MAX_JOB_TEXT_CHARS + 5)),
      "Too long: remove 5 characters.",
    );
  });
  it("skips the minimum check when asked (untouched field)", () => {
    assert.equal(validateJobTextInput("", false), null);
  });
});

describe("formatFileSize", () => {
  it("formats bytes, KiB and MiB", () => {
    assert.equal(formatFileSize(0), "0 bytes");
    assert.equal(formatFileSize(1), "1 byte");
    assert.equal(formatFileSize(512), "512 bytes");
    assert.equal(formatFileSize(1536), "1.5 KiB");
    assert.equal(formatFileSize(2.5 * 1024 * 1024), "2.5 MiB");
    assert.equal(formatFileSize(MAX_PDF_BYTES), "5 MiB");
  });
});
