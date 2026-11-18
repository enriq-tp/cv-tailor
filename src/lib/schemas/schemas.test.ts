// Tests for the CV and JobPosting zod schemas. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "../../../generated/prisma/client";
import { CvSchema, JobPostingSchema, type Cv, type JobPosting } from "./index";

const FULL_CV = {
  schemaVersion: 1,
  contact: {
    fullName: "Jane Fake",
    email: "not-checked-for-format",
    phone: "+00 000 000",
    location: "Faketown",
    links: [{ label: "Site", url: "https://example.com" }],
  },
  summary: "A fake summary.",
  experience: [
    {
      company: "Acme Test Corp",
      title: "Engineer",
      location: "Remote",
      startDate: "2021-03",
      endDate: "Present",
      isCurrent: true,
      achievements: ["Built a fake thing", "Fixed another fake thing"],
    },
  ],
  education: [
    {
      institution: "Fake University",
      degree: "BSc",
      field: "Computing",
      startDate: "2015",
      endDate: "2019",
    },
  ],
  skills: ["TypeScript", "SQL"],
  languages: [{ name: "English", proficiency: "C1" }],
  projects: [
    {
      name: "Fake project",
      description: "Does fake things",
      url: "https://example.com/p",
      technologies: ["Node.js"],
    },
  ],
};

const FULL_JOB = {
  schemaVersion: 1,
  title: "Fake Engineer",
  company: "Acme Test Corp",
  location: "Remote",
  seniority: "senior",
  requirements: { required: ["5 years of Fake"], niceToHave: ["Docker"] },
  responsibilities: ["Build fake things"],
  keywords: ["fake", "typescript"],
};

// ---- CV ------------------------------------------------------------------------------

test("a full valid CV is accepted unchanged", () => {
  const result = CvSchema.safeParse(FULL_CV);
  assert.ok(result.success);
  assert.deepEqual(result.data, FULL_CV);
});

test("an empty object is accepted and defaults are applied", () => {
  const result = CvSchema.safeParse({});
  assert.ok(result.success);
  assert.equal(result.data.schemaVersion, 1);
  assert.deepEqual(result.data.contact, { links: [] });
  assert.deepEqual(result.data.experience, []);
  assert.deepEqual(result.data.education, []);
  assert.deepEqual(result.data.skills, []);
  assert.deepEqual(result.data.languages, []);
  assert.deepEqual(result.data.projects, []);
  assert.equal(result.data.summary, undefined);
});

test("null is accepted for optional text fields", () => {
  const result = CvSchema.safeParse({
    summary: null,
    contact: { phone: null },
  });
  assert.ok(result.success);
});

test("experience that is not an array is rejected", () => {
  assert.equal(CvSchema.safeParse({ experience: "ten years" }).success, false);
  assert.equal(CvSchema.safeParse({ experience: {} }).success, false);
});

test("too many items are rejected", () => {
  const tooMany = Array.from({ length: 101 }, () => "skill");
  assert.equal(CvSchema.safeParse({ skills: tooMany }).success, false);
  assert.equal(
    CvSchema.safeParse({ skills: tooMany.slice(0, 100) }).success,
    true,
  );
});

test("a string over its limit is rejected", () => {
  assert.equal(
    CvSchema.safeParse({ summary: "a".repeat(2001) }).success,
    false,
  );
  assert.equal(CvSchema.safeParse({ summary: "a".repeat(2000) }).success, true);
  assert.equal(
    CvSchema.safeParse({
      experience: [{ achievements: ["a".repeat(601)] }],
    }).success,
    false,
  );
});

test("wrong types and wrong schemaVersion are rejected", () => {
  assert.equal(
    CvSchema.safeParse({ experience: [{ isCurrent: "yes" }] }).success,
    false,
  );
  assert.equal(CvSchema.safeParse({ schemaVersion: 2 }).success, false);
  assert.equal(CvSchema.safeParse("not an object").success, false);
});

test("unknown keys are stripped, at every level, instead of failing", () => {
  const result = CvSchema.safeParse({
    invented: "x",
    contact: { fullName: "Jane Fake", favouriteColour: "blue" },
    experience: [{ company: "Acme", salary: 1 }],
  });
  assert.ok(result.success);
  assert.ok(!("invented" in result.data));
  assert.ok(!("favouriteColour" in result.data.contact));
  assert.ok(!("salary" in result.data.experience[0]));
  assert.equal(result.data.contact.fullName, "Jane Fake");
});

// ---- JobPosting --------------------------------------------------------------------

test("a full valid job posting is accepted unchanged", () => {
  const result = JobPostingSchema.safeParse(FULL_JOB);
  assert.ok(result.success);
  assert.deepEqual(result.data, FULL_JOB);
});

test("an empty job posting object gets its defaults", () => {
  const result = JobPostingSchema.safeParse({});
  assert.ok(result.success);
  assert.equal(result.data.schemaVersion, 1);
  assert.deepEqual(result.data.requirements, { required: [], niceToHave: [] });
  assert.deepEqual(result.data.responsibilities, []);
  assert.deepEqual(result.data.keywords, []);
});

test("an invalid seniority is rejected, every valid one is accepted", () => {
  assert.equal(
    JobPostingSchema.safeParse({ seniority: "wizard" }).success,
    false,
  );
  for (const level of [
    "intern",
    "junior",
    "mid",
    "senior",
    "lead",
    "principal",
    "executive",
  ]) {
    assert.ok(JobPostingSchema.safeParse({ seniority: level }).success, level);
  }
  assert.ok(JobPostingSchema.safeParse({ seniority: null }).success);
});

test("job posting: wrong shapes, too many items and unknown keys", () => {
  assert.equal(JobPostingSchema.safeParse({ keywords: "a, b" }).success, false);
  assert.equal(
    JobPostingSchema.safeParse({
      requirements: { required: Array.from({ length: 51 }, () => "r") },
    }).success,
    false,
  );
  assert.equal(
    JobPostingSchema.safeParse({ title: "t".repeat(201) }).success,
    false,
  );

  const stripped = JobPostingSchema.safeParse({
    title: "Fake",
    salary: "lots",
    requirements: { required: ["x"], mustHave: ["y"] },
  });
  assert.ok(stripped.success);
  assert.ok(!("salary" in stripped.data));
  assert.ok(!("mustHave" in stripped.data.requirements));
});

// ---- Prisma Json compatibility --------------------------------------------------------

// COMPILE-TIME check: if a parsed value is not assignable to Prisma's Json input type,
// `npm run build` (type check) fails on these lines. Cv.data and Application.tailoredCv
// take a Cv; JobPost.analysis takes a JobPosting.
function acceptsPrismaJson(value: Prisma.InputJsonValue): void {
  void value;
}
function checkTypes(cv: Cv, job: JobPosting): void {
  acceptsPrismaJson(cv);
  acceptsPrismaJson(job);
}
void checkTypes;

test("parsed values survive a JSON round trip unchanged (what a Json column does)", () => {
  const cv = CvSchema.parse(FULL_CV);
  const job = JobPostingSchema.parse(FULL_JOB);
  const sparse = CvSchema.parse({ summary: null }); // nulls and defaults

  assert.deepEqual(JSON.parse(JSON.stringify(cv)), cv);
  assert.deepEqual(JSON.parse(JSON.stringify(job)), job);
  assert.deepEqual(JSON.parse(JSON.stringify(sparse)), sparse);
});

test("the round trip also holds for values with optional fields left undefined", () => {
  // JSON.stringify drops keys whose value is undefined; the parsed object must not
  // contain such keys, otherwise the stored JSON would differ from the parsed value.
  const parsed = CvSchema.parse({});
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), parsed);
});
