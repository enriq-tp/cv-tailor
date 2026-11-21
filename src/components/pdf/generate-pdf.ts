// Turns data into a PDF file IN THE BROWSER. Nothing is sent anywhere.
//
// This is the ONLY file that loads react-pdf, and it does it with `await import(...)` INSIDE
// the functions: the library is big, and most visits to /result never press a download button.
// A dynamic import makes the bundler put react-pdf (and the two document modules, which
// import it) in separate chunks that the browser fetches on first use. If this file imported
// them at the top, they would land in the initial JavaScript of the page.
//
// It is also the ONLY file allowed to use URL.createObjectURL (see downloadPdf).
//
// Privacy: no logging, and errors are never passed on. A failure becomes a safe category,
// because an error from a library may contain pieces of the document.

import type { Result } from "@/lib/result";
import type { Cv } from "@/lib/schemas";

export type GeneratedPdf = { blob: Blob; pageCount: number };
export type GenerateError = { category: "generation_failed" };
export type GenerateResult = Result<GeneratedPdf, GenerateError>;

export const CV_FILE_NAME = "cv-tailored.pdf";
export const LETTER_FILE_NAME = "cover-letter.pdf";

const FAILED: GenerateResult = {
  ok: false,
  error: { category: "generation_failed" },
};

/** The CV as a PDF. `cv` is exactly the data the preview shows. */
export async function generateCvPdf(cv: Cv): Promise<GenerateResult> {
  try {
    const [{ pdf }, { CvDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./cv-document"),
    ]);
    let pageCount = 0;
    const blob = await pdf(
      CvDocument({ cv, onPageCount: (n) => (pageCount = n) }),
    ).toBlob();
    return finish(blob, pageCount);
  } catch {
    return FAILED; // the error is dropped on purpose (see the top of the file)
  }
}

/** The cover letter as a PDF. `text` is the draft as the user sees it. */
export async function generateLetterPdf(
  contact: Cv["contact"],
  text: string,
): Promise<GenerateResult> {
  try {
    const [{ pdf }, { LetterDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./letter-document"),
    ]);
    let pageCount = 0;
    const blob = await pdf(
      LetterDocument({ contact, text, onPageCount: (n) => (pageCount = n) }),
    ).toBlob();
    return finish(blob, pageCount);
  } catch {
    return FAILED;
  }
}

// If the page counter never reported (pageCount stays 0) or the file is empty, something is
// wrong with the generation. We fail loudly instead of guessing: a wrong page count would hide
// the "long document" warning, and an empty blob would download a broken file.
function finish(blob: Blob, pageCount: number): GenerateResult {
  if (blob.size === 0 || pageCount < 1) return FAILED;
  return { ok: true, value: { blob, pageCount } };
}

// How long the temporary link stays valid after the click.
const REVOKE_AFTER_MS = 1000;

/**
 * Starts the download of a generated PDF.
 *
 * URL.createObjectURL makes a temporary address ("blob:...") for a file that lives only in
 * memory. It is the one use of createObjectURL allowed in this project, and only for the PDF
 * WE generated (never for the file the user uploaded: that file is never read).
 *
 * The address must be released with revokeObjectURL, otherwise the browser keeps the whole
 * file in memory until the tab is closed. We release it a moment AFTER the click, not in the
 * same line: click() only asks the browser to start the download, and some browsers read the
 * address a tick later, so revoking at once could cancel the download. One second is
 * plenty, and the blob is small.
 */
export function downloadPdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
