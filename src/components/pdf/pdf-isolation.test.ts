// Isolation and privacy test for src/components/pdf (like the one in src/lib/mock/mock.test.ts).
// It reads the SOURCE of the non-test files and checks what they must never contain. Rules:
// - the PDF code runs in the browser, so it must not touch the server-only code (logger,
//   database, the PDF loader) or log anything;
// - react-pdf is loaded lazily: dynamic import in generate-pdf.ts, static only in the
//   document and style modules (which generate-pdf.ts itself loads lazily);
// - URL.createObjectURL appears in ONE place, generate-pdf.ts.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const srcDir = path.join(process.cwd(), "src");
const pdfDir = path.join(srcDir, "components", "pdf");
const resultDir = path.join(srcDir, "components", "result");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"))
    .map((f) => path.join(dir, f));
}

const pdfFiles = sourceFiles(pdfDir);
const name = (file: string) => path.basename(file);

// Module names a file imports. `import type` lines are skipped on purpose: they are erased
// at build time, so they put nothing in the bundle.
function valueImports(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(
    /^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm,
  )) {
    found.push(match[1]);
  }
  for (const match of source.matchAll(/^import\s+["']([^"']+)["']/gm)) {
    found.push(match[1]);
  }
  return found;
}

function dynamicImports(source: string): string[] {
  return [...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map(
    (m) => m[1],
  );
}

describe("src/components/pdf isolation", () => {
  it("finds the source files", () => {
    const names = pdfFiles.map(name);
    for (const expected of [
      "cv-document.tsx",
      "letter-document.tsx",
      "generate-pdf.ts",
      "pdf-styles.ts",
      "supported-characters.ts",
    ]) {
      assert.ok(names.includes(expected), expected);
    }
  });

  it("imports no server-only module, no PDF loader and no zod schemas (as values)", () => {
    const forbidden = [
      "unpdf",
      "pino",
      "@/lib/extractors",
      "@/lib/logger",
      "@/lib/db",
      "@/lib/schemas",
    ];
    for (const file of pdfFiles) {
      const source = readFileSync(file, "utf8");
      for (const specifier of [
        ...valueImports(source),
        ...dynamicImports(source),
      ]) {
        for (const bad of forbidden) {
          assert.ok(
            !(specifier === bad || specifier.startsWith(`${bad}/`)),
            `${name(file)} imports ${specifier}`,
          );
        }
      }
    }
  });

  it("never logs, stores, fetches or injects HTML", () => {
    const banned = [
      "console.",
      "localStorage",
      "sessionStorage",
      "fetch(",
      "dangerouslySetInnerHTML",
    ];
    for (const file of pdfFiles) {
      const source = readFileSync(file, "utf8");
      for (const word of banned) {
        assert.ok(!source.includes(word), `${name(file)} contains ${word}`);
      }
    }
  });

  it("createObjectURL appears only in generate-pdf.ts, and the URL is revoked there", () => {
    const using = pdfFiles.filter((f) =>
      readFileSync(f, "utf8").includes("createObjectURL"),
    );
    assert.deepEqual(using.map(name), ["generate-pdf.ts"]);
    const source = readFileSync(using[0], "utf8");
    assert.ok(source.includes("revokeObjectURL"));
  });

  it("react-pdf is imported dynamically in generate-pdf.ts", () => {
    const source = readFileSync(path.join(pdfDir, "generate-pdf.ts"), "utf8");
    const values = valueImports(source);
    assert.ok(!values.some((s) => s.startsWith("@react-pdf")), "static import");
    assert.ok(!values.includes("./cv-document"));
    assert.ok(!values.includes("./letter-document"));
    const dynamic = dynamicImports(source);
    for (const expected of [
      "@react-pdf/renderer",
      "./cv-document",
      "./letter-document",
    ]) {
      assert.ok(dynamic.includes(expected), `no dynamic import of ${expected}`);
    }
  });

  it("react-pdf is imported statically only by the document and style modules", () => {
    const allowed = ["cv-document.tsx", "letter-document.tsx", "pdf-styles.ts"];
    for (const file of pdfFiles) {
      const imports = valueImports(readFileSync(file, "utf8"));
      const usesReactPdf = imports.some((s) => s.startsWith("@react-pdf"));
      assert.equal(usesReactPdf, allowed.includes(name(file)), name(file));
    }
  });

  it("no result component loads react-pdf, the document modules or the styles directly", () => {
    const files = sourceFiles(resultDir);
    assert.ok(files.length > 5);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const all = [...valueImports(source), ...dynamicImports(source)];
      for (const specifier of all) {
        assert.ok(
          !specifier.startsWith("@react-pdf"),
          `${name(file)}: ${specifier}`,
        );
        assert.ok(
          !/pdf\/(cv-document|letter-document|pdf-styles)$/.test(specifier),
          `${name(file)}: ${specifier}`,
        );
      }
      assert.ok(
        !source.includes("createObjectURL"),
        `${name(file)} uses createObjectURL`,
      );
    }
  });
});
