// Tests for the unsupported-character check. Pure functions, no PDF is rendered here (the
// proof that the supported set really reads back is in pdf-render.test.ts).
// All data is synthetic.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Cv } from "@/lib/schemas";
import {
  checkCvCharacters,
  checkLetterCharacters,
  findUnsupportedCharacters,
  formatUnsupportedMessage,
  pdfLine,
  pdfText,
} from "./supported-characters";

function makeCv(overrides: Partial<Cv> = {}): Cv {
  return {
    schemaVersion: 1,
    contact: { links: [] },
    summary: null,
    experience: [],
    education: [],
    skills: [],
    languages: [],
    projects: [],
    ...overrides,
  };
}

describe("findUnsupportedCharacters", () => {
  it("flags Latin Extended, Cyrillic, Greek, CJK and emoji", () => {
    assert.deepEqual(findUnsupportedCharacters("Łódź"), ["Ł", "ź"]);
    assert.deepEqual(findUnsupportedCharacters("Привет"), [..."Привет"]);
    assert.deepEqual(findUnsupportedCharacters("αβ"), ["α", "β"]);
    assert.deepEqual(findUnsupportedCharacters("日本"), ["日", "本"]);
    assert.deepEqual(findUnsupportedCharacters("ok 🚀"), ["🚀"]);
  });

  it("does not flag the supported letters and punctuation", () => {
    const fine =
      "José Muñoz, Müller, Çelik, Größe – “quoted” ’ … • € £ — ‘x’ ©";
    assert.deepEqual(findUnsupportedCharacters(fine), []);
  });

  it("counts by code point: an emoji is ONE character, never two halves", () => {
    const found = findUnsupportedCharacters("a🚀b😀");
    assert.deepEqual(found, ["🚀", "😀"]);
    assert.equal(found[0].length, 2); // two UTF-16 units, one character
  });

  it("does not report line breaks and tabs (layout handles them)", () => {
    assert.deepEqual(findUnsupportedCharacters("a\nb\r\nc\td"), []);
  });

  it("reports other control characters and exotic spaces", () => {
    assert.deepEqual(findUnsupportedCharacters("a\u0007b c​d"), [
      "\u0007",
      " ",
      "​",
    ]);
  });

  it("flags the micro sign, which reads back as a Greek letter", () => {
    assert.deepEqual(findUnsupportedCharacters("5µs"), ["µ"]);
  });

  it("accepts the non-breaking space and soft hyphen (they are normalised)", () => {
    assert.deepEqual(findUnsupportedCharacters("a b­c"), []);
  });
});

describe("normalisation before rendering", () => {
  it("pdfLine: NBSP becomes a space, soft hyphen goes, whitespace runs become one space", () => {
    assert.equal(pdfLine("  a b­c \n\t d  "), "a bc d");
    assert.equal(pdfLine(null), "");
    assert.equal(pdfLine(undefined), "");
  });

  it("pdfText keeps line breaks, turns tabs into spaces, trims trailing spaces", () => {
    assert.equal(pdfText("a \r\nb\tc\rd e"), "a\nb c\nd e");
  });
});

describe("checkCvCharacters", () => {
  it("names the right section for each field, in section order", () => {
    const cv = makeCv({
      contact: { fullName: "Łukasz Test", links: [] },
      summary: "Ж in the summary",
      experience: [
        {
          title: "Tester",
          achievements: ["Fine bullet.", "Bullet with ź and 🚀."],
        },
      ],
      education: [{ institution: "Universität", field: "数学" }],
      skills: ["Node.js", "Ünïcode ok", "ő"],
      projects: [{ name: "P", technologies: ["ř"] }],
      languages: [{ name: "English", proficiency: "Ω" }],
    });

    assert.deepEqual(checkCvCharacters(cv), [
      { section: "Contact", characters: ["Ł"] },
      { section: "Summary", characters: ["Ж"] },
      { section: "Experience", characters: ["ź", "🚀"] },
      { section: "Education", characters: ["数", "学"] },
      { section: "Skills", characters: ["ő"] },
      { section: "Projects", characters: ["ř"] },
      { section: "Languages", characters: ["Ω"] },
    ]);
  });

  it("lists each character once per section", () => {
    const cv = makeCv({ summary: "ł ł ł ź ł" });
    assert.deepEqual(checkCvCharacters(cv), [
      { section: "Summary", characters: ["ł", "ź"] },
    ]);
  });

  it("returns nothing for a clean CV, including the supported punctuation", () => {
    const cv = makeCv({
      contact: { fullName: "José Muñoz", email: "j@example.com", links: [] },
      summary: "Built “things” – quickly … for £5 or €5.",
      experience: [{ title: "Dev", achievements: ["• nothing odd"] }],
    });
    assert.deepEqual(checkCvCharacters(cv), []);
  });

  it("looks at the contact links too", () => {
    const cv = makeCv({
      contact: { links: [{ label: "Блог", url: "https://example.com" }] },
    });
    assert.equal(checkCvCharacters(cv)[0].section, "Contact");
  });
});

describe("checkLetterCharacters", () => {
  it("uses the section name 'Cover letter'", () => {
    assert.deepEqual(checkLetterCharacters("Hello ł\n\nWorld"), [
      { section: "Cover letter", characters: ["ł"] },
    ]);
    assert.deepEqual(checkLetterCharacters("Hello\n\nWorld"), []);
  });
});

describe("formatUnsupportedMessage", () => {
  it("names the sections and the characters", () => {
    assert.equal(
      formatUnsupportedMessage([
        { section: "Summary", characters: ["ł", "ź"] },
        { section: "Experience", characters: ["Ж"] },
      ]),
      "These characters can't be shown in the PDF: ł, ź (Summary); Ж (Experience). Remove or replace them to download.",
    );
  });

  it("lists at most 10 characters per section, then 'and N more'", () => {
    const characters = [..."абвгдежзиклмн"]; // 13
    const message = formatUnsupportedMessage([
      { section: "Experience", characters },
    ]);
    assert.ok(
      message.includes("а, б, в, г, д, е, ж, з, и, к and 3 more (Experience)"),
    );
    assert.ok(!message.includes("н"));
  });

  it("names invisible characters by their code", () => {
    const message = formatUnsupportedMessage([
      { section: "Summary", characters: ["​", "\u0007"] },
    ]);
    assert.ok(message.includes("U+200B, U+0007 (Summary)"));
  });
});
