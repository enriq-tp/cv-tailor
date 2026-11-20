"use client";

import type { RefObject } from "react";
import { MAX_JOB_TEXT_CHARS, MIN_JOB_TEXT_CHARS } from "@/lib/limits";
import { FieldError } from "./field-error";
import { countCharacters, formatNumber } from "./form-validation";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

const HINT_ID = "job-hint";
const ERROR_ID = "job-error";

export function JobTextarea({
  value,
  onChange,
  onBlur,
  error,
  inputRef,
}: Props) {
  return (
    <div className="flex flex-col rounded-sm border-2 border-edge bg-paper pt-5 pb-4 shadow-[0_1px_0_var(--edge)]">
      <label
        htmlFor="job-text"
        className="px-5 font-heading text-2xl font-semibold"
      >
        Job posting
      </label>
      <p id={HINT_ID} className="mt-2 mb-3 px-5 text-slate">
        Paste the whole posting. At least {formatNumber(MIN_JOB_TEXT_CHARS)}{" "}
        characters.
      </p>

      <div className="notepad-field flex-1">
        <textarea
          id="job-text"
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Paste the job posting here"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${HINT_ID} ${ERROR_ID}`}
          className="notepad-textarea h-full text-base text-ink"
        />
      </div>

      {/* The counter is NOT a live region: it must not be announced on every keystroke. */}
      <p className="mt-2 px-5 text-slate">
        {formatNumber(countCharacters(value))} /{" "}
        {formatNumber(MAX_JOB_TEXT_CHARS)}
      </p>
      <div id={ERROR_ID} aria-live="polite" className="mt-1 min-h-6 px-5">
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    </div>
  );
}
