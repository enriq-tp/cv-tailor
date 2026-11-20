// Types for the result screen (match, suggested changes, cover letter questions).
// Types only: no runtime code, so client components can import this file freely.
// The generic `Result<T, E>` type lives in "@/lib/result" (the file result.ts next to
// this folder); this folder is imported as "@/lib/result/types".

import type { Cv, JobPosting } from "@/lib/schemas";

export type RequirementStatus = "covered" | "partial" | "missing";

// One requirement of the job posting and how well the CV covers it.
export type MatchItem = {
  id: string;
  requirement: string;
  kind: "required" | "niceToHave";
  status: RequirementStatus;
  justification: string;
};

// Where a suggested change applies inside the CV (indexes into the CV arrays).
export type ChangeTarget =
  | { kind: "summary" }
  | { kind: "achievement"; experienceIndex: number; achievementIndex: number }
  | { kind: "skill"; skillIndex: number };

export type SuggestedChange = {
  id: string;
  section: "Summary" | "Experience" | "Skills";
  label: string;
  target: ChangeTarget;
  before: string;
  after: string;
};

export type ChangeStatus = "pending" | "accepted" | "rejected";
// editedText: the user's own wording; it replaces `after` when the change is accepted.
export type ChangeDecision = { status: ChangeStatus; editedText?: string };
// Change id -> decision. A change without an entry is pending.
export type Decisions = Record<string, ChangeDecision>;

// "gap": about a missing REQUIRED requirement. "followUp": asked only when the user says they
// have no experience with its gap question. "general": not tied to a requirement.
export type QuestionKind = "gap" | "followUp" | "general";

// In Phase 2 the questions come from an LLM and `topic` derives from the job posting, which
// is UNTRUSTED text. So `topic` must be length-capped (COVER_LETTER_TOPIC_MAX_CHARS), shown
// as plain text only, and never inserted as HTML or into instructions for a model.
export type CoverLetterQuestion = {
  id: string;
  kind: QuestionKind;
  question: string;
  topic: string; // ALWAYS a short noun phrase, e.g. "running services on Kubernetes"
  requirementId?: string; // gap only: the missing REQUIRED requirement it comes from
  parentId?: string; // followUp only: the id of its gap question
};

export type CoverLetterAnswer =
  | { type: "answered"; text: string }
  | { type: "noExperience" } // only valid for "gap" questions
  | { type: "skipped" };
// Question id -> answer. A question without an entry is not answered yet.
export type CoverLetterAnswers = Record<string, CoverLetterAnswer>;

export type MockResult = {
  job: JobPosting;
  match: { items: MatchItem[] };
  originalCv: Cv;
  tailoredCv: Cv;
  changes: SuggestedChange[];
  questions: CoverLetterQuestion[];
  initialDraft: string;
};

// Safe error category: never a message (messages can contain user data).
export type ResultError = { category: "unavailable" };
