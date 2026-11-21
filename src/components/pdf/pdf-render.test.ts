// Tests that RENDER the PDF templates to real PDF bytes (renderToBuffer, the Node API of
// react-pdf) and read them back with the project's own PDF loader. They prove what an ATS
// would see: the text is real, in reading order, and complete.
// All data is synthetic (an invented person). Files are .ts, so the documents are called as
// plain functions instead of using JSX.
//
// These imports of react-pdf and of the loader are allowed ONLY in test files (see
// pdf-isolation.test.ts): in the browser the loader (unpdf, pino) must never appear.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { createLogger } from "@/lib/logger";
import { getMockResult } from "@/lib/mock";
import { loadPdf } from "@/lib/extractors/pdf-loader";
import type { Cv } from "@/lib/schemas";
import { CvDocument } from "./cv-document";
import { LetterDocument } from "./letter-document";
import {
  SUPPORTED_CHARACTERS,
  checkCvCharacters,
  checkLetterCharacters,
  normaliseCharacter,
} from "./supported-characters";

// The loader logs "pdf loaded"; send those lines nowhere.
const quietLogger = createLogger({ write: () => {} });

type Read = {
  /** All pages joined with a newline. */
  text: string;
  pages: string[];
  pageCount: number;
  hasExtractableText: boolean;
};

async function readBack(
  // renderToBuffer wants a <Document> element; JSX.Element from our components fits.
  element: ReactElement,
): Promise<Read> {
  const buffer = await renderToBuffer(element as never);
  const result = await loadPdf(buffer, { logger: quietLogger, maxPages: 100 });
  assert.ok(result.ok, "the loader could not read the generated PDF");
  const { pages, pageCount, hasExtractableText } = result.value;
  return {
    text: pages.map((p) => p.text).join("\n"),
    pages: pages.map((p) => p.text),
    pageCount,
    hasExtractableText,
  };
}

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

function fullCv(): Cv {
  return makeCv({
    contact: {
      fullName: "Ada Testperson",
      email: "ada.testperson@example.com",
      phone: "+44 7700 900000",
      location: "Testville",
      links: [{ label: "Portfolio", url: "https://example.com/ada" }],
    },
    summary: "Engineer who writes careful software for invented companies.",
    experience: [
      {
        company: "Alpha Testing Ltd",
        title: "Senior Tester",
        location: "Testville",
        startDate: "2020-01",
        endDate: "Present",
        isCurrent: true,
        achievements: [
          "Wrote the first sample suite.",
          "Reviewed sample code.",
        ],
      },
      {
        company: "Beta Fixtures Inc",
        title: "Junior Tester",
        location: "Samplebury",
        startDate: "2017-05",
        endDate: "2019-12",
        isCurrent: false,
        achievements: ["Fixed sample bugs."],
      },
    ],
    education: [
      {
        institution: "Example University",
        degree: "BSc",
        field: "Testing",
        startDate: "2013",
        endDate: "2017",
      },
    ],
    skills: ["Jest", "Playwright", "SQL"],
    projects: [
      {
        name: "Sample Project",
        description: "A made-up open source tool.",
        url: "https://example.com/tool",
        technologies: ["TypeScript", "Node.js"],
      },
    ],
    languages: [{ name: "English", proficiency: "Native" }],
  });
}

// A CV that cannot fit on two pages.
function longCv(): Cv {
  return makeCv({
    contact: { fullName: "Ada Testperson", links: [] },
    experience: Array.from({ length: 12 }, (_, job) => ({
      company: `Company ${job}`,
      title: `Role ${job}`,
      location: "Testville",
      startDate: "2010",
      endDate: "2011",
      isCurrent: false,
      achievements: Array.from(
        { length: 8 },
        (_, n) =>
          `Sample achievement number ${n} in job ${job}, written with enough words to take a full line of the page.`,
      ),
    })),
  });
}

describe("CV template: text and reading order", () => {
  it("extracts real text, in reading order", async () => {
    const read = await readBack(CvDocument({ cv: fullCv() }));
    assert.ok(read.hasExtractableText);

    const order = [
      "Ada Testperson",
      "ada.testperson@example.com",
      "Summary",
      "Engineer who writes careful software",
      "Experience",
      "Senior Tester, Alpha Testing Ltd",
      "Wrote the first sample suite.",
      "Reviewed sample code.",
      "Junior Tester, Beta Fixtures Inc",
      "Fixed sample bugs.",
      "Education",
      "BSc, Testing",
      "Skills",
      "Jest, Playwright, SQL",
      "Projects",
      "Sample Project",
      "Languages",
      "English (Native)",
    ];
    let last = -1;
    for (const part of order) {
      const index = read.text.indexOf(part);
      assert.ok(index >= 0, `missing in the PDF text: ${part}`);
      assert.ok(index > last, `out of order: ${part}`);
      last = index;
    }
  });

  it("prints the contact items on ONE line separated by ' | ', and the dates as 'start - end'", async () => {
    const read = await readBack(CvDocument({ cv: fullCv() }));
    assert.ok(
      read.text.includes(
        "ada.testperson@example.com | +44 7700 900000 | Testville | Portfolio: https://example.com/ada",
      ),
    );
    assert.ok(read.text.includes("Testville | 2020-01 - Present"));
    assert.ok(read.text.includes("Samplebury | 2017-05 - 2019-12"));
  });

  it("keeps a bullet on the same line as its text (the bullet mark is read first)", async () => {
    const read = await readBack(CvDocument({ cv: fullCv() }));
    assert.ok(read.text.includes("• Wrote the first sample suite."), read.text);
  });
});

describe("CV template: empty fields", () => {
  it("leaves no blank labels, sections or stray separators", async () => {
    const cv = makeCv({
      contact: { fullName: "Ada Testperson", links: [] },
      experience: [
        {
          title: "Tester",
          company: "Alpha Testing Ltd",
          achievements: ["Did a sample thing."],
        },
      ],
    });
    const read = await readBack(CvDocument({ cv }));

    assert.ok(read.text.includes("Experience"));
    for (const heading of [
      "Summary",
      "Education",
      "Skills",
      "Projects",
      "Languages",
    ]) {
      assert.ok(!read.text.includes(heading), `unexpected: ${heading}`);
    }
    assert.ok(!/\|\s*$/m.test(read.text), "a separator at the end of a line");
    assert.ok(!/^\s*\|/m.test(read.text), "a separator at the start of a line");
    assert.ok(!read.text.includes("undefined"));
    assert.ok(!read.text.includes("null"));
    assert.ok(!read.text.includes("Present"), "no dates, so no 'Present'");
  });

  it("a contact with only an email has no separator", async () => {
    const cv = makeCv({ contact: { email: "ada@example.com", links: [] } });
    const read = await readBack(CvDocument({ cv }));
    assert.ok(read.text.includes("ada@example.com"));
    assert.ok(!read.text.includes("|"));
  });

  it("a CV with nothing at all still renders one valid page", async () => {
    const read = await readBack(CvDocument({ cv: makeCv() }));
    assert.equal(read.pageCount, 1);
  });
});

describe("CV template: page count", () => {
  it("a normal CV is 1 or 2 pages, and the callback equals the real page count", async () => {
    let counted = 0;
    const read = await readBack(
      CvDocument({ cv: fullCv(), onPageCount: (n) => (counted = n) }),
    );
    assert.ok(read.pageCount >= 1 && read.pageCount <= 2);
    assert.equal(counted, read.pageCount);
  });

  it("a very long CV flows onto 3 or more pages, and the callback agrees with the PDF", async () => {
    let counted = 0;
    const read = await readBack(
      CvDocument({ cv: longCv(), onPageCount: (n) => (counted = n) }),
    );
    assert.ok(read.pageCount >= 3, `pages: ${read.pageCount}`);
    assert.equal(counted, read.pageCount);
    // Nothing is cut: the last bullet of the last job is still there.
    assert.ok(read.text.includes("achievement number 7 in job 11"));
  });

  it("the page counter adds no text and no visible content", async () => {
    const without = await readBack(CvDocument({ cv: fullCv() }));
    const withCounter = await readBack(
      CvDocument({ cv: fullCv(), onPageCount: () => {} }),
    );
    assert.deepEqual(withCounter.pages, without.pages);
  });
});

describe("characters", () => {
  it("accented characters survive", async () => {
    const cv = makeCv({
      contact: { fullName: "José Muñoz Fürst-Çelik", links: [] },
      experience: [
        {
          title: "Ingeniería",
          company: "Müller",
          achievements: ["Diseñó el sistema de facturación en París."],
        },
      ],
      skills: ["Café", "Señal", "Größe", "Français"],
    });
    const read = await readBack(CvDocument({ cv }));
    for (const part of [
      "José Muñoz Fürst-Çelik",
      "Ingeniería, Müller",
      "Diseñó el sistema de facturación en París.",
      "Café, Señal, Größe, Français",
    ]) {
      assert.ok(read.text.includes(part), `missing: ${part}`);
    }
  });

  it("round trip: EVERY supported character reads back as expected", async () => {
    // One bullet per character, with a number and letters around it, so each is checked on
    // its own: "T12 a<char>b E". NBSP and the soft hyphen are normalised before rendering,
    // so the expected value goes through normaliseCharacter.
    const chars = SUPPORTED_CHARACTERS;
    const cv = makeCv({
      experience: [
        {
          title: "Round trip",
          achievements: chars.map((c, i) => `T${i} a${c}b E`),
        },
      ],
    });
    const read = await readBack(CvDocument({ cv }));

    const failures = chars.filter((c, i) => {
      const expected = `T${i} a${normaliseCharacter(c)}b E`;
      return !read.text.includes(expected);
    });
    assert.deepEqual(
      failures.map((c) => `U+${c.codePointAt(0)!.toString(16)}`),
      [],
      "these supported characters did not read back identically",
    );

    // The ones the owner named explicitly, plus a check that the set is not accidentally empty.
    for (const c of "éñüç–—“”’…•€£") {
      assert.ok(SUPPORTED_CHARACTERS.includes(c), c);
    }
    // 95 ASCII + 96 Latin-1 + 27 Windows-1252 extras - the micro sign (it reads back as the
    // Greek mu, see supported-characters.ts).
    assert.equal(chars.length, 95 + 96 + 27 - 1);
    assert.ok(!chars.includes("µ"));
  });

  it("hyphenation is off: a very long word is extracted whole", async () => {
    const word = "abcdefghij".repeat(8); // 80 letters, no spaces or hyphens
    const cv = makeCv({
      experience: [
        {
          title: "Tester",
          achievements: [
            `Introduced a very long made-up word into the pipeline: ${word} and kept going.`,
          ],
        },
      ],
    });
    const read = await readBack(CvDocument({ cv }));
    assert.ok(read.text.includes(word), "the word was split across lines");
  });
});

describe("metadata", () => {
  // The document info (title, author...) is plain text in the file, outside the compressed
  // page content. We look at the raw bytes only to check what IS and what is NOT there:
  // the generic title as a string object, and none of the personal keys. (Checked on react-pdf
  // 4.9.0: the title is written as an object "(CV)" referenced by "/Title".)
  async function rawOf(element: ReactElement): Promise<string> {
    const buffer = await renderToBuffer(element as never);
    return buffer.toString("latin1");
  }

  function assertNoPersonalKeys(raw: string) {
    for (const key of ["/Author", "/Subject", "/Keywords"]) {
      assert.ok(!raw.includes(key), `${key} is set`);
    }
    assert.ok(!raw.includes("Ada"), "the name appears in clear text");
    assert.ok(
      !raw.includes("example.com"),
      "contact data appears in clear text",
    );
  }

  it("the CV carries the generic title and no personal metadata", async () => {
    const raw = await rawOf(CvDocument({ cv: fullCv() }));
    assert.ok(/\/Title \d+ 0 R/.test(raw), "no /Title entry");
    assert.ok(raw.includes("\n(CV)\n"), "title is not 'CV'");
    assertNoPersonalKeys(raw);
  });

  it("the letter has its own generic title and no personal metadata", async () => {
    const raw = await rawOf(
      LetterDocument({
        contact: {
          fullName: "Ada Testperson",
          email: "ada@example.com",
          links: [],
        },
        text: "Hello.",
      }),
    );
    assert.ok(
      raw.includes("\n(Cover letter)\n"),
      "title is not 'Cover letter'",
    );
    assertNoPersonalKeys(raw);
  });
});

describe("cover letter template", () => {
  const contact = {
    fullName: "Ada Testperson",
    email: "ada.testperson@example.com",
    links: [],
  };
  const normalDraft = [
    "Dear Hiring Team,",
    "I am writing about the sample role. First paragraph of a made-up letter.",
    "Second paragraph. It has a few sentences. None of them are real.",
    "Kind regards,\nAda Testperson",
  ].join("\n\n");

  it("fits one page and keeps the paragraphs in order", async () => {
    let counted = 0;
    const read = await readBack(
      LetterDocument({
        contact,
        text: normalDraft,
        onPageCount: (n) => (counted = n),
      }),
    );
    assert.equal(read.pageCount, 1);
    assert.equal(counted, 1);

    let last = -1;
    for (const part of [
      "Ada Testperson",
      "Dear Hiring Team,",
      "First paragraph of a made-up letter.",
      "Second paragraph.",
      "Kind regards,",
    ]) {
      const index = read.text.indexOf(part);
      assert.ok(index > last, `missing or out of order: ${part}`);
      last = index;
    }
  });

  it("keeps a single line break inside a paragraph as a line break", async () => {
    const read = await readBack(LetterDocument({ contact, text: normalDraft }));
    assert.ok(/Kind regards,\s*\n\s*Ada Testperson/.test(read.text), read.text);
  });

  it("a long draft flows to a second page and the callback reports it", async () => {
    const paragraph =
      "This is a made-up paragraph that repeats so the letter becomes very long. ".repeat(
        6,
      );
    const long = Array.from({ length: 14 }, () => paragraph).join("\n\n");
    let counted = 0;
    const read = await readBack(
      LetterDocument({
        contact,
        text: long,
        onPageCount: (n) => (counted = n),
      }),
    );
    assert.ok(read.pageCount > 1, `pages: ${read.pageCount}`);
    assert.equal(counted, read.pageCount);
  });
});

describe("the sample (mock) result", () => {
  it("the sample CV and the sample letter each fit on one page", async () => {
    const result = await getMockResult(undefined, { delayMs: 0 });
    assert.ok(result.ok);
    const { tailoredCv, originalCv, initialDraft } = result.value;

    const cv = await readBack(CvDocument({ cv: tailoredCv }));
    assert.equal(cv.pageCount, 1);
    assert.deepEqual(checkCvCharacters(tailoredCv), []);

    const letter = await readBack(
      LetterDocument({ contact: originalCv.contact, text: initialDraft }),
    );
    assert.equal(letter.pageCount, 1);
    assert.deepEqual(checkLetterCharacters(initialDraft), []);
  });
});

describe("generate-pdf (the function the buttons call)", () => {
  it("returns a blob and the real page count, or a safe failure", async () => {
    const { generateCvPdf, generateLetterPdf } = await import("./generate-pdf");

    const cv = await generateCvPdf(fullCv());
    assert.ok(cv.ok);
    assert.ok(cv.value.blob.size > 0);
    assert.equal(cv.value.pageCount, 1);

    const letter = await generateLetterPdf({ links: [] }, "Hello.");
    assert.ok(letter.ok);
    assert.equal(letter.value.pageCount, 1);

    // Bad input makes react-pdf throw: only a category comes back, never the error.
    const broken = await generateCvPdf(null as never);
    assert.deepEqual(broken, {
      ok: false,
      error: { category: "generation_failed" },
    });
  });
});
