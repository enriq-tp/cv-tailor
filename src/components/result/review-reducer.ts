// State of the review: one decision per suggested change. Pure TypeScript (no React), so it
// can be tested on its own. Only types are imported: nothing server-side reaches the browser.
//
// The counters (pending / accepted / rejected) are NOT stored. They are calculated from the
// decisions by countDecisions(), so they can never disagree with the cards.

import type { Decisions, SuggestedChange } from "@/lib/result/types";

export type ReviewAction =
  | { type: "accept"; id: string }
  | { type: "reject"; id: string }
  | { type: "undo"; id: string } // back to pending, and the user's edit is forgotten
  | { type: "edit"; id: string; text: string }; // the edited text counts as accepted

// Every change starts as pending.
export function createInitialDecisions(changes: SuggestedChange[]): Decisions {
  return Object.fromEntries(
    changes.map((change) => [change.id, { status: "pending" as const }]),
  );
}

export function reviewReducer(
  decisions: Decisions,
  action: ReviewAction,
): Decisions {
  // An id we do not know about is ignored: the state is returned unchanged.
  if (!Object.prototype.hasOwnProperty.call(decisions, action.id)) {
    return decisions;
  }

  switch (action.type) {
    case "accept":
      return { ...decisions, [action.id]: { status: "accepted" } };
    case "reject":
      return { ...decisions, [action.id]: { status: "rejected" } };
    case "undo":
      return { ...decisions, [action.id]: { status: "pending" } };
    case "edit":
      return {
        ...decisions,
        [action.id]: { status: "accepted", editedText: action.text },
      };
  }
}

export type DecisionCounts = {
  pending: number;
  accepted: number;
  rejected: number;
};

// A change without an entry counts as pending.
export function countDecisions(
  changes: SuggestedChange[],
  decisions: Decisions,
): DecisionCounts {
  const counts: DecisionCounts = { pending: 0, accepted: 0, rejected: 0 };
  for (const change of changes) {
    const status = decisions[change.id]?.status ?? "pending";
    counts[status] += 1;
  }
  return counts;
}
