// Builds the CV the user will download from the original CV plus their decisions.
// Pure function: returns a new object and never mutates its inputs.

import type { Cv } from "@/lib/schemas";
import type { Decisions, SuggestedChange } from "@/lib/result/types";

export function applyChanges(
  originalCv: Cv,
  changes: SuggestedChange[],
  decisions: Decisions,
): Cv {
  // structuredClone = deep copy, so editing the copy cannot touch the original.
  const cv = structuredClone(originalCv);

  for (const change of changes) {
    const decision = decisions[change.id];
    // Pending (no decision) or rejected: the original text stays.
    if (decision?.status !== "accepted") continue;

    // The user's own wording wins over the suggestion.
    const text = decision.editedText ?? change.after;
    const target = change.target;

    if (target.kind === "summary") {
      cv.summary = text;
    } else if (target.kind === "achievement") {
      const achievements = cv.experience[target.experienceIndex]?.achievements;
      // Out-of-range index: leave the CV unchanged for this change instead of throwing.
      if (
        achievements &&
        target.achievementIndex >= 0 &&
        target.achievementIndex < achievements.length
      ) {
        achievements[target.achievementIndex] = text;
      }
    } else if (target.skillIndex >= 0 && target.skillIndex < cv.skills.length) {
      cv.skills[target.skillIndex] = text;
    }
  }

  // Decisions for unknown change ids are never looked at, because we loop over `changes`.
  return cv;
}
