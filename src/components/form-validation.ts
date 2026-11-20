// Client-side checks for the input screen. Pure TypeScript, no React, no server code.
//
// These checks are only a convenience so the user sees problems immediately. The SERVER
// is authoritative and validates again (Phase 2). The limits come from src/lib/limits.ts,
// the only file safe to import in the browser (pdf-loader.ts and validate-job-text.ts
// pull pino and unpdf).

import {
  MAX_JOB_TEXT_CHARS,
  MAX_PDF_BYTES,
  MIN_JOB_TEXT_CHARS,
} from "@/lib/limits";

export type FileInfo = { name: string; type: string; size: number };

export const MSG_CHOOSE_PDF = "Choose a PDF file.";
export const MSG_ONE_PDF = "Drop one PDF at a time.";
export const MSG_EMPTY_FILE = "That file is empty. Choose a PDF with content.";

const KIB = 1024;
const MIB = 1024 * 1024;

// "1.5 KiB", "5 MiB". Always the same output on server and browser (no locale).
export function formatFileSize(bytes: number): string {
  if (bytes < KIB) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  if (bytes < MIB) return `${Number((bytes / KIB).toFixed(1))} KiB`;
  return `${Number((bytes / MIB).toFixed(1))} MiB`;
}

// 20000 -> "20,000". Fixed "en-US" so the text is identical on server and browser,
// otherwise React would report a hydration mismatch.
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// Some Windows setups report an empty MIME type for PDFs, so the extension counts too.
function looksLikePdf(file: FileInfo): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

// Returns an error message, or null when the file is acceptable.
export function validateCvFile(file: FileInfo): string | null {
  if (!looksLikePdf(file)) return MSG_CHOOSE_PDF;
  if (file.size === 0) return MSG_EMPTY_FILE;
  if (file.size > MAX_PDF_BYTES) {
    return `That file is over ${formatFileSize(MAX_PDF_BYTES)}. Choose a smaller PDF.`;
  }
  return null;
}

// For a drop or a file picker: the user may hand us zero, one or several files.
export function validateCvFiles(files: readonly FileInfo[]): string | null {
  if (files.length === 0) return MSG_CHOOSE_PDF;
  if (files.length > 1) return MSG_ONE_PDF;
  return validateCvFile(files[0]);
}

// Number of characters the same way the server counts them: trimmed, by code point,
// so an emoji counts as 1 (text.length would count it as 2).
// The server also collapses blank lines, so its count can differ slightly: the server wins.
export function countCharacters(text: string): number {
  return [...text.trim()].length;
}

// "Too long" is always reported. "Too short" only when `checkMinimum` is true: the screen
// passes false until the user has left the field once, so nobody sees an error while
// still typing the first words.
export function validateJobTextInput(
  text: string,
  checkMinimum = true,
): string | null {
  const count = countCharacters(text);
  if (count > MAX_JOB_TEXT_CHARS) {
    const extra = count - MAX_JOB_TEXT_CHARS;
    return `Too long: remove ${formatNumber(extra)} ${extra === 1 ? "character" : "characters"}.`;
  }
  if (checkMinimum && count < MIN_JOB_TEXT_CHARS) {
    return `Add at least ${formatNumber(MIN_JOB_TEXT_CHARS)} characters. You have ${formatNumber(count)}.`;
  }
  return null;
}
