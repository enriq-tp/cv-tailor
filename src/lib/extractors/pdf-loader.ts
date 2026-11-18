// PDF text loader: bytes in, text per page out. Server-side only.
// Library: unpdf (a serverless build of pdf.js). See docs/wiki/decisions.md.
//
// Design rules:
// - loadPdf NEVER throws. Expected problems (empty file, not a PDF, encrypted, ...) come
//   back as { ok: false, error: { category } } so the route can answer with a safe message.
// - PRIVACY: we log only sizes, page counts, durations and the error category. Never the
//   text, never the bytes, never an error object or message (it may contain file data).
//   Errors are classified by their `name` only.
// - The returned text is the raw extraction output. Cleaning is a separate step
//   (clean-pdf-text.ts).

import { extractText, getDocumentProxy } from "unpdf";
import type { Logger } from "pino";
import { logger as defaultLogger } from "@/lib/logger";
import type { Result } from "@/lib/result";

// ---- Limits (see decisions.md for the reasons) ---------------------------------------
export const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MiB: far above a normal CV (~100 KB)
export const MAX_PDF_PAGES = 10; // a CV is 1-2 pages; 10 leaves room for odd layouts
export const PDF_TIMEOUT_MS = 10_000; // a hostile PDF must not keep a request busy forever
// A scanned PDF is just pictures: it has no text layer, so extraction returns "" or a few
// stray characters. Below this many non-whitespace characters we treat it as "no text".
export const MIN_TEXT_CHARS = 30;

const PDF_HEADER = "%PDF-";
const HEADER_SEARCH_BYTES = 1024; // the PDF spec allows junk before the header, but only a little

// ---- Types ----------------------------------------------------------------------------
export type PdfErrorCategory =
  | "empty"
  | "not_a_pdf"
  | "corrupt"
  | "encrypted"
  | "too_large"
  | "too_many_pages"
  | "timeout"
  | "unknown";

export type PdfPage = { pageNumber: number; text: string };

export type PdfContent = {
  pages: PdfPage[];
  pageCount: number;
  /** Number of extracted characters (all pages, before cleaning). */
  charCount: number;
  /** False for scanned or image-only PDFs: the caller should ask the user to paste text. */
  hasExtractableText: boolean;
};

export type LoadPdfResult = Result<PdfContent, { category: PdfErrorCategory }>;

export type LoadPdfOptions = {
  maxFileBytes?: number;
  maxPages?: number;
  timeoutMs?: number;
  minTextChars?: number;
  /** Only for tests, to capture what gets logged. */
  logger?: Logger;
};

// ---- Error classification (by error NAME only, never the message) -------------------------
class PdfTimeoutError extends Error {
  constructor() {
    super("PDF extraction timed out");
    this.name = "PdfTimeoutError";
  }
}

/** Maps anything thrown while reading a PDF to a safe category. Reads `name` only. */
export function classifyPdfError(error: unknown): PdfErrorCategory {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? (error as { name: unknown }).name
      : undefined;
  if (name === "PdfTimeoutError") return "timeout";
  if (name === "PasswordException") return "encrypted"; // pdf.js: password needed
  if (name === "InvalidPDFException") return "corrupt"; // pdf.js: cannot parse the file
  return "unknown";
}

/**
 * Races `work` against a timer and rejects with PdfTimeoutError if the timer wins.
 * The timer is always cleared, otherwise it would keep the Node process alive.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PdfTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ---- The loader -----------------------------------------------------------------------------
export async function loadPdf(
  data: Uint8Array | Buffer,
  options: LoadPdfOptions = {},
): Promise<LoadPdfResult> {
  const {
    maxFileBytes = MAX_PDF_BYTES,
    maxPages = MAX_PDF_PAGES,
    timeoutMs = PDF_TIMEOUT_MS,
    minTextChars = MIN_TEXT_CHARS,
    logger = defaultLogger,
  } = options;

  const startedAt = Date.now();
  const sizeBytes = data?.byteLength ?? 0;

  const fail = (category: PdfErrorCategory): LoadPdfResult => {
    logger.warn(
      {
        sizeBytes,
        errorCategory: category,
        durationMs: Date.now() - startedAt,
      },
      "pdf load failed",
    );
    return { ok: false, error: { category } };
  };

  try {
    // Cheap checks first, before pdf.js sees the bytes.
    if (!data || sizeBytes === 0) return fail("empty");
    if (sizeBytes > maxFileBytes) return fail("too_large");
    if (!hasPdfHeader(data)) return fail("not_a_pdf");

    // If the timer wins, pdf.js keeps running in the background until it finishes; we
    // cannot cancel it, but the request is answered.
    const outcome = await withTimeout(
      readPdf(data, maxPages, minTextChars),
      timeoutMs,
    );

    if (!outcome.ok) return fail(outcome.error);

    logger.info(
      {
        sizeBytes,
        pageCount: outcome.value.pageCount,
        charCount: outcome.value.charCount,
        hasExtractableText: outcome.value.hasExtractableText,
        durationMs: Date.now() - startedAt,
      },
      "pdf loaded",
    );
    return { ok: true, value: outcome.value };
  } catch (error) {
    // Only the category leaves this function; the error object is dropped here.
    return fail(classifyPdfError(error));
  }
}

function hasPdfHeader(data: Uint8Array): boolean {
  return Buffer.from(data.subarray(0, HEADER_SEARCH_BYTES)).includes(
    PDF_HEADER,
  );
}

/** Opens the PDF, enforces the page limit BEFORE extracting, then extracts text per page. */
async function readPdf(
  data: Uint8Array,
  maxPages: number,
  minTextChars: number,
): Promise<Result<PdfContent, PdfErrorCategory>> {
  // pdf.js takes ownership of the memory it receives (it may detach it), so we give it a
  // COPY. The caller's Buffer stays intact. verbosity 0 = errors only: pdf.js prints
  // "Warning: ..." lines on malformed files, which is noise (they contain no file content).
  const proxy = await getDocumentProxy(new Uint8Array(data), { verbosity: 0 });
  try {
    if (proxy.numPages > maxPages)
      return { ok: false, error: "too_many_pages" };

    const { text } = await extractText(proxy, { mergePages: false });
    const pages = text.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText,
    }));
    const charCount = pages.reduce((sum, page) => sum + page.text.length, 0);
    const visibleChars = pages.reduce(
      (sum, page) => sum + page.text.replace(/\s/g, "").length,
      0,
    );

    return {
      ok: true,
      value: {
        pages,
        pageCount: proxy.numPages,
        charCount,
        hasExtractableText: visibleChars >= minTextChars,
      },
    };
  } finally {
    // Free pdf.js memory. A failure here must not hide the real result.
    try {
      await proxy.cleanup();
    } catch {
      // ignore
    }
  }
}
