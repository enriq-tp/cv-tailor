"use client";

import { useState } from "react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import { MAX_PDF_BYTES } from "@/lib/limits";
import { FieldError } from "./field-error";
import { formatFileSize } from "./form-validation";

type Props = {
  // Only name and size are ever shown. The file's content is never read here.
  file: { name: string; size: number } | null;
  error: string | null;
  // The parent validates and decides what to keep. We just report what the user gave us.
  onFiles: (files: File[]) => void;
  onRemove: () => void;
  // The parent needs the input to move focus to it when the form is submitted incomplete.
  inputRef: RefObject<HTMLInputElement | null>;
};

const HINT_ID = "cv-hint";
const FILE_ID = "cv-file";
const ERROR_ID = "cv-error";

// A drag only matters to us if it carries files (not selected text or a link).
function isFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes("Files");
}

export function CvDropzone({
  file,
  error,
  onFiles,
  onRemove,
  inputRef,
}: Props) {
  const [dragging, setDragging] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Reset so choosing the same file again still fires a change event.
    e.target.value = "";
    if (files.length > 0) onFiles(files);
  }

  // preventDefault on dragover and drop is required: otherwise the browser would
  // open the dropped PDF in this tab and the user would lose the page.
  function handleDragOver(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    // Ignore leave events fired when moving between children of the sheet.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragging(false);
    }
  }

  function handleDrop(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDragging(false);
    onFiles(Array.from(e.dataTransfer.files));
  }

  const describedBy = [HINT_ID, file ? FILE_ID : null, ERROR_ID]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="sheet flex aspect-[210/297] w-full max-w-[19rem] flex-col gap-3 rounded-sm p-5 transition-colors md:max-w-none"
      data-filled={file ? "true" : "false"}
      data-dragging={dragging ? "true" : "false"}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* The label wraps the real input. It is visually hidden (not display:none) so it
          stays in the tab order; Enter or Space opens the file picker. */}
      <label
        className={`flex flex-col gap-2 ${file ? "" : "flex-1 cursor-pointer"}`}
      >
        <span className="font-heading text-2xl font-semibold">Your CV</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={handleChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {file ? null : (
          <span className="mt-auto mb-auto text-lg">
            Drop a PDF here, or{" "}
            <span className="font-medium text-cobalt underline underline-offset-4">
              choose a file
            </span>
            .
          </span>
        )}
      </label>

      <p id={HINT_ID} className="text-slate">
        One PDF, up to {formatFileSize(MAX_PDF_BYTES)}.
      </p>

      {file ? (
        <div id={FILE_ID} className="flex flex-col gap-3">
          <p>
            <span className="block font-medium break-all">{file.name}</span>
            <span className="text-slate">{formatFileSize(file.size)}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="min-h-11 rounded-md border-2 border-cobalt px-4 font-medium text-cobalt hover:bg-drag"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="min-h-11 rounded-md px-4 font-medium text-ink underline underline-offset-4"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {/* Always in the page, so screen readers announce text added to it. */}
      <div id={ERROR_ID} aria-live="polite" className="mt-auto min-h-6">
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </div>
  );
}
