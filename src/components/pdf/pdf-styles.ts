// Look of the PDF: ONE fixed design shared by the CV and the cover letter.
//
// How react-pdf lays out a page (see docs/wiki/ui.md for the longer version):
// - <Page> is a sheet of paper, <View> is a box (like a div) and <Text> holds text.
// - Styles look like CSS but use POINTS, not pixels. 1 pt = 1/72 inch, A4 = 595 x 842 pt.
// - Boxes are laid out with flexbox, and the default direction is a COLUMN (top to bottom).
// - When the content is taller than the page, react-pdf starts a new page by itself
//   ("automatic page breaks"). A box marked `wrap={false}` is never split across two pages.

import { Font, StyleSheet } from "@react-pdf/renderer";

export const PAGE_SIZE = "A4";
// 18 mm in points (1 mm = 72 / 25.4 pt).
const MARGIN = (18 * 72) / 25.4;

// The accent is the app's cobalt, so the PDF looks like the screen. Ink is the app's text colour.
export const ACCENT = "#1F44C7";
export const INK = "#18212B";

const REGULAR = "Helvetica"; // standard PDF fonts: built into every reader, not embedded
const BOLD = "Helvetica-Bold";

export const styles = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    fontFamily: REGULAR,
    fontSize: 10,
    lineHeight: 1.35,
    color: INK,
  },
  name: { fontFamily: BOLD, fontSize: 20, color: ACCENT },
  contact: { marginTop: 4 },
  // A thin line under the header. It is a box with only a bottom border: no image, no text.
  rule: { marginTop: 8, borderBottomWidth: 1, borderBottomColor: ACCENT },
  section: { marginTop: 14 },
  heading: { fontFamily: BOLD, fontSize: 12, marginBottom: 4 },
  entry: { marginBottom: 7 },
  bold: { fontFamily: BOLD },
  paragraph: { marginBottom: 8 },
  // A bullet is a row: a narrow column with "•" and a column with the text (flex: 1 = the rest
  // of the width), so a long bullet wraps under its own text, not under the "•".
  bulletRow: { flexDirection: "row", marginTop: 2 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1 },
  // The invisible page counter (see PageCounter in cv-document.tsx): out of the layout flow.
  counter: {
    position: "absolute",
    top: 0,
    left: 0,
    fontSize: 1,
    color: "#FFFFFF",
  },
});

let hyphenationDisabled = false;

// react-pdf cuts long words with hyphens by default ("expi-" / "alidocious"). In an extracted
// text (what an ATS reads) that splits one word in two, so we switch it off: a word is never
// broken. The callback answers "where may this word be split?" with "nowhere". It is a global
// setting of the library, so we do it once.
export function disableHyphenation(): void {
  if (hyphenationDisabled) return;
  Font.registerHyphenationCallback((word) => [word]);
  hyphenationDisabled = true;
}
