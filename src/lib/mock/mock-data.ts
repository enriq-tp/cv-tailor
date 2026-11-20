// Synthetic data for the mock result (Phase 1). EVERYTHING here is invented: the person, the
// companies, the job. It is never derived from what the user uploaded or pasted.

import { applyChanges } from "@/lib/result/apply-changes";
import {
  getEffectiveAnswer,
  isQuestionEligible,
} from "@/lib/result/question-flow";
import type {
  CoverLetterAnswers,
  CoverLetterQuestion,
  Decisions,
  MatchItem,
  MockResult,
  SuggestedChange,
} from "@/lib/result/types";
import type { Cv, JobPosting } from "@/lib/schemas";

export const job: JobPosting = {
  schemaVersion: 1,
  title: "Senior Backend Engineer (sample)",
  company: "Demo Logistics (sample)",
  location: "Remote (sample)",
  seniority: "senior",
  requirements: {
    required: [
      "5+ years of backend development with Node.js",
      "Experience designing and documenting REST APIs",
      "Solid knowledge of PostgreSQL, including query tuning",
      "Production experience running services on Kubernetes",
      "Experience with event streaming (for example Kafka)",
    ],
    niceToHave: [
      "Familiarity with Terraform or other infrastructure as code",
      "Experience mentoring junior engineers",
    ],
  },
  responsibilities: [
    "Build and maintain the sample shipment tracking API",
    "Review code and improve test coverage",
    "Work with the operations team on delivery-time estimates",
  ],
  keywords: [
    "Node.js",
    "REST",
    "PostgreSQL",
    "Kubernetes",
    "Kafka",
    "Terraform",
  ],
};

// One item per requirement, in the same order as the job. Ids are stable.
export const matchItems: MatchItem[] = [
  {
    id: "req-1",
    requirement: "5+ years of backend development with Node.js",
    kind: "required",
    status: "covered",
    justification: "Sample CV shows 6 years of Node.js work across two roles.",
  },
  {
    id: "req-2",
    requirement: "Experience designing and documenting REST APIs",
    kind: "required",
    status: "covered",
    justification: "Sample CV describes designing a public REST API.",
  },
  {
    id: "req-3",
    requirement: "Solid knowledge of PostgreSQL, including query tuning",
    kind: "required",
    status: "partial",
    justification:
      "PostgreSQL is listed and used, but query tuning is not described.",
  },
  {
    id: "req-4",
    requirement: "Production experience running services on Kubernetes",
    kind: "required",
    status: "missing",
    justification: "Sample CV mentions Docker only, nothing about Kubernetes.",
  },
  {
    id: "req-5",
    requirement: "Experience with event streaming (for example Kafka)",
    kind: "required",
    status: "missing",
    justification: "No streaming or message queue experience in the sample CV.",
  },
  {
    id: "req-6",
    requirement: "Familiarity with Terraform or other infrastructure as code",
    kind: "niceToHave",
    status: "missing",
    justification: "No infrastructure as code in the sample CV.",
  },
  {
    id: "req-7",
    requirement: "Experience mentoring junior engineers",
    kind: "niceToHave",
    status: "covered",
    justification: "Sample CV mentions mentoring two junior developers.",
  },
];

export const originalCv: Cv = {
  schemaVersion: 1,
  contact: {
    fullName: "Sam Placeholder",
    email: "sam.placeholder@example.com",
    phone: "+1 555 0100",
    location: "Sampletown (sample)",
    links: [],
  },
  summary:
    "Backend developer with six years of experience building web services. Enjoys clean APIs and reliable databases.",
  experience: [
    {
      company: "Sample Systems Ltd (sample)",
      title: "Backend Engineer",
      location: "Sampletown",
      startDate: "2021-03",
      endDate: "Present",
      isCurrent: true,
      achievements: [
        "Built a REST API used by three internal teams.",
        "Moved the order database to PostgreSQL with no downtime.",
        "Mentored two junior developers.",
      ],
    },
    {
      company: "Example Apps Inc (sample)",
      title: "Software Developer",
      location: "Sampletown",
      startDate: "2018-06",
      endDate: "2021-02",
      isCurrent: false,
      achievements: [
        "Wrote Node.js services for a booking platform.",
        "Added automated tests that caught regressions before release.",
      ],
    },
  ],
  education: [
    {
      institution: "Sample University (sample)",
      degree: "BSc",
      field: "Computer Science",
      startDate: "2014",
      endDate: "2018",
    },
  ],
  skills: ["Node.js", "TypeScript", "PostgreSQL", "REST APIs", "Docker", "Git"],
  languages: [{ name: "English", proficiency: "Native (sample)" }],
  projects: [],
};

// `before` is exactly the current text of the slot in originalCv. Every `after` only
// rephrases what the CV already says: it never adds experience the person does not have.
export const changes: SuggestedChange[] = [
  {
    id: "chg-1",
    section: "Summary",
    label: "Summary: lead with Node.js and APIs",
    target: { kind: "summary" },
    before: originalCv.summary ?? "",
    after:
      "Backend engineer with six years of Node.js experience designing REST APIs and PostgreSQL-backed services.",
  },
  {
    id: "chg-2",
    section: "Experience",
    label: "Sample Systems: REST API bullet",
    target: { kind: "achievement", experienceIndex: 0, achievementIndex: 0 },
    before: "Built a REST API used by three internal teams.",
    after: "Designed and documented a REST API used by three internal teams.",
  },
  {
    id: "chg-3",
    section: "Experience",
    label: "Sample Systems: database bullet",
    target: { kind: "achievement", experienceIndex: 0, achievementIndex: 1 },
    before: "Moved the order database to PostgreSQL with no downtime.",
    after: "Migrated the order database to PostgreSQL with zero downtime.",
  },
  {
    id: "chg-4",
    section: "Experience",
    label: "Example Apps: Node.js bullet",
    target: { kind: "achievement", experienceIndex: 1, achievementIndex: 0 },
    before: "Wrote Node.js services for a booking platform.",
    after:
      "Built and maintained Node.js backend services for a booking platform.",
  },
  {
    id: "chg-5",
    section: "Skills",
    label: "Skills: name the API skill as the posting does",
    target: { kind: "skill", skillIndex: 3 },
    before: "REST APIs",
    after: "REST API design",
  },
];

// The questions, in the order they are asked: gap, its follow-up, gap, its follow-up, then
// two general ones. Ids and wording are stable (tests rely on them).
// Gap questions come only from missing REQUIRED requirements (here req-4 and req-5).
// Terraform (req-6, niceToHave) stays in the match list as missing but gets no question.
// Phase 2: the gap questions should be the two most important missing required
// requirements; the others stay in the match analysis and are left out of the letter.
const FOLLOW_UP_TEXT =
  "What's the closest thing you've done, or something similar you picked up quickly? One concrete example is enough.";

export const questions: CoverLetterQuestion[] = [
  {
    id: "q-1",
    kind: "gap",
    requirementId: "req-4",
    topic: "running services on Kubernetes",
    question: "Have you run services on Kubernetes? If yes, where and how?",
  },
  {
    id: "q-1-follow",
    kind: "followUp",
    parentId: "q-1",
    topic: "running services on Kubernetes",
    question: FOLLOW_UP_TEXT,
  },
  {
    id: "q-2",
    kind: "gap",
    requirementId: "req-5",
    topic: "event streaming with Kafka",
    question:
      "Have you worked with Kafka or another event streaming tool? If yes, where and how?",
  },
  {
    id: "q-2-follow",
    kind: "followUp",
    parentId: "q-2",
    topic: "event streaming with Kafka",
    question: FOLLOW_UP_TEXT,
  },
  {
    id: "q-general-1",
    kind: "general",
    topic: "my reasons for this role and company",
    question: "Why this role and this company?",
  },
  {
    id: "q-general-2",
    kind: "general",
    topic: "something I learned quickly recently",
    question:
      "What's something you learned quickly recently, and how did you do it?",
  },
];

// Builds the sample cover letter from a template. The fixed paragraphs only claim what the
// CV supports (the "covered" requirements). The questions add paragraphs only from what the
// user wrote:
// - no answer or skipped: nothing (no claim, no placeholder);
// - answered (not blank): "On <topic>: <user text>";
// - noExperience: nothing by itself (we never volunteer a weakness). Only an answered
//   follow-up adds "On <topic>: I have not done this yet. The closest I have done: <text>";
// - a follow-up whose parent is not noExperience is ignored, even if an answer exists.
// The lead-ins assert nothing on their own and there are no generic claims ("fast learner",
// "passionate", ...). The LLM must never invent experience.
// MOCK rule: the user's text is copied VERBATIM. In Phase 2 the letter may be rephrased for
// fluency but must never add facts or make a stronger claim than the user made.
export function buildCoverLetter(answers: CoverLetterAnswers): string {
  const paragraphs = [
    "Dear Demo Logistics hiring team (sample letter),",
    "I am applying for the Senior Backend Engineer (sample) role. I have six years of Node.js experience and have designed a REST API used by three internal teams.",
    "I also moved an order database to PostgreSQL with zero downtime, and I have mentored two junior developers.",
  ];

  for (const q of questions) {
    if (!isQuestionEligible(q, questions, answers)) continue;
    const answer = getEffectiveAnswer(q, answers);
    if (answer?.type !== "answered") continue;
    const text = answer.text.trim();
    if (!text) continue;
    paragraphs.push(
      q.kind === "followUp"
        ? `On ${q.topic}: I have not done this yet. The closest I have done: ${text}`
        : `On ${q.topic}: ${text}`,
    );
  }

  paragraphs.push("Thank you for your time.", "Sam Placeholder");
  return paragraphs.join("\n\n");
}

// All changes accepted, none edited: the tailored CV is derived from the original, so the
// two can never drift apart.
const acceptAll: Decisions = Object.fromEntries(
  changes.map((c) => [c.id, { status: "accepted" as const }]),
);

export const mockResult: MockResult = {
  job,
  match: { items: matchItems },
  originalCv,
  tailoredCv: applyChanges(originalCv, changes, acceptAll),
  changes,
  questions,
  initialDraft: buildCoverLetter({}),
};
