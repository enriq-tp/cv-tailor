// Structured CV: the JSON that the LLM extracts from the CV text (Phase 2), that the user
// reviews, and that is stored in Cv.data / Application.tailoredCv (Json columns).
// Field-by-field description: docs/wiki/schemas.md
//
// Design rules:
// - Almost everything is optional (.nullish() = missing, null or a value): extracted data is
//   messy and a CV without a phone number must not be rejected.
// - Arrays default to [] so code can always loop over them.
// - Every string and array has a maximum size, so a bad or hostile LLM answer cannot store
//   megabytes in the database or blow up the PDF template.
// - Dates are plain strings ("2021-03", "2021", "Present"): a JSON column cannot hold a Date,
//   and CVs use many formats.
// - Unknown keys are STRIPPED (default z.object behaviour), not rejected: one stray key
//   invented by the LLM must not invalidate the whole document.
// - No email format check: extracted data is messy. Validate when a form needs it.

import * as z from "zod";

// Maximum lengths (characters) and item counts.
const NAME_MAX = 200; // person, company, school, job title, location, skill group...
const URL_MAX = 500;
const DATE_MAX = 40;
const SUMMARY_MAX = 2000;
const ACHIEVEMENT_MAX = 600;
const DESCRIPTION_MAX = 1000;
const SHORT_MAX = 100; // a single skill, a language level, a link label, a technology

const text = (max: number) => z.string().max(max).nullish();

export const CvLinkSchema = z.object({
  label: text(SHORT_MAX),
  url: text(URL_MAX),
});

export const CvContactSchema = z.object({
  fullName: text(NAME_MAX),
  email: text(NAME_MAX),
  phone: text(SHORT_MAX),
  location: text(NAME_MAX),
  links: z.array(CvLinkSchema).max(10).default([]),
});

export const CvExperienceSchema = z.object({
  company: text(NAME_MAX),
  title: text(NAME_MAX),
  location: text(NAME_MAX),
  startDate: text(DATE_MAX),
  endDate: text(DATE_MAX),
  isCurrent: z.boolean().nullish(),
  achievements: z.array(z.string().max(ACHIEVEMENT_MAX)).max(20).default([]),
});

export const CvEducationSchema = z.object({
  institution: text(NAME_MAX),
  degree: text(NAME_MAX),
  field: text(NAME_MAX),
  startDate: text(DATE_MAX),
  endDate: text(DATE_MAX),
});

export const CvLanguageSchema = z.object({
  name: text(SHORT_MAX),
  proficiency: text(SHORT_MAX),
});

export const CvProjectSchema = z.object({
  name: text(NAME_MAX),
  description: text(DESCRIPTION_MAX),
  url: text(URL_MAX),
  technologies: z.array(z.string().max(SHORT_MAX)).max(30).default([]),
});

export const CvSchema = z.object({
  // Json columns have no migrations: old rows keep their old shape. This number lets the
  // code tell them apart when the schema changes.
  schemaVersion: z.literal(1).default(1),
  // prefault({}) = "if missing, parse {}": so contact.links is always an array.
  contact: CvContactSchema.prefault({}),
  summary: text(SUMMARY_MAX),
  experience: z.array(CvExperienceSchema).max(30).default([]),
  education: z.array(CvEducationSchema).max(20).default([]),
  skills: z.array(z.string().max(SHORT_MAX)).max(100).default([]),
  languages: z.array(CvLanguageSchema).max(20).default([]),
  projects: z.array(CvProjectSchema).max(20).default([]),
});

// Output type (after parsing): defaults applied, so the arrays are required.
export type Cv = z.infer<typeof CvSchema>;
// Input type (before parsing): what the LLM or a form may send; arrays are optional.
export type CvInput = z.input<typeof CvSchema>;
export type CvExperience = z.infer<typeof CvExperienceSchema>;
export type CvEducation = z.infer<typeof CvEducationSchema>;
export type CvProject = z.infer<typeof CvProjectSchema>;
