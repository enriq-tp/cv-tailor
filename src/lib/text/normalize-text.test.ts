import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeJobText, normalizeText } from "./normalize-text";

test("normalizeJobText is light: keeps bullets, inner spaces and line breaks", () => {
  const text = "• A  b\n- c\n* d\n◦ e\n\nf";
  assert.equal(normalizeJobText(text), text);
});

test("normalizeJobText unifies line endings, trims trailing spaces, collapses blank lines", () => {
  assert.equal(normalizeJobText("\n a  \r\nb \t\r\r\r\rc\n\n\n"), "a\nb\n\nc");
});

test("normalises Windows and old Mac line endings to \\n", () => {
  assert.equal(normalizeText("a\r\nb\rc\nd"), "a\nb\nc\nd");
});

test("replaces NBSP and other unicode spaces with a normal space", () => {
  assert.equal(normalizeText("a\u00A0b\u2003c\u3000d"), "a b c d");
});

test("removes zero-width characters and soft hyphens", () => {
  assert.equal(normalizeText("a\u200Bb\uFEFFc\u2060d\u00ADe"), "abcde");
});

test("collapses runs of spaces and tabs and trims each line", () => {
  assert.equal(normalizeText("  a \t  b  \n\t c\t"), "a b\nc");
});

test("turns bullet characters at line start into '- '", () => {
  const bullets = ["•", "◦", "▪", "●", "‣", "·", "■"];
  for (const bullet of bullets) {
    assert.equal(normalizeText(`${bullet} Item`), "- Item", `bullet ${bullet}`);
    assert.equal(
      normalizeText(`${bullet}Item`),
      "- Item",
      `bullet ${bullet} without space`,
    );
  }
});

test("does not touch a bullet-like character inside a line", () => {
  assert.equal(normalizeText("Node · React"), "Node · React");
});

test("collapses 3 or more consecutive newlines into one blank line", () => {
  assert.equal(normalizeText("a\n\n\n\nb\n\nc"), "a\n\nb\n\nc");
  assert.equal(normalizeText("a\n \n \n \nb"), "a\n\nb");
});

test("trims the whole text", () => {
  assert.equal(normalizeText("\n\n  hello  \n\n"), "hello");
});

test("is idempotent and keeps accents", () => {
  const once = normalizeText("• Diseño\u00A0y   desarrollo\r\n\r\n\r\n\r\nFin");
  assert.equal(once, "- Diseño y desarrollo\n\nFin");
  assert.equal(normalizeText(once), once);
});

test("empty and whitespace-only input give an empty string", () => {
  assert.equal(normalizeText(""), "");
  assert.equal(normalizeText(" \n\t \u00A0 "), "");
});
