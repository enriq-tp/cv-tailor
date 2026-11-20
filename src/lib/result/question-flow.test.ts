import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COVER_LETTER_TOPIC_MAX_CHARS } from "@/lib/limits";
import { questions } from "@/lib/mock/mock-data";
import {
  MAX_COVER_LETTER_QUESTIONS,
  getCurrentQuestion,
  getVisibleQuestions,
  isValidTopic,
  summarizeAnswers,
} from "@/lib/result/question-flow";
import type { CoverLetterAnswer, CoverLetterAnswers } from "@/lib/result/types";

const answered: CoverLetterAnswer = { type: "answered", text: "Sample text." };
const noExperience: CoverLetterAnswer = { type: "noExperience" };
const skipped: CoverLetterAnswer = { type: "skipped" };

const currentId = (answers: CoverLetterAnswers) =>
  getCurrentQuestion(questions, answers)?.id;

describe("getCurrentQuestion", () => {
  it("starts with the first question", () => {
    assert.equal(currentId({}), "q-1");
  });

  it("shows a follow-up only after noExperience on its parent", () => {
    assert.equal(currentId({ "q-1": noExperience }), "q-1-follow");
    assert.equal(currentId({ "q-1": answered }), "q-2");
    assert.equal(currentId({ "q-1": skipped }), "q-2");
  });

  it("noExperience on a non-gap question reveals nothing and is not an answer", () => {
    const answers = { "q-general-1": noExperience };
    assert.equal(currentId({ "q-1": skipped, "q-2": skipped }), "q-general-1");
    assert.equal(
      currentId({ "q-1": skipped, "q-2": skipped, ...answers }),
      "q-general-1",
    );
    // noExperience on a follow-up is ignored too: it stays the current question.
    assert.equal(
      currentId({ "q-1": noExperience, "q-1-follow": noExperience }),
      "q-1-follow",
    );
  });

  it("walks through the list in order", () => {
    const answers: CoverLetterAnswers = {};
    const walk = [
      ["q-1", noExperience],
      ["q-1-follow", answered],
      ["q-2", answered],
      ["q-general-1", skipped],
      ["q-general-2", answered],
    ] as const;
    for (const [id, answer] of walk) {
      assert.equal(currentId(answers), id);
      answers[id] = answer;
    }
    assert.equal(currentId(answers), undefined);
  });
});

describe("getVisibleQuestions", () => {
  it("lists answered questions plus the current one, never a hidden follow-up", () => {
    const ids = (a: CoverLetterAnswers) =>
      getVisibleQuestions(questions, a).map((q) => q.id);
    assert.deepEqual(ids({}), ["q-1"]);
    assert.deepEqual(ids({ "q-1": answered }), ["q-1", "q-2"]);
    assert.deepEqual(ids({ "q-1": noExperience }), ["q-1", "q-1-follow"]);
  });

  // Every combination of "no answer" and the three outcomes for all six questions.
  it("never shows more than MAX_COVER_LETTER_QUESTIONS, and the worst case is exactly that", () => {
    const options: (CoverLetterAnswer | undefined)[] = [
      undefined,
      answered,
      noExperience,
      skipped,
    ];
    const total = options.length ** questions.length;
    let worst = 0;
    for (let n = 0; n < total; n++) {
      const answers: CoverLetterAnswers = {};
      let rest = n;
      for (const q of questions) {
        const option = options[rest % options.length];
        rest = Math.floor(rest / options.length);
        if (option) answers[q.id] = option;
      }
      worst = Math.max(worst, getVisibleQuestions(questions, answers).length);
    }
    assert.ok(worst <= MAX_COVER_LETTER_QUESTIONS);
    assert.equal(worst, MAX_COVER_LETTER_QUESTIONS);
  });
});

describe("summarizeAnswers", () => {
  it("counts noExperience as answered and a skipped follow-up as skipped", () => {
    const summary = summarizeAnswers(questions, {
      "q-1": noExperience,
      "q-1-follow": skipped,
      "q-2": answered,
      "q-general-1": skipped,
    });
    // visible: q-1, q-1-follow, q-2, q-general-1, plus current q-general-2
    assert.deepEqual(summary, {
      answered: 2,
      noExperience: 1,
      skipped: 2,
      total: 5,
    });
  });

  it("ignores a hidden follow-up answer", () => {
    const summary = summarizeAnswers(questions, {
      "q-1": answered,
      "q-1-follow": answered,
    });
    assert.deepEqual(summary, {
      answered: 1,
      noExperience: 0,
      skipped: 0,
      total: 2,
    });
  });
});

describe("isValidTopic", () => {
  it("accepts a short noun phrase", () => {
    assert.ok(isValidTopic("running services on Kubernetes"));
  });

  it("rejects empty, too long, control characters, < and >", () => {
    assert.ok(!isValidTopic("   "));
    assert.ok(!isValidTopic("a".repeat(COVER_LETTER_TOPIC_MAX_CHARS + 1)));
    assert.ok(isValidTopic("a".repeat(COVER_LETTER_TOPIC_MAX_CHARS)));
    assert.ok(!isValidTopic("line\nbreak"));
    assert.ok(!isValidTopic("bad\u0000topic"));
    assert.ok(!isValidTopic("<b>bold</b>"));
    assert.ok(!isValidTopic("a > b"));
  });

  it("counts code points, not UTF-16 units", () => {
    assert.ok(isValidTopic("😀".repeat(COVER_LETTER_TOPIC_MAX_CHARS)));
  });
});
