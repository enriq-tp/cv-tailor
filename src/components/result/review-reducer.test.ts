import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countDecisions,
  createInitialDecisions,
  reviewReducer,
} from "./review-reducer";
import type { SuggestedChange } from "@/lib/result/types";

// Only id matters for the reducer; the other fields are filled with short dummy values.
const change = (id: string): SuggestedChange => ({
  id,
  section: "Summary",
  label: "label",
  target: { kind: "summary" },
  before: "before",
  after: "after",
});
const changes = [change("a"), change("b"), change("c")];

describe("createInitialDecisions", () => {
  it("starts every change as pending", () => {
    assert.deepEqual(createInitialDecisions(changes), {
      a: { status: "pending" },
      b: { status: "pending" },
      c: { status: "pending" },
    });
  });
});

describe("reviewReducer", () => {
  const start = createInitialDecisions(changes);

  it("accept marks the change as accepted", () => {
    const next = reviewReducer(start, { type: "accept", id: "a" });
    assert.deepEqual(next.a, { status: "accepted" });
    assert.deepEqual(next.b, { status: "pending" });
  });

  it("reject marks the change as rejected", () => {
    const next = reviewReducer(start, { type: "reject", id: "b" });
    assert.deepEqual(next.b, { status: "rejected" });
  });

  it("edit accepts the change and keeps the text", () => {
    const next = reviewReducer(start, { type: "edit", id: "c", text: "mine" });
    assert.deepEqual(next.c, { status: "accepted", editedText: "mine" });
  });

  it("undo goes back to pending and clears the edit", () => {
    const edited = reviewReducer(start, {
      type: "edit",
      id: "c",
      text: "mine",
    });
    const next = reviewReducer(edited, { type: "undo", id: "c" });
    assert.deepEqual(next.c, { status: "pending" });
    assert.equal("editedText" in next.c, false);
  });

  it("reject after an edit forgets the edited text", () => {
    const edited = reviewReducer(start, {
      type: "edit",
      id: "a",
      text: "mine",
    });
    const next = reviewReducer(edited, { type: "reject", id: "a" });
    assert.deepEqual(next.a, { status: "rejected" });
  });

  it("ignores unknown ids and returns the same state", () => {
    for (const type of ["accept", "reject", "undo"] as const) {
      assert.equal(reviewReducer(start, { type, id: "nope" }), start);
    }
    assert.equal(
      reviewReducer(start, { type: "edit", id: "nope", text: "x" }),
      start,
    );
    // An id that exists on every object must not count as known.
    assert.equal(
      reviewReducer(start, { type: "accept", id: "toString" }),
      start,
    );
  });

  it("does not change the previous state", () => {
    const copy = structuredClone(start);
    reviewReducer(start, { type: "accept", id: "a" });
    assert.deepEqual(start, copy);
  });
});

describe("countDecisions", () => {
  it("counts everything as pending at the start", () => {
    assert.deepEqual(countDecisions(changes, createInitialDecisions(changes)), {
      pending: 3,
      accepted: 0,
      rejected: 0,
    });
  });

  it("counts each status", () => {
    let state = createInitialDecisions(changes);
    state = reviewReducer(state, { type: "accept", id: "a" });
    state = reviewReducer(state, { type: "edit", id: "b", text: "mine" });
    state = reviewReducer(state, { type: "reject", id: "c" });
    assert.deepEqual(countDecisions(changes, state), {
      pending: 0,
      accepted: 2,
      rejected: 1,
    });
  });

  it("treats a change without a decision as pending and ignores unknown ids", () => {
    assert.deepEqual(
      countDecisions(changes, {
        a: { status: "accepted" },
        zzz: { status: "rejected" },
      }),
      { pending: 2, accepted: 1, rejected: 0 },
    );
  });
});
