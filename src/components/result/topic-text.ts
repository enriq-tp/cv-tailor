import { COVER_LETTER_TOPIC_MAX_CHARS } from "@/lib/limits";

// The text to show for a cover letter question topic. In Phase 2 the topic derives from the
// untrusted job posting, so even if the model returns something long or with line breaks,
// the screen (and the accessible names of the buttons) stay short and on one line.
// This is a last safety net: the topic should already be validated or truncated upstream.
// - Whitespace and line breaks become single spaces, then the ends are trimmed.
// - Longer than the cap: cut and end with "…", so the TOTAL (ellipsis included) fits the cap.
// - Characters are counted as code points ([...text]), so an emoji is one character and the
//   cut can never fall in the middle of its two UTF-16 units.
export function displayTopic(topic: string): string {
  const oneLine = topic.replace(/\s+/g, " ").trim();
  const chars = [...oneLine];
  if (chars.length <= COVER_LETTER_TOPIC_MAX_CHARS) return oneLine;
  // Keep room for the ellipsis; trimEnd avoids "word …".
  return (
    chars
      .slice(0, COVER_LETTER_TOPIC_MAX_CHARS - 1)
      .join("")
      .trimEnd() + "…"
  );
}
