// The cover letter as a PDF: same header and typography as the CV, one A4 page.
// The text is the draft exactly as the user sees it in the textarea.
//
// Paragraphs: a BLANK line starts a new paragraph. A single line break inside a paragraph is
// KEPT as a line break (not turned into a space), because that is how people type an address
// block or a sign-off ("Kind regards," then the name on the next line).
// If the text is too long for one page it flows onto a second page; the screen then warns the
// user (nothing is cut or shrunk).

import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Cv } from "@/lib/schemas";
import { ContactHeader, PageCounter } from "./cv-document";
import { PAGE_SIZE, disableHyphenation, styles } from "./pdf-styles";
import { pdfText } from "./supported-characters";

export type LetterDocumentProps = {
  contact: Cv["contact"];
  text: string;
  onPageCount?: (pageCount: number) => void;
};

export function LetterDocument({
  contact,
  text,
  onPageCount,
}: LetterDocumentProps) {
  disableHyphenation();

  const paragraphs = pdfText(text)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <Document title="Cover letter" language="en-GB">
      <Page size={PAGE_SIZE} style={styles.page}>
        <ContactHeader contact={contact} />
        <View style={styles.section}>
          {paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
        <PageCounter onPageCount={onPageCount} />
      </Page>
    </Document>
  );
}
