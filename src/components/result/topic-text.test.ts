import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COVER_LETTER_TOPIC_MAX_CHARS as CAP } from "@/lib/limits";
import { displayTopic } from "./topic-text";

const length = (s: string) => [...s].length;

describe("displayTopic", () => {
  it("leaves a short topic unchanged", () => {
    assert.equal(
      displayTopic("running services on Kubernetes"),
      "running services on Kubernetes",
    );
  });

  it("leaves a topic of exactly the cap unchanged", () => {
    const topic = "a".repeat(CAP);
    assert.equal(displayTopic(topic), topic);
  });

  it("truncates cap + 1 to the cap, ending with an ellipsis", () => {
    const result = displayTopic("a".repeat(CAP + 1));
    assert.equal(length(result), CAP);
    assert.ok(result.endsWith("…"));
    assert.equal(result, "a".repeat(CAP - 1) + "…");
  });

  it("collapses whitespace and line breaks into single spaces", () => {
    assert.equal(
      displayTopic("  one\n\ntwo\t three\r\n four  "),
      "one two three four",
    );
  });

  it("counts an emoji as one character and never splits it", () => {
    const exact = "😀".repeat(CAP);
    assert.equal(displayTopic(exact), exact);

    const result = displayTopic("😀".repeat(CAP + 5));
    assert.equal(length(result), CAP);
    assert.equal(result, "😀".repeat(CAP - 1) + "…");
    // No lone surrogate halves left behind.
    assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(result));
  });

  it("returns an empty string for empty or whitespace-only input", () => {
    assert.equal(displayTopic(""), "");
    assert.equal(displayTopic("  \n\t "), "");
  });
});
