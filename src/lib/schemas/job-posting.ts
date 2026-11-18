// Structured job posting: the RESULT of analysing the pasted job text with the LLM
// (Phase 2). It is NOT an input format: the user pastes plain text (validated by
// text/validate-job-text.ts) and the analysis produces this JSON, stored in JobPost.analysis.
// Same design rules as cv.ts (lenient, capped, unknown keys stripped). See docs/wiki/schemas.md.

import * as z from "zod";

const NAME_MAX = 200;
const ITEM_MAX = 600; // one requirement or responsibility
const KEYWORD_MAX = 100;

const text = (max: number) => z.string().max(max).nullish();

export const SENIORITY_LEVELS = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
  "executive",
] as const;

export const JobRequirementsSchema = z.object({
  required: z.array(z.string().max(ITEM_MAX)).max(50).default([]),
  niceToHave: z.array(z.string().max(ITEM_MAX)).max(50).default([]),
});

export const JobPostingSchema = z.object({
  schemaVersion: z.literal(1).default(1), // see cv.ts
  title: text(NAME_MAX),
  company: text(NAME_MAX),
  location: text(NAME_MAX),
  seniority: z.enum(SENIORITY_LEVELS).nullish(),
  // prefault({}) = "if missing, parse {}": both arrays are then always present.
  requirements: JobRequirementsSchema.prefault({}),
  responsibilities: z.array(z.string().max(ITEM_MAX)).max(50).default([]),
  keywords: z.array(z.string().max(KEYWORD_MAX)).max(50).default([]),
});

export type JobPosting = z.infer<typeof JobPostingSchema>;
export type JobPostingInput = z.input<typeof JobPostingSchema>;
export type JobSeniority = (typeof SENIORITY_LEVELS)[number];
