import { getEffectiveAnswer } from "@/lib/result/question-flow";
import type { CoverLetterAnswers, CoverLetterQuestion } from "@/lib/mock";
import { displayTopic } from "./topic-text";

// Read-only list of the questions already dealt with, in order. Follow-ups are indented and
// carry the words "Follow-up on <topic>", so the nesting never depends on colour or position.
// The topic is rendered as plain text (never as HTML): in Phase 2 it comes from untrusted text.
export function ConversationList({
  questions,
  answers,
}: {
  questions: CoverLetterQuestion[]; // already the answered ones only
  answers: CoverLetterAnswers;
}) {
  if (questions.length === 0) return null;

  return (
    <ul className="mt-3 divide-y divide-fold border-y-2 border-edge bg-paper">
      {questions.map((q) => {
        const answer = getEffectiveAnswer(q, answers);
        const outcome =
          answer?.type === "answered"
            ? answer.text
            : answer?.type === "noExperience"
              ? "I don't have this experience"
              : "Skipped";
        const isFollowUp = q.kind === "followUp";
        return (
          <li
            key={q.id}
            className={
              isFollowUp ? "ml-4 border-l-4 border-edge px-4 py-3" : "px-4 py-3"
            }
          >
            {isFollowUp && (
              <p className="text-slate wrap-break-word">
                Follow-up on {displayTopic(q.topic)}
              </p>
            )}
            <p className="font-medium wrap-break-word">{q.question}</p>
            <p className="mt-1 wrap-break-word whitespace-pre-wrap text-slate">
              {outcome}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
