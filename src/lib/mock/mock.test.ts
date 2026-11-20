import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { COVER_LETTER_TOPIC_MAX_CHARS } from "@/lib/limits";
import { getMockCoverLetterDraft, getMockResult } from "@/lib/mock";
import { buildCoverLetter, questions } from "@/lib/mock/mock-data";
import { applyChanges } from "@/lib/result/apply-changes";
import { isValidTopic } from "@/lib/result/question-flow";
import type {
  ChangeTarget,
  CoverLetterAnswer,
  CoverLetterAnswers,
  MockResult,
} from "@/lib/mock";
import { CvSchema, JobPostingSchema, type Cv } from "@/lib/schemas";

async function loadResult(): Promise<MockResult> {
  const result = await getMockResult(undefined, { delayMs: 0 });
  assert.ok(result.ok);
  return result.value;
}

// The text currently stored in the CV slot a change points to.
function textAt(cv: Cv, target: ChangeTarget): string | undefined {
  if (target.kind === "summary") return cv.summary ?? undefined;
  if (target.kind === "achievement")
    return cv.experience[target.experienceIndex]?.achievements[
      target.achievementIndex
    ];
  return cv.skills[target.skillIndex];
}

describe("getMockResult", () => {
  it("returns data that passes the schemas", async () => {
    const r = await loadResult();
    JobPostingSchema.parse(r.job);
    CvSchema.parse(r.originalCv);
    CvSchema.parse(r.tailoredCv);
  });

  it("tailoredCv equals the original with all changes accepted", async () => {
    const r = await loadResult();
    const decisions = Object.fromEntries(
      r.changes.map((c) => [c.id, { status: "accepted" as const }]),
    );
    assert.deepEqual(
      applyChanges(r.originalCv, r.changes, decisions),
      r.tailoredCv,
    );
  });

  it("every change `before` equals the original text at its target", async () => {
    const r = await loadResult();
    for (const change of r.changes) {
      assert.equal(
        textAt(r.originalCv, change.target),
        change.before,
        change.id,
      );
    }
  });

  it("every gap question points to a missing REQUIRED requirement, at most 2", async () => {
    const r = await loadResult();
    const gaps = r.questions.filter((q) => q.kind === "gap");
    assert.ok(gaps.length <= 2);
    for (const q of gaps) {
      const item = r.match.items.find((m) => m.id === q.requirementId);
      assert.equal(item?.status, "missing", q.id);
      assert.equal(item?.kind, "required", q.id);
    }
  });

  it("follow-ups come right after their gap question; general ones have no links", async () => {
    const r = await loadResult();
    r.questions.forEach((q, i) => {
      if (q.kind === "followUp") {
        const parent = r.questions[i - 1];
        assert.equal(parent?.kind, "gap", q.id);
        assert.equal(q.parentId, parent?.id, q.id);
        assert.equal(q.requirementId, undefined, q.id);
      }
      if (q.kind === "general") {
        assert.equal(q.requirementId, undefined, q.id);
        assert.equal(q.parentId, undefined, q.id);
      }
      if (q.kind === "gap") assert.equal(q.parentId, undefined, q.id);
    });
  });

  it("every topic is a valid plain-text topic and no text contains < or >", async () => {
    const r = await loadResult();
    for (const q of r.questions) {
      assert.ok(isValidTopic(q.topic), q.id);
      assert.ok(q.topic.length <= COVER_LETTER_TOPIC_MAX_CHARS, q.id);
      assert.ok(!/[<>]/.test(q.topic + q.question), q.id);
    }
  });

  it("has one match item per requirement and unique ids", async () => {
    const r = await loadResult();
    const { required, niceToHave } = r.job.requirements;
    assert.equal(r.match.items.length, required.length + niceToHave.length);
    for (const list of [r.match.items, r.changes, r.questions]) {
      const ids = list.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  it("is obviously synthetic", async () => {
    const r = await loadResult();
    assert.ok(r.originalCv.contact.email?.endsWith("example.com"));
    assert.ok(r.originalCv.contact.fullName?.includes("Placeholder"));
    assert.ok(r.job.company?.includes("(sample)"));
  });

  it("returns the error result when fail is true", async () => {
    const result = await getMockResult(undefined, { delayMs: 0, fail: true });
    assert.deepEqual(result, { ok: false, error: { category: "unavailable" } });
  });

  it("returns a fresh copy each call", async () => {
    const a = await loadResult();
    a.originalCv.skills.push("changed");
    const b = await loadResult();
    assert.ok(!b.originalCv.skills.includes("changed"));
  });
});

describe("getMockCoverLetterDraft", () => {
  async function draft(answers: CoverLetterAnswers): Promise<string> {
    const result = await getMockCoverLetterDraft(answers, { delayMs: 0 });
    assert.ok(result.ok);
    return result.value;
  }

  const answered = (text: string): CoverLetterAnswer => ({
    type: "answered",
    text,
  });
  const noExperience: CoverLetterAnswer = { type: "noExperience" };
  const skipped: CoverLetterAnswer = { type: "skipped" };
  const FRAME_NOT_YET = "I have not done this yet. The closest I have done: ";

  it("an answered gap and an answered general question appear verbatim with the lead-in", async () => {
    const gap = await draft({ "q-1": answered("  I ran a sample cluster.  ") });
    assert.ok(
      gap.includes(
        "On running services on Kubernetes: I ran a sample cluster.",
      ),
    );
    const general = await draft({ "q-general-1": answered("Sample reason.") });
    assert.ok(
      general.includes(
        "On my reasons for this role and company: Sample reason.",
      ),
    );
  });

  it("changing an answer changes the draft", async () => {
    const a = await draft({ "q-1": answered("First sample text.") });
    const b = await draft({ "q-1": answered("Second sample text.") });
    assert.notEqual(a, b);
    assert.notEqual(a, await draft({}));
  });

  it("a skipped, unanswered or blank question adds nothing", async () => {
    const base = await draft({});
    for (const q of questions) {
      assert.equal(await draft({ [q.id]: skipped }), base, q.id);
      assert.equal(await draft({ [q.id]: answered("   ") }), base, q.id);
    }
  });

  it("noExperience alone adds nothing", async () => {
    const base = await draft({});
    assert.equal(await draft({ "q-1": noExperience }), base);
    assert.equal(
      await draft({ "q-1": noExperience, "q-1-follow": skipped }),
      base,
    );
  });

  it("a follow-up answer appears in the 'not yet' form, text verbatim", async () => {
    const text = "I built a sample deployment on a local cluster.";
    const result = await draft({
      "q-1": noExperience,
      "q-1-follow": answered(` ${text} `),
    });
    assert.ok(
      result.includes(
        `On running services on Kubernetes: ${FRAME_NOT_YET}${text}`,
      ),
    );
  });

  it("a follow-up answer is ignored when its parent is not noExperience", async () => {
    const base = await draft({});
    const followUp = answered("Sample follow-up text.");
    assert.equal(await draft({ "q-1-follow": followUp }), base);
    assert.equal(await draft({ "q-1": skipped, "q-1-follow": followUp }), base);
    const parentAnswered = await draft({
      "q-1": answered("Sample parent text."),
      "q-1-follow": followUp,
    });
    assert.ok(!parentAnswered.includes("Sample follow-up text."));
  });

  it("noExperience on a non-gap question adds nothing", async () => {
    const base = await draft({});
    assert.equal(await draft({ "q-general-1": noExperience }), base);
  });

  // Owner requirement: the lead-ins must be neutral. With the user's text replaced by a
  // marker, the only thing the draft adds is the exact frame, so nothing else is asserted.
  it("the added paragraph is exactly the frame, for every question kind", async () => {
    const marker = "MARKER_TOKEN_123";
    const base = (await draft({})).split("\n\n");
    for (const q of questions) {
      const answers: CoverLetterAnswers =
        q.kind === "followUp"
          ? { [q.parentId!]: noExperience, [q.id]: answered(marker) }
          : { [q.id]: answered(marker) };
      const added = (await draft(answers))
        .split("\n\n")
        .filter((p) => !base.includes(p));
      assert.equal(added.length, 1, q.id);
      const rest = added[0].replace(marker, "").replace(q.topic, "");
      const frame = q.kind === "followUp" ? FRAME_NOT_YET : "";
      assert.equal(rest, `On : ${frame}`, q.id);
    }
  });

  // Only a safety net, NOT a guarantee: in Phase 2 the real safeguard is that the user
  // reviews and edits the letter before downloading it. It calls the synchronous
  // buildCoverLetter directly: 4096 awaits of the async entry point cost ~60 s of timers
  // on Windows, and the async path is covered by the other tests in this block.
  it("no banned phrase appears for any combination of outcomes", () => {
    const banned = [
      "fast learner",
      "quick learner",
      "passionate",
      "expert",
      "extensive",
      "highly motivated",
      "track record",
      "eager",
      "dedicated",
      "proficient",
      "strong background",
    ];
    const options: (CoverLetterAnswer | undefined)[] = [
      undefined,
      answered("Neutral sample text."),
      noExperience,
      skipped,
    ];
    const total = options.length ** questions.length;
    for (let n = 0; n < total; n++) {
      const answers: CoverLetterAnswers = {};
      let rest = n;
      for (const q of questions) {
        const option = options[rest % options.length];
        rest = Math.floor(rest / options.length);
        if (option) answers[q.id] = option;
      }
      const text = buildCoverLetter(answers).toLowerCase();
      for (const phrase of banned) {
        assert.ok(!text.includes(phrase), phrase);
      }
    }
  });

  it("the initial draft does not mention missing requirements", async () => {
    const r = await loadResult();
    for (const item of r.match.items.filter((m) => m.status === "missing")) {
      assert.ok(!r.initialDraft.includes(item.requirement));
    }
    for (const word of ["Kubernetes", "Kafka", "Terraform"]) {
      assert.ok(!r.initialDraft.includes(word), word);
    }
  });
});

describe("privacy and isolation", () => {
  const libDir = path.join(process.cwd(), "src", "lib");
  const sourceFiles = ["mock", "result"].flatMap((dir) =>
    readdirSync(path.join(libDir, dir))
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => path.join(libDir, dir, f)),
  );
  const forbidden = [
    "@/lib/logger",
    "pino",
    "unpdf",
    "@/lib/db",
    "@prisma",
    "pg",
  ];

  it("finds the source files", () => {
    assert.ok(sourceFiles.length >= 5);
  });

  it("imports no logger, pdf, database or prisma module and never uses console", () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      for (const name of forbidden) {
        assert.ok(!source.includes(`"${name}"`), `${file} imports ${name}`);
      }
      assert.ok(!source.includes("console."), `${file} uses console`);
    }
  });

  it("limits.ts has no import statements", () => {
    const source = readFileSync(path.join(libDir, "limits.ts"), "utf8");
    assert.ok(!/^\s*import\s/m.test(source));
  });
});
