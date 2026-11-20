"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CvDropzone } from "./cv-dropzone";
import { JobTextarea } from "./job-textarea";
import { MIN_JOB_TEXT_CHARS } from "@/lib/limits";
import {
  MSG_CHOOSE_PDF,
  formatNumber,
  validateCvFiles,
  validateJobTextInput,
} from "./form-validation";

const HINT_ID = "submit-hint";

// Privacy: the file and the text live only in this component's state. Nothing is
// uploaded, stored, logged or put in the URL. Only file name and size are displayed.
export function TailorForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jobText, setJobText] = useState("");
  const [fileTouched, setFileTouched] = useState(false);
  const [jobTouched, setJobTouched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jobRef = useRef<HTMLTextAreaElement | null>(null);

  // File: checked as soon as it is chosen or dropped. A rejected file is not kept.
  function handleFiles(files: File[]) {
    const problem = validateCvFiles(files);
    setFileTouched(true);
    setFileError(problem);
    setFile(problem === null ? files[0] : null);
  }

  function handleRemove() {
    setFile(null);
    setFileError(null);
    // Back to "untouched": the missing-file error must not appear just because the
    // user pressed Remove. It comes back on the next submit attempt.
    setFileTouched(false);
    // Put focus back on the field: the Remove button disappears with the file.
    fileInputRef.current?.focus();
  }

  // Errors shown on screen. "Choose a PDF file." for a missing file only appears
  // once the user has tried to continue.
  const shownFileError =
    fileError ?? (fileTouched && !file ? MSG_CHOOSE_PDF : null);
  // "Too long" shows at once; "too short" only after the field was left once.
  const shownJobError = validateJobTextInput(jobText, jobTouched);

  const isValid = file !== null && validateJobTextInput(jobText) === null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid) {
      // The button is aria-disabled, not disabled, so it still receives the click.
      // Show every error and send the keyboard to the first field that needs work.
      setFileTouched(true);
      setJobTouched(true);
      if (file === null) fileInputRef.current?.focus();
      else jobRef.current?.focus();
      return;
    }
    // Nothing is passed along: no query string, no state, no storage.
    router.push("/result");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-10">
      <div className="grid items-stretch gap-6 md:grid-cols-2 md:gap-8">
        <CvDropzone
          file={file}
          error={shownFileError}
          onFiles={handleFiles}
          onRemove={handleRemove}
          inputRef={fileInputRef}
        />
        <JobTextarea
          value={jobText}
          onChange={setJobText}
          onBlur={() => setJobTouched(true)}
          error={shownJobError}
          inputRef={jobRef}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-end md:gap-5">
        {/* Always in the page: the button points to it with aria-describedby. */}
        <p id={HINT_ID} className="text-slate md:text-right">
          {isValid
            ? "Ready. Nothing is uploaded yet."
            : `Add a PDF and a job posting of at least ${formatNumber(MIN_JOB_TEXT_CHARS)} characters to continue.`}
        </p>
        <button
          type="submit"
          aria-disabled={!isValid}
          aria-describedby={HINT_ID}
          className="min-h-11 rounded-md bg-cobalt px-6 font-medium text-paper transition-colors hover:bg-cobalt-dark aria-disabled:cursor-not-allowed aria-disabled:bg-disabled aria-disabled:text-slate aria-disabled:hover:bg-disabled"
        >
          Tailor my CV
        </button>
      </div>
    </form>
  );
}
