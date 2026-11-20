import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyChanges } from "@/lib/result/apply-changes";
import type { Decisions, SuggestedChange } from "@/lib/result/types";
import type { Cv } from "@/lib/schemas";

const cv: Cv = {
  schemaVersion: 1,
  contact: { links: [] },
  summary: "Old summary",
  experience: [{ achievements: ["Old bullet 0", "Old bullet 1"] }],
  education: [],
  skills: ["Old skill"],
  languages: [],
  projects: [],
};

const changes: SuggestedChange[] = [
  {
    id: "s",
    section: "Summary",
    label: "s",
    target: { kind: "summary" },
    before: "Old summary",
    after: "New summary",
  },
  {
    id: "a",
    section: "Experience",
    label: "a",
    target: { kind: "achievement", experienceIndex: 0, achievementIndex: 1 },
    before: "Old bullet 1",
    after: "New bullet 1",
  },
  {
    id: "k",
    section: "Skills",
    label: "k",
    target: { kind: "skill", skillIndex: 0 },
    before: "Old skill",
    after: "New skill",
  },
];

describe("applyChanges", () => {
  it("keeps the original text for pending and rejected changes", () => {
    const decisions: Decisions = {
      s: { status: "pending" },
      a: { status: "rejected" },
    };
    assert.deepEqual(applyChanges(cv, changes, decisions), cv);
  });

  it("uses `after` for accepted changes", () => {
    const decisions: Decisions = {
      s: { status: "accepted" },
      a: { status: "accepted" },
      k: { status: "accepted" },
    };
    const result = applyChanges(cv, changes, decisions);
    assert.equal(result.summary, "New summary");
    assert.deepEqual(result.experience[0].achievements, [
      "Old bullet 0",
      "New bullet 1",
    ]);
    assert.deepEqual(result.skills, ["New skill"]);
  });

  it("uses editedText when the user edited an accepted change", () => {
    const result = applyChanges(cv, changes, {
      s: { status: "accepted", editedText: "Mine" },
    });
    assert.equal(result.summary, "Mine");
  });

  it("does not mutate its inputs", () => {
    const before = structuredClone(cv);
    const result = applyChanges(cv, changes, { s: { status: "accepted" } });
    assert.deepEqual(cv, before);
    assert.notEqual(result, cv);
  });

  it("ignores an unknown change id", () => {
    assert.deepEqual(
      applyChanges(cv, changes, { nope: { status: "accepted" } }),
      cv,
    );
  });

  it("leaves the CV unchanged when a target index is out of range", () => {
    const bad: SuggestedChange[] = [
      {
        ...changes[1],
        id: "x",
        target: {
          kind: "achievement",
          experienceIndex: 5,
          achievementIndex: 0,
        },
      },
      {
        ...changes[1],
        id: "y",
        target: {
          kind: "achievement",
          experienceIndex: 0,
          achievementIndex: 9,
        },
      },
      { ...changes[2], id: "z", target: { kind: "skill", skillIndex: 9 } },
    ];
    const decisions: Decisions = {
      x: { status: "accepted" },
      y: { status: "accepted" },
      z: { status: "accepted" },
    };
    assert.deepEqual(applyChanges(cv, bad, decisions), cv);
  });
});
