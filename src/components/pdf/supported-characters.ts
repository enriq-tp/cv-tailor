// Which characters the PDF can show. Pure TypeScript: no imports from react-pdf, so the UI can
// use it BEFORE the (large) PDF library is loaded.
//
// Why this file exists: the PDF uses Helvetica, one of the 14 "standard" PDF fonts. Those are
// built into every PDF reader, so we embed no font file. The price: Helvetica only has the
// Western European alphabet (the "WinAnsi" set). react-pdf does NOT warn about a character
// that is not in it: it silently draws a WRONG character instead (checked on react-pdf 4.9.0:
// "Łódź" came out as "Aódz", Cyrillic as "@825B"). A CV with a wrong name is worse than no
// CV, so we find those characters first and ask the user to change them.
// Phase 2 path: embed a Unicode font (for example Noto Sans, SIL OFL licence).
//
// The set below is PROVEN by the round-trip test in pdf-render.test.ts: every character is
// rendered into a real PDF and read back with the project's PDF loader.

import type { Cv } from "@/lib/schemas";

// Characters from the Windows-1252 table that are not in Latin-1.
const WINDOWS_1252_EXTRAS = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

function isLineWhitespace(char: string): boolean {
  // Line breaks and tabs are layout, not "characters": the document code turns them into
  // line breaks or spaces (see pdfText / pdfLine below), so they are never reported.
  return char === "\n" || char === "\r" || char === "\t";
}

// Found by the round-trip test: the micro sign "µ" (U+00B5) is DRAWN correctly, but a PDF
// reader hands it back as the Greek letter "μ" (U+03BC). An ATS would then see a different
// character, so it is not supported: the user is asked to replace it (for example "us").
const NOT_ROUND_TRIP = new Set(["µ"]);

/** True if Helvetica can draw this single character (one code point) and it reads back identically. */
export function isSupportedCharacter(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined || NOT_ROUND_TRIP.has(char)) return false;
  if (code >= 0x20 && code <= 0x7e) return true; // printable ASCII
  if (code >= 0xa0 && code <= 0xff) return true; // Latin-1 Supplement (é ñ ü ç ß ...)
  return WINDOWS_1252_EXTRAS.includes(char);
}

/** Every supported character (used by the round-trip test). */
export const SUPPORTED_CHARACTERS: string[] = [
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) =>
    String.fromCodePoint(0x20 + i),
  ),
  ...Array.from({ length: 0xff - 0xa0 + 1 }, (_, i) =>
    String.fromCodePoint(0xa0 + i),
  ),
  ...Array.from(WINDOWS_1252_EXTRAS),
].filter(isSupportedCharacter);

/**
 * Characters that are accepted but changed before rendering, because a PDF reader would not
 * give them back unchanged: a non-breaking space becomes a normal space and a soft hyphen
 * (an invisible "you may break the word here" mark) is removed.
 */
const NORMALISED: Record<string, string> = { " ": " ", "­": "" };

/** What a supported character looks like after normalisation (for the tests). */
export function normaliseCharacter(char: string): string {
  return NORMALISED[char] ?? char;
}

/**
 * Text for a one-line field (title, company, a bullet...): normalised characters, and any run
 * of whitespace (including line breaks and tabs) becomes ONE space. Trimmed.
 */
export function pdfLine(text: string | null | undefined): string {
  if (!text) return "";
  return Array.from(text, normaliseCharacter)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Text for a multi-line field (summary, cover letter): line breaks are kept (all kinds become
 * "\n"), tabs become spaces, characters are normalised, trailing spaces are removed.
 */
export function pdfText(text: string | null | undefined): string {
  if (!text) return "";
  return Array.from(text, normaliseCharacter)
    .join("")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]+\n/g, "\n")
    .trim();
}

/**
 * The characters of `text` that Helvetica cannot draw, in order of appearance, repeats
 * included. Counted by CODE POINT (`for...of`), so an emoji is one character, never two halves.
 */
export function findUnsupportedCharacters(text: string): string[] {
  const found: string[] = [];
  for (const char of text) {
    if (isLineWhitespace(char)) continue;
    // NBSP and the soft hyphen are in the supported set: they are normalised, not blocked.
    if (!isSupportedCharacter(char)) found.push(char);
  }
  return found;
}

export type CharacterFinding = { section: string; characters: string[] };

// Collects the unique unsupported characters of several texts (a section), in order.
function collect(texts: (string | null | undefined)[]): string[] {
  const unique = new Set<string>();
  for (const text of texts) {
    if (text)
      for (const char of findUnsupportedCharacters(text)) unique.add(char);
  }
  return [...unique];
}

/** Unique unsupported characters per CV section, in section order. Empty sections are left out. */
export function checkCvCharacters(cv: Cv): CharacterFinding[] {
  const { contact } = cv;
  const sections: [string, (string | null | undefined)[]][] = [
    [
      "Contact",
      [
        contact.fullName,
        contact.email,
        contact.phone,
        contact.location,
        ...contact.links.flatMap((link) => [link.label, link.url]),
      ],
    ],
    ["Summary", [cv.summary]],
    [
      "Experience",
      cv.experience.flatMap((job) => [
        job.title,
        job.company,
        job.location,
        job.startDate,
        job.endDate,
        ...job.achievements,
      ]),
    ],
    [
      "Education",
      cv.education.flatMap((school) => [
        school.degree,
        school.field,
        school.institution,
        school.startDate,
        school.endDate,
      ]),
    ],
    ["Skills", cv.skills],
    [
      "Projects",
      cv.projects.flatMap((project) => [
        project.name,
        project.description,
        project.url,
        ...project.technologies,
      ]),
    ],
    [
      "Languages",
      cv.languages.flatMap((language) => [language.name, language.proficiency]),
    ],
  ];

  return sections
    .map(([section, texts]) => ({ section, characters: collect(texts) }))
    .filter((finding) => finding.characters.length > 0);
}

/** The same check for the cover letter text (section "Cover letter"). */
export function checkLetterCharacters(text: string): CharacterFinding[] {
  const characters = collect([text]);
  return characters.length > 0 ? [{ section: "Cover letter", characters }] : [];
}

// ---- The message -----------------------------------------------------------------------

const MAX_LISTED = 10;

// Invisible or odd characters (control codes, zero-width marks, exotic spaces) cannot be
// shown as themselves in a sentence, so they are named by code: "U+200B".
function showCharacter(char: string): string {
  if (/[\p{C}\p{Z}]/u.test(char)) {
    const code = char.codePointAt(0) ?? 0;
    return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  return char;
}

/**
 * The on-screen error. Names the sections and the characters, at most 10 per section.
 * Example: "These characters can't be shown in the PDF: ł, ź (Summary); Ж (Experience).
 * Remove or replace them to download." Plain text, shown on screen only, never logged.
 */
export function formatUnsupportedMessage(findings: CharacterFinding[]): string {
  const parts = findings.map(({ section, characters }) => {
    const listed = characters.slice(0, MAX_LISTED).map(showCharacter);
    const hidden = characters.length - listed.length;
    const list =
      hidden > 0
        ? `${listed.join(", ")} and ${hidden} more`
        : listed.join(", ");
    return `${list} (${section})`;
  });
  return `These characters can't be shown in the PDF: ${parts.join("; ")}. Remove or replace them to download.`;
}
