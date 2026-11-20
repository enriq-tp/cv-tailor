"use client";

import { useEffect, useRef, useState } from "react";
import type { CoverLetterQuestion } from "@/lib/mock";
import { FieldError } from "../field-error";
import { displayTopic } from "./topic-text";

const BUTTON =
  "min-h-11 rounded-md border-2 border-cobalt px-4 font-medium text-cobalt hover:bg-drag";
const PRIMARY_BUTTON =
  "min-h-11 rounded-md bg-cobalt px-4 font-medium text-paper transition-colors hover:bg-cobalt-dark";

// One hint per kind. The old "skip if you don't have this experience" hint is gone: for gap
// questions the honest path is now the "I don't have this experience" button.
const HINTS = {
  gap: "No experience with this? Say so and we'll ask one optional follow-up. Skip leaves it out of the letter.",
  followUp: "Optional. Skip leaves it out of the letter.",
  general: "Optional. Skip leaves it out of the letter.",
} as const;

type Props = {
  question: CoverLetterQuestion;
  focusOnMount: boolean; // false on first load, so the page does not steal focus
  onAnswer: (text: string) => void;
  onNoExperience: () => void;
  onSkip: () => void;
};

// The question being asked now, with its own textarea state (a new question = a new form,
// so the text box starts empty).
export function QuestionForm({
  question,
  focusOnMount,
  onAnswer,
  onNoExperience,
  onSkip,
}: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const id = `question-${question.id}`;
  const isFollowUp = question.kind === "followUp";

  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  // Accessible names say WHICH question a button acts on (several forms appear over time).
  // The topic is plain text: in Phase 2 it derives from untrusted job text, so it always goes
  // through displayTopic (one line, capped) before it is shown or used in a name.
  const topic = displayTopic(question.topic);
  const answerName = isFollowUp
    ? `Answer the follow-up on ${topic}`
    : `Answer: ${topic}`;
  const skipName = isFollowUp
    ? `Skip the follow-up on ${topic}`
    : `Skip: ${topic}`;
  const noExperienceName = `I don't have this experience: ${topic}`;

  function answer() {
    // A blank answer must never advance the flow (the flow helpers would accept it).
    if (text.trim() === "") {
      setError("Write an answer, or use Skip.");
      return;
    }
    onAnswer(text.trim());
  }

  return (
    <div className="mt-4">
      {isFollowUp && (
        <p className="text-slate wrap-break-word">Follow-up on {topic}</p>
      )}
      <label htmlFor={id} className="block text-lg font-medium">
        {question.question}
      </label>
      <textarea
        id={id}
        ref={ref}
        value={text}
        rows={4}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint ${id}-error`}
        className="mt-2 block w-full rounded-sm border-2 border-edge bg-paper p-2"
      />
      <p id={`${id}-hint`} className="mt-1 text-slate">
        {HINTS[question.kind]}
      </p>
      <div id={`${id}-error`} aria-live="polite" className="mt-1 min-h-6">
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={answer}
          aria-label={answerName}
          className={PRIMARY_BUTTON}
        >
          Answer
        </button>
        {question.kind === "gap" && (
          <button
            type="button"
            onClick={onNoExperience}
            aria-label={noExperienceName}
            className={BUTTON}
          >
            I don&apos;t have this experience
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          aria-label={skipName}
          className={BUTTON}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
