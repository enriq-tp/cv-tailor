// TEST-ONLY helper: builds a tiny valid PDF in memory from fake text.
// Why: no PDF file belongs in the repository (a real CV is personal data, and binary
// fixtures are opaque in code review). *.pdf is git-ignored; tests generate what they need.
// Do not import this file from production code. Use fake data only.

/** Escapes the characters that are special inside a PDF string: \ ( ) */
function escapePdfString(line: string): string {
  return line.replace(/[\\()]/g, (char) => `\\${char}`);
}

/**
 * Builds a minimal PDF. `pages` is a list of pages; each page is a list of text lines
 * (an empty list = a blank page, like a scanned page without a text layer).
 * Text must be Latin-1 (plain ASCII is safest).
 */
export function buildTestPdf(pages: string[][]): Buffer {
  const objects: string[] = [];
  const add = (body: string): number => objects.push(body); // returns the 1-based object number

  add("<< /Type /Catalog /Pages 2 0 R >>"); // object 1
  add(""); // object 2 (the page list), filled in below
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); // object 3

  const pageObjects: number[] = [];
  for (const lines of pages) {
    const stream = lines.length
      ? "BT /F1 12 Tf 14 TL 72 720 Td " +
        lines.map((line) => `(${escapePdfString(line)}) Tj T*`).join(" ") +
        " ET"
      : "";
    const content = add(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
    pageObjects.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      ),
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${pageObjects.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`;

  // File body, remembering where each object starts (the "xref" table points to them).
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(out, "latin1");
}
