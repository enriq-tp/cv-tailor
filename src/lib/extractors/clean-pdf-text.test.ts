import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPdfText } from "./clean-pdf-text";

test("joins a word hyphenated across a line break", () => {
  assert.equal(
    cleanPdfText(["Experiencia en desa-\nrrollo web"]),
    "Experiencia en desarrollo web",
  );
});

test("does not join when the next line starts with a capital letter", () => {
  assert.equal(cleanPdfText(["Self-\nEmployed"]), "Self-\nEmployed");
});

test("does not touch a hyphen in the middle of a line", () => {
  assert.equal(cleanPdfText(["full-stack developer"]), "full-stack developer");
});

test("does not join a spaced dash used as a separator", () => {
  assert.equal(cleanPdfText(["2020 -\nactual"]), "2020 -\nactual");
});

test("known limitation: a real hyphen at a line end is joined", () => {
  assert.equal(cleanPdfText(["full-\nstack"]), "fullstack");
});

test("joins pages with a blank line and normalises the result", () => {
  const result = cleanPdfText(["  Page one  \n\n\n\nmore", "• Page two"]);
  assert.equal(result, "Page one\n\nmore\n\n- Page two");
});

test("an empty list gives an empty string", () => {
  assert.equal(cleanPdfText([]), "");
});
