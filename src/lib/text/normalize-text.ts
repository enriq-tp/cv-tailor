// Text normalisation. Two levels:
// - normalizeText: stronger, used for the CV text (after PDF extraction).
// - normalizeJobText: light, used for the pasted job text (keeps its structure).
// Neither changes the words. PDF-specific fixes (hyphenated line breaks) live in
// extractors/clean-pdf-text.ts.
//
// Why normalise at all: the same text must look the same to the LLM (fewer wasted
// tokens, no odd characters) and to the user when they review it.

// Unicode "space" characters that look like a space but are not U+0020
// (no-break space, en/em space, thin space, ideographic space, ...).
const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

// Characters that take no space on screen: zero-width space/joiners, word joiner,
// byte-order mark and the soft hyphen (an invisible hyphenation hint).
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;

// Bullet glyphs that PDF and word processors put at the start of a list item.
const BULLET_AT_LINE_START = /^[•◦▪▫●○‣∙·■□◆◇\u2043][ ]*/;

// ---- Small helpers shared by normalizeText (CV) and normalizeJobText (job posting) ----

/** Windows (\r\n), old Mac (\r) and Unicode line separators -> \n. */
const unifyLineEndings = (text: string): string =>
  text.replace(/\r\n?|\u2028|\u2029/g, "\n");

/** 3 or more newlines (2+ blank lines) -> one blank line. */
const collapseBlankLines = (text: string): string =>
  text.replace(/\n{3,}/g, "\n\n");

/**
 * LIGHT normalisation for the pasted job posting. It keeps the structure as pasted
 * (line breaks, bullet characters, spaces inside a line) because that structure helps
 * the LLM understand the posting. It only: unifies line endings, trims trailing spaces
 * on each line, collapses runs of blank lines and trims the whole text.
 * It does NOT join lines, rewrite bullets or apply PDF rules.
 */
export function normalizeJobText(text: string): string {
  const lines = unifyLineEndings(text)
    .split("\n")
    .map((line) => line.trimEnd());
  return collapseBlankLines(lines.join("\n")).trim();
}

/**
 * STRONGER normalisation for CV text. Returns a cleaner version of `text`.
 * Safe to call more than once (idempotent).
 */
export function normalizeText(text: string): string {
  const cleaned = unifyLineEndings(text)
    .replace(UNICODE_SPACES, " ")
    .replace(ZERO_WIDTH, "")
    // Runs of spaces and tabs -> one space.
    .replace(/[ \t]+/g, " ");

  const lines = cleaned.split("\n").map((line) => {
    const trimmed = line.trim();
    // Bullets become "- " so the LLM sees one consistent list marker.
    return trimmed.replace(BULLET_AT_LINE_START, "- ").trimEnd();
  });

  return collapseBlankLines(lines.join("\n")).trim();
}
