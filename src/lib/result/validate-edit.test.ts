import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CV_ACHIEVEMENT_MAX_CHARS,
  CV_SHORT_TEXT_MAX_CHARS,
  CV_SUMMARY_MAX_CHARS,
} from "@/lib/limits";
import type { ChangeTarget } from "@/lib/result/types";
import {
  maxLengthForTarget,
  normalizeEditedText,
  validateEditedText,
} from "@/lib/result/validate-edit";

const targets: [string, ChangeTarget, number][] = [
  ["summary", { kind: "summary" }, CV_SUMMARY_MAX_CHARS],
  [
    "achievement",
    { kind: "achievement", experienceIndex: 0, achievementIndex: 0 },
    CV_ACHIEVEMENT_MAX_CHARS,
  ],
  ["skill", { kind: "skill", skillIndex: 0 }, CV_SHORT_TEXT_MAX_CHARS],
];

describe("validateEditedText", () => {
  for (const [name, target, max] of targets) {
    it(`${name}: limit is ${max}`, () => {
      assert.equal(maxLengthForTarget(target), max);
    });

    it(`${name}: rejects empty and whitespace-only text`, () => {
      const message = "Write some text, or reject this change instead.";
      assert.equal(validateEditedText(target, ""), message);
      assert.equal(validateEditedText(target, " \n\t "), message);
    });

    it(`${name}: accepts exactly the limit and rejects limit + 1`, () => {
      assert.equal(validateEditedText(target, "a".repeat(max)), null);
      assert.equal(
        validateEditedText(target, "a".repeat(max + 1)),
        `Too long: remove 1 character (limit is ${max}).`,
      );
      assert.equal(
        validateEditedText(target, "a".repeat(max + 2)),
        `Too long: remove 2 characters (limit is ${max}).`,
      );
    });

    it(`${name}: trailing and leading whitespace is not counted`, () => {
      assert.equal(validateEditedText(target, "a".repeat(max) + "  \n "), null);
      assert.equal(validateEditedText(target, " \n" + "a".repeat(max)), null);
      assert.notEqual(
        validateEditedText(target, "a".repeat(max + 1) + "  \n "),
        null,
      );
    });

    it(`${name}: counts an emoji as 1 character`, () => {
      assert.equal(validateEditedText(target, "😀".repeat(max)), null);
      assert.notEqual(validateEditedText(target, "😀".repeat(max + 1)), null);
    });
  }
});

describe("normalizeEditedText", () => {
  const achievement: ChangeTarget = {
    kind: "achievement",
    experienceIndex: 0,
    achievementIndex: 0,
  };
  const skill: ChangeTarget = { kind: "skill", skillIndex: 0 };
  const summary: ChangeTarget = { kind: "summary" };

  for (const target of [achievement, skill]) {
    it(`${target.kind}: line breaks become one space`, () => {
      assert.equal(normalizeEditedText(target, "a\nb"), "a b");
      assert.equal(normalizeEditedText(target, "a\r\nb"), "a b");
      assert.equal(normalizeEditedText(target, "a \n\n b"), "a b");
      assert.equal(normalizeEditedText(target, "a\r\n\r\n\r\nb"), "a b");
      assert.equal(normalizeEditedText(target, "  a\nb \n"), "a b");
    });

    it(`${target.kind}: leaves spaces without line breaks alone`, () => {
      assert.equal(normalizeEditedText(target, "a  b"), "a  b");
    });

    it(`${target.kind}: length is counted after the conversion`, () => {
      const max = maxLengthForTarget(target);
      // Exactly max characters once " \n\n " becomes one space, but longer before.
      const fits = "a".repeat(max - 2) + " \n\n b";
      assert.ok(fits.length > max);
      assert.equal(normalizeEditedText(target, fits).length, max);
      assert.equal(validateEditedText(target, fits), null);
      // One character over after the conversion.
      const over = "a".repeat(max - 1) + " \n\n b";
      assert.equal(
        validateEditedText(target, over),
        `Too long: remove 1 character (limit is ${max}).`,
      );
    });
  }

  it("summary: keeps inner line breaks but trims", () => {
    assert.equal(normalizeEditedText(summary, "  a\n\nb \n"), "a\n\nb");
    assert.equal(normalizeEditedText(summary, "a\r\nb"), "a\r\nb");
  });
});
