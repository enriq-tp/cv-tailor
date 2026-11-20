// Validation of the text the user types when editing a suggested change.
// Pure and client-safe: it imports only constants (no zod), so the browser stays light.
// The limits are the same as the CV schema's, so an edited CV still passes CvSchema.

import {
  CV_ACHIEVEMENT_MAX_CHARS,
  CV_SHORT_TEXT_MAX_CHARS,
  CV_SUMMARY_MAX_CHARS,
} from "@/lib/limits";
import type { ChangeTarget } from "@/lib/result/types";

export function maxLengthForTarget(target: ChangeTarget): number {
  switch (target.kind) {
    case "summary":
      return CV_SUMMARY_MAX_CHARS;
    case "achievement":
      return CV_ACHIEVEMENT_MAX_CHARS;
    case "skill":
      return CV_SHORT_TEXT_MAX_CHARS;
  }
}

// The one place that decides what text is stored. Validation and saving must use
// this exact same text, so what is counted is what is stored.
// Single-line fields (a bullet, a skill): every run of whitespace that contains a
// line break becomes one space. The summary keeps its line breaks. Both are trimmed.
export function normalizeEditedText(
  target: ChangeTarget,
  text: string,
): string {
  if (target.kind === "summary") return text.trim();
  return text.replace(/[^\S\r\n]*[\r\n]\s*/g, " ").trim();
}

// Returns an error message, or null when the text is fine.
export function validateEditedText(
  target: ChangeTarget,
  text: string,
): string | null {
  const normalized = normalizeEditedText(target, text);
  if (normalized.length === 0)
    return "Write some text, or reject this change instead.";

  const max = maxLengthForTarget(target);
  // [...normalized].length counts code points (an emoji is 1), like the browser's form
  // does, while .length would count UTF-16 units (an emoji is 2).
  const extra = [...normalized].length - max;
  if (extra > 0)
    return `Too long: remove ${extra} ${extra === 1 ? "character" : "characters"} (limit is ${max}).`;

  return null;
}
