"use client";

import { useEffect, useRef, useState } from "react";
import type { Result } from "@/lib/result";
import { FieldError } from "../field-error";
import { downloadPdf } from "../pdf/generate-pdf";
import type { GeneratedPdf, GenerateError } from "../pdf/generate-pdf";
import { formatUnsupportedMessage } from "../pdf/supported-characters";
import type { CharacterFinding } from "../pdf/supported-characters";

// One download button with its messages, used for the CV and for the cover letter.
//
// What happens when it is pressed (in this order):
// 1. CHECK (instant, no library loaded yet): are there characters the PDF cannot show?
//    If so, show them and stop: nothing is generated or downloaded.
// 2. PREPARE: "Preparing your PDF..." while react-pdf is loaded and the file is built.
//    Failure: an error and NO download, so a broken file is never offered.
// 3. TOO LONG? If the document has more pages than `maxPages`, ask first: "Download anyway"
//    (reuses the file that was already built) or "Keep editing". Nothing is ever cut.
// 4. Otherwise download at once and confirm in words.
//
// Privacy: the messages are shown on screen only. Nothing is logged or stored, and an error
// object is never shown (only a fixed sentence).

type Phase =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "unsupported"; message: string }
  | { kind: "failed" }
  | { kind: "tooLong"; blob: Blob; pages: number }
  | { kind: "done" };

type Props = {
  id: string;
  /** Visible text and accessible name, e.g. "Download CV". */
  label: string;
  /** Used in the warning, e.g. "CV" or "letter". */
  documentName: string;
  /** The confirmation, e.g. "CV downloaded." */
  doneMessage: string;
  /** One sentence after "This CV is 3 pages long.", e.g. "Most employers expect one or two." */
  lengthAdvice: string;
  fileName: string;
  /** A document with MORE pages than this triggers the warning. */
  maxPages: number;
  /**
   * Changes whenever the document content changes (the decisions, or the draft text).
   * A warning, an error or a prepared file belongs to ONE version of the content: if the
   * content changes, they are forgotten, so "Download anyway" can never download old content.
   */
  contentKey: unknown;
  /** Called at press time, so it always sees the current content. */
  findUnsupported: () => CharacterFinding[];
  generate: () => Promise<Result<GeneratedPdf, GenerateError>>;
};

const MESSAGE_ALERT =
  "The PDF could not be created. Nothing was downloaded. Try again.";

export function DownloadAction({
  id,
  label,
  documentName,
  doneMessage,
  lengthAdvice,
  fileName,
  maxPages,
  contentKey,
  findUnsupported,
  generate,
}: Props) {
  // The phase is stored together with the content it belongs to (see contentKey).
  const [state, setState] = useState<{ phase: Phase; key: unknown }>({
    phase: { kind: "idle" },
    key: contentKey,
  });
  const phase: Phase =
    state.key === contentKey ? state.phase : { kind: "idle" };

  // Refs, not state: they must be read FRESH inside the async code and by a fast double click.
  const busy = useRef(false);
  const latestKey = useRef(contentKey);
  const mounted = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    latestKey.current = contentKey;
  }, [contentKey]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function show(next: Phase, key: unknown) {
    setState({ phase: next, key });
  }

  async function handleClick() {
    if (busy.current) return; // aria-disabled does not stop clicks: this does
    const key = contentKey;

    // 1. Check first: cheap, and it avoids loading the PDF library for nothing.
    const findings = findUnsupported();
    if (findings.length > 0) {
      show(
        { kind: "unsupported", message: formatUnsupportedMessage(findings) },
        key,
      );
      return;
    }

    // 2. Prepare.
    busy.current = true;
    show({ kind: "preparing" }, key);
    const result = await generate();
    busy.current = false;

    // The user left the page, or changed the document while we were working: drop the result
    // silently instead of downloading something that no longer matches the screen.
    if (!mounted.current) return;
    if (latestKey.current !== key) {
      show({ kind: "idle" }, latestKey.current);
      return;
    }

    if (!result.ok) {
      show({ kind: "failed" }, key);
      return;
    }

    // 3. Too long: ask first.
    if (result.value.pageCount > maxPages) {
      show(
        {
          kind: "tooLong",
          blob: result.value.blob,
          pages: result.value.pageCount,
        },
        key,
      );
      return;
    }

    // 4. Download now.
    downloadPdf(result.value.blob, fileName);
    show({ kind: "done" }, key);
  }

  // Both buttons of the warning remove themselves when pressed. A button that disappears
  // drops keyboard focus to <body>, so focus goes back to the main button.
  function downloadAnyway() {
    if (phase.kind !== "tooLong") return;
    downloadPdf(phase.blob, fileName);
    show({ kind: "done" }, contentKey);
    buttonRef.current?.focus();
  }

  function keepEditing() {
    show({ kind: "idle" }, contentKey);
    buttonRef.current?.focus();
  }

  const preparing = phase.kind === "preparing";

  // Polite status text: progress, the long-document warning and the confirmation. The element
  // is always in the page and only its text changes (screen readers announce CHANGES in an
  // existing live region, not new elements).
  const statusText =
    phase.kind === "preparing"
      ? "Preparing your PDF..."
      : phase.kind === "tooLong"
        ? `This ${documentName} is ${phase.pages} pages long. ${lengthAdvice} Nothing was cut.`
        : phase.kind === "done"
          ? doneMessage
          : "";

  return (
    <div className="max-w-[60ch]">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-disabled={preparing}
        aria-busy={preparing}
        aria-describedby={`${id}-status ${id}-alert`}
        onClick={() => void handleClick()}
        className="min-h-11 rounded-md bg-cobalt px-6 font-medium text-paper transition-colors hover:bg-cobalt-dark aria-disabled:cursor-wait aria-disabled:bg-disabled aria-disabled:text-slate aria-disabled:hover:bg-disabled"
      >
        {label}
      </button>

      <p
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        className={
          phase.kind === "tooLong"
            ? "mt-2 border-l-4 border-cobalt bg-paper p-3"
            : "mt-2 min-h-6 text-slate"
        }
      >
        {statusText}
      </p>

      {phase.kind === "tooLong" && (
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadAnyway}
            className="min-h-11 rounded-md bg-cobalt px-4 font-medium text-paper transition-colors hover:bg-cobalt-dark"
          >
            Download anyway
          </button>
          <button
            type="button"
            onClick={keepEditing}
            className="min-h-11 rounded-md border-2 border-cobalt px-4 font-medium text-cobalt hover:bg-drag"
          >
            Keep editing
          </button>
        </div>
      )}

      {/* Errors: always in the page, only the content changes. */}
      <div id={`${id}-alert`} role="alert" className="mt-2">
        {phase.kind === "unsupported" && (
          <FieldError>{phase.message}</FieldError>
        )}
        {phase.kind === "failed" && <FieldError>{MESSAGE_ALERT}</FieldError>}
      </div>
    </div>
  );
}
