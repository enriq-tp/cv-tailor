"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeDecision, SuggestedChange } from "@/lib/mock";
import {
  maxLengthForTarget,
  normalizeEditedText,
  validateEditedText,
} from "@/lib/result/validate-edit";
import { FieldError } from "../field-error";

type Props = {
  change: SuggestedChange;
  number: number; // 1-based position in the list
  total: number;
  decision: ChangeDecision;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  onEdit: (text: string) => void;
};

const BUTTON =
  "min-h-11 rounded-md border-2 border-cobalt px-4 font-medium text-cobalt hover:bg-drag";
const PRIMARY_BUTTON =
  "min-h-11 rounded-md bg-cobalt px-4 font-medium text-paper transition-colors hover:bg-cobalt-dark";

// The status in words (plus an icon): colour is never the only signal.
function statusWord(decision: ChangeDecision): string {
  if (decision.status === "accepted") {
    return decision.editedText !== undefined
      ? "Edited and accepted"
      : "Accepted";
  }
  return decision.status === "rejected" ? "Rejected" : "Pending";
}

const STATUS_STYLE = {
  pending: "text-slate",
  accepted: "text-covered",
  rejected: "text-brick",
} as const;

const STATUS_ICON = {
  pending: <circle cx="10" cy="10" r="6" />,
  accepted: <path d="M4.5 10.5l3.5 3.5 7.5-8" />,
  rejected: <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />,
} as const;

export function ChangeCard({
  change,
  number,
  total,
  decision,
  onAccept,
  onReject,
  onUndo,
  onEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const acceptButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasEditing = useRef(false);

  const id = `change-${change.id}`;
  const heading = `Change ${number} of ${total}: ${change.section}, ${change.label}`;
  // Short name used in the button labels, so each button says WHICH change it acts on.
  const buttonTarget = `change ${number}: ${change.section}, ${change.label}`;
  const currentText = decision.editedText ?? change.after;
  const max = maxLengthForTarget(change.target);

  // Focus: into the textarea when editing opens, back to the Edit button when it closes.
  useEffect(() => {
    if (editing) {
      wasEditing.current = true;
      textareaRef.current?.focus();
    } else if (wasEditing.current) {
      wasEditing.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  function startEdit() {
    setText(currentText);
    setError(null);
    setEditing(true);
  }

  function save() {
    const problem = validateEditedText(change.target, text);
    if (problem) {
      setError(problem); // stay in edit mode, nothing is saved
      return;
    }
    // Store exactly the text that was validated (validateEditedText normalises the same way).
    onEdit(normalizeEditedText(change.target, text));
    setEditing(false);
  }

  return (
    <div
      role="group"
      aria-labelledby={`${id}-heading`}
      className="min-w-0 px-4 py-5 md:px-5"
    >
      <h3
        id={`${id}-heading`}
        className="font-heading text-lg font-semibold wrap-break-word"
      >
        {heading}
      </h3>

      <dl className="mt-3 grid gap-3">
        <div>
          <dt className="font-medium text-slate">Before</dt>
          <dd className="wrap-break-word">{change.before}</dd>
        </div>
        <div className="border-l-4 border-cobalt pl-3">
          <dt className="font-medium text-slate">After</dt>
          <dd className="wrap-break-word">{currentText}</dd>
        </div>
      </dl>

      <p
        className={`mt-3 flex items-center gap-2 font-medium ${STATUS_STYLE[decision.status]}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-[18px] shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {STATUS_ICON[decision.status]}
        </svg>
        {statusWord(decision)}
      </p>

      {editing ? (
        <div className="mt-3">
          <label htmlFor={`${id}-edit`} className="font-medium">
            Edit the new text for change {number}
          </label>
          <textarea
            id={`${id}-edit`}
            ref={textareaRef}
            value={text}
            rows={4}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-count ${id}-error`}
            className="mt-1 block w-full rounded-sm border-2 border-edge bg-paper p-2"
          />
          {/* A counter, not a live region: it must not be announced on every key. No
              maxLength attribute: it would silently cut pasted text. The message explains. */}
          <p id={`${id}-count`} className="mt-1 text-slate">
            {[...normalizeEditedText(change.target, text)].length} / {max}
          </p>
          <div id={`${id}-error`} aria-live="polite" className="mt-1 min-h-6">
            {error ? <FieldError>{error}</FieldError> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={save} className={PRIMARY_BUTTON}>
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={BUTTON}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {/* Accept, Reject and Edit never disappear while the user presses them: a button
              that vanishes would drop the keyboard focus. Only Undo comes and goes, and
              pressing it moves focus to Accept. */}
          <button
            type="button"
            ref={acceptButtonRef}
            onClick={onAccept}
            aria-label={`Accept ${buttonTarget}`}
            className={PRIMARY_BUTTON}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={onReject}
            aria-label={`Reject ${buttonTarget}`}
            className={BUTTON}
          >
            Reject
          </button>
          <button
            type="button"
            ref={editButtonRef}
            onClick={startEdit}
            aria-label={`Edit ${buttonTarget}`}
            className={BUTTON}
          >
            Edit
          </button>
          {decision.status !== "pending" && (
            <button
              type="button"
              onClick={() => {
                onUndo();
                acceptButtonRef.current?.focus();
              }}
              aria-label={`Undo ${buttonTarget}`}
              className={BUTTON}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
