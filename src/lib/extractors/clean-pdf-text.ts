// Cleaning rules that only make sense for text extracted from a PDF (used for the CV only).
// The generic rules (whitespace, bullets, blank lines) are in text/normalize-text.ts.
//
// KNOWN LIMITATIONS (accepted for now):
// 1. Hyphen joining is a heuristic: a real hyphen at the end of a line ("full-\nstack")
//    is also joined into "fullstack". Words broken by a PDF line wrap are far more
//    common than compound words that happen to break exactly at the hyphen.
// 2. Two-column CVs: pdf.js returns text in the order it is stored in the file. Columns
//    can come out interleaved line by line or one column after the other. Fixing that
//    needs the position of every text item (unpdf's `extractTextItems`). Left for later.

import { normalizeText } from "@/lib/text/normalize-text";

// A letter, a hyphen at the END of a line, a line break, then a lowercase letter.
// Only a lowercase next line is joined: "Self-\nEmployed" stays untouched because a
// capital usually means a new sentence or a proper name.
const HYPHEN_AT_LINE_END = /(\p{L})-[ \t]*\n[ \t]*(?=\p{Ll})/gu;

/** Joins the pages (blank line between them), repairs hyphenated line breaks, normalises. */
export function cleanPdfText(pages: string[]): string {
  const joined = pages.join("\n\n").replace(/\r\n?/g, "\n");
  const dehyphenated = joined.replace(HYPHEN_AT_LINE_END, "$1");
  return normalizeText(dehyphenated);
}
