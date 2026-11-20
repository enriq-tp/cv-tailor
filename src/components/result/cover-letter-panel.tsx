"use client";

import { useEffect, useRef, useState } from "react";
import { getMockCoverLetterDraft } from "@/lib/mock";
import type {
  CoverLetterAnswer,
  CoverLetterAnswers,
  CoverLetterQuestion,
} from "@/lib/mock";
import {
  getCurrentQuestion,
  getVisibleQuestions,
  summarizeAnswers,
} from "@/lib/result/question-flow";
import { FieldError } from "../field-error";
import { ConversationList } from "./conversation-list";
import { DownloadButton } from "./download-button";
import { QuestionForm } from "./question-form";

type Props = { questions: CoverLetterQuestion[]; initialDraft: string };
type DraftStatus = "idle" | "updating" | "updated" | "error";

const BUTTON =
  "min-h-11 rounded-md border-2 border-cobalt px-4 font-medium text-cobalt hover:bg-drag";

// Privacy: the answers and the draft live only in this component's state. Never logged,
// never in the URL or in browser storage.
export function CoverLetterPanel({ questions, initialDraft }: Props) {
  const [answers, setAnswers] = useState<CoverLetterAnswers>({});
  const [draft, setDraft] = useState(initialDraft);
  const [draftEdited, setDraftEdited] = useState(false);
  // A newer draft that was NOT applied because the user had edited the text by hand.
  const [proposed, setProposed] = useState<string | null>(null);
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [interacted, setInteracted] = useState(false);
  // Spoken (visually hidden) message when a follow-up question appears.
  const [announcement, setAnnouncement] = useState("");

  // Refs hold values that the async code below must read fresh (state would be stale there).
  const latestRequest = useRef(0);
  const draftEditedRef = useRef(false);
  const doneRef = useRef<HTMLHeadingElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  // The visibility rule (follow-ups only after "no experience") lives in question-flow.ts.
  const current = getCurrentQuestion(questions, answers);
  const handled = getVisibleQuestions(questions, answers).filter(
    (q) => q !== current,
  );
  const { skipped } = summarizeAnswers(questions, answers);

  // When the last question is done, move focus to the "All questions answered" message.
  useEffect(() => {
    if (interacted && !current) doneRef.current?.focus();
  }, [interacted, current]);

  async function requestDraft(nextAnswers: CoverLetterAnswers) {
    const requestId = ++latestRequest.current;
    setStatus("updating");
    const result = await getMockCoverLetterDraft(nextAnswers);
    // A newer answer started another request: this result is out of date, drop it.
    if (requestId !== latestRequest.current) return;
    if (!result.ok) {
      setStatus("error");
      return;
    }
    // The user's own edits are never overwritten silently.
    if (draftEditedRef.current) setProposed(result.value);
    else setDraft(result.value);
    setStatus("updated");
  }

  function submitAnswer(
    question: CoverLetterQuestion,
    value: CoverLetterAnswer,
  ) {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    // Tell screen reader users that a new (optional) question was revealed.
    setAnnouncement(
      getCurrentQuestion(questions, next)?.kind === "followUp"
        ? "One optional follow-up question added."
        : "",
    );
    setInteracted(true);
    void requestDraft(next);
  }

  function replaceDraft() {
    if (proposed === null) return;
    setDraft(proposed);
    setProposed(null);
    draftEditedRef.current = false;
    setDraftEdited(false);
    // The Replace button disappears now, so keep the keyboard focus in the draft.
    draftRef.current?.focus();
  }

  const statusText =
    status === "updating"
      ? "Updating the draft..."
      : status === "updated"
        ? proposed !== null
          ? "An updated draft is ready. Your edits were kept."
          : "Draft updated."
        : "";

  return (
    <section aria-labelledby="letter-heading">
      <h2
        id="letter-heading"
        className="font-heading text-3xl font-semibold tracking-tight"
      >
        Cover letter
      </h2>
      <p className="mt-2 max-w-[60ch] text-lg">
        A few questions about what the CV does not show. The draft changes as
        you answer.
      </p>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="font-heading text-xl font-semibold">Questions</h3>
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>

          <ConversationList questions={handled} answers={answers} />

          {current ? (
            <QuestionForm
              key={current.id}
              question={current}
              focusOnMount={interacted}
              onAnswer={(text) =>
                submitAnswer(current, { type: "answered", text })
              }
              onNoExperience={() =>
                submitAnswer(current, { type: "noExperience" })
              }
              onSkip={() => submitAnswer(current, { type: "skipped" })}
            />
          ) : (
            <h4
              ref={doneRef}
              tabIndex={-1}
              className="mt-4 text-lg font-medium outline-offset-2"
            >
              {skipped === 0
                ? "All questions answered"
                : `All questions done. ${skipped} skipped; the letter leaves them out.`}
            </h4>
          )}
        </div>

        <div className="min-w-0">
          <label
            htmlFor="letter-draft"
            className="font-heading text-xl font-semibold"
          >
            Cover letter draft
          </label>
          <textarea
            id="letter-draft"
            ref={draftRef}
            value={draft}
            rows={16}
            onChange={(e) => {
              setDraft(e.target.value);
              draftEditedRef.current = true;
              setDraftEdited(true);
            }}
            className="mt-2 block w-full rounded-sm border-2 border-edge bg-paper p-3"
          />

          <p aria-live="polite" className="mt-1 min-h-6 text-slate">
            {statusText}
          </p>

          {status === "error" && (
            <div role="alert" className="mt-2">
              <FieldError>The draft could not be updated.</FieldError>
              <button
                type="button"
                onClick={() => void requestDraft(answers)}
                className={`${BUTTON} mt-2`}
              >
                Try again
              </button>
            </div>
          )}

          {draftEdited && proposed !== null && (
            <div className="mt-2 border-l-4 border-cobalt bg-paper p-3">
              <p>
                You edited the draft, so it was not changed. Replace it to use
                the updated version (your edits will be lost).
              </p>
              <button
                type="button"
                onClick={replaceDraft}
                className={`${BUTTON} mt-2`}
              >
                Replace with updated draft
              </button>
            </div>
          )}

          <div className="mt-4">
            <DownloadButton id="download-letter" label="Download letter" />
          </div>
        </div>
      </div>
    </section>
  );
}
