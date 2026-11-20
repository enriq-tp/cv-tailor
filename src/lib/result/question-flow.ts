// Which cover letter question comes next. Pure functions, no React, no I/O.
// Why code and not the model: the rule "a follow-up is asked only after the user said they
// have no experience" must always hold, so it is plain, testable logic.
// Privacy: answers may be personal data. Nothing here logs or stores them.

import { COVER_LETTER_TOPIC_MAX_CHARS } from "@/lib/limits";
import type {
  CoverLetterAnswer,
  CoverLetterAnswers,
  CoverLetterQuestion,
} from "@/lib/result/types";

// The most questions a user can ever be asked (the worst case of the mock list is exactly 6).
export const MAX_COVER_LETTER_QUESTIONS = 6;

// The answer that counts for a question. "noExperience" is only valid for "gap" questions:
// on any other kind it is ignored (treated as not answered), so it can never reveal a
// follow-up or change the draft.
export function getEffectiveAnswer(
  question: CoverLetterQuestion,
  answers: CoverLetterAnswers,
): CoverLetterAnswer | undefined {
  const answer = answers[question.id];
  if (answer?.type === "noExperience" && question.kind !== "gap") {
    return undefined;
  }
  return answer;
}

// A follow-up is eligible only when its parent is a gap question answered "noExperience".
// Every other kind is always eligible.
export function isQuestionEligible(
  question: CoverLetterQuestion,
  questions: CoverLetterQuestion[],
  answers: CoverLetterAnswers,
): boolean {
  if (question.kind !== "followUp") return true;
  const parent = questions.find((q) => q.id === question.parentId);
  if (!parent || parent.kind !== "gap") return false;
  return getEffectiveAnswer(parent, answers)?.type === "noExperience";
}

// The first question, in list order, that is eligible and has no answer yet.
export function getCurrentQuestion(
  questions: CoverLetterQuestion[],
  answers: CoverLetterAnswers,
): CoverLetterQuestion | undefined {
  return questions.find(
    (q) =>
      isQuestionEligible(q, questions, answers) &&
      getEffectiveAnswer(q, answers) === undefined,
  );
}

// The questions that are or were visible: answered ones plus the current one, in order.
// The UI uses this for the conversation list.
export function getVisibleQuestions(
  questions: CoverLetterQuestion[],
  answers: CoverLetterAnswers,
): CoverLetterQuestion[] {
  const current = getCurrentQuestion(questions, answers);
  return questions.filter(
    (q) =>
      q === current ||
      (isQuestionEligible(q, questions, answers) &&
        getEffectiveAnswer(q, answers) !== undefined),
  );
}

// Counts over VISIBLE questions only. "noExperience" counts as answered (it is a real
// outcome); a skipped follow-up counts as skipped. The current, unanswered question is
// only part of `total`.
export function summarizeAnswers(
  questions: CoverLetterQuestion[],
  answers: CoverLetterAnswers,
): { answered: number; noExperience: number; skipped: number; total: number } {
  const visible = getVisibleQuestions(questions, answers);
  const summary = {
    answered: 0,
    noExperience: 0,
    skipped: 0,
    total: visible.length,
  };
  for (const q of visible) {
    const type = getEffectiveAnswer(q, answers)?.type;
    if (type === "answered") summary.answered += 1;
    if (type === "noExperience") {
      summary.answered += 1;
      summary.noExperience += 1;
    }
    if (type === "skipped") summary.skipped += 1;
  }
  return summary;
}

// A topic must be a short plain-text phrase. Phase 2 uses this to reject or clamp LLM output.
// Rejects: empty, too long (counted in code points), control characters, "<" and ">".
export function isValidTopic(topic: string): boolean {
  if (topic.trim().length === 0) return false;
  if ([...topic].length > COVER_LETTER_TOPIC_MAX_CHARS) return false;
  if (/\p{Cc}/u.test(topic)) return false;
  return !/[<>]/.test(topic);
}
