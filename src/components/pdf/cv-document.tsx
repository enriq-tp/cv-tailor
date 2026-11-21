// The fixed CV template. One design, no options: the LLM (or the user) only supplies DATA.
// Why fixed: the layout is tested once and then predictable for every CV, and it can be made
// ATS-friendly once (see the sketch in docs/wiki/ui.md).
//
// Rules of the design (each one helps an applicant tracking system read the text in order):
// single column, real text (no images, no icons, no tables), standard fonts, standard
// section headings in a fixed order, nothing in headers or footers, no page numbers.
// Section headings are English on purpose (target market: UK jobs).
//
// A section with no content is left out entirely: no heading without content, no label
// without a value, no empty separators.

import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Cv } from "@/lib/schemas";
import { PAGE_SIZE, disableHyphenation, styles } from "./pdf-styles";
import { pdfLine, pdfText } from "./supported-characters";

export type CvDocumentProps = {
  cv: Cv;
  /** Called with the real number of pages of the finished layout. */
  onPageCount?: (pageCount: number) => void;
};

// ---- Small helpers that turn data into the strings we print ---------------------------------

/** Joins the parts that are not empty. Empty parts leave no separator behind. */
function join(parts: (string | null | undefined)[], separator: string): string {
  return parts.map(pdfLine).filter(Boolean).join(separator);
}

function dateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  isCurrent: boolean | null | undefined,
): string {
  const to = isCurrent ? "Present" : end;
  return join([start, to], " - ");
}

/** One contact line: only the items that exist, separated by " | ". Links are plain text. */
export function contactLine(contact: Cv["contact"]): string {
  const links = contact.links.map((link) =>
    link.url ? join([link.label, link.url], ": ") : pdfLine(link.label),
  );
  return join(
    [contact.email, contact.phone, contact.location, ...links],
    " | ",
  );
}

// ---- Pieces ---------------------------------------------------------------------------------

/** Name, contact line and a thin rule. Also used by the cover letter. */
export function ContactHeader({ contact }: { contact: Cv["contact"] }) {
  const name = pdfLine(contact.fullName);
  const line = contactLine(contact);
  if (!name && !line) return null;
  return (
    <View>
      {name ? <Text style={styles.name}>{name}</Text> : null}
      {line ? <Text style={styles.contact}>{line}</Text> : null}
      <View style={styles.rule} />
    </View>
  );
}

// The page count: react-pdf gives `totalPages` to the `render` function of a `fixed` Text
// (a `fixed` element is repeated on every page). This Text prints nothing (it returns an empty
// string) and is taken out of the layout (position: absolute), so it changes neither the
// extracted text nor the look. The function is called more than once while react-pdf lays the
// document out; the value is the same each time. We do NOT count "/Type /Page" in the bytes:
// that breaks on compressed PDFs.
export function PageCounter({
  onPageCount,
}: {
  onPageCount?: (pageCount: number) => void;
}) {
  if (!onPageCount) return null;
  return (
    <Text
      fixed
      style={styles.counter}
      render={({ totalPages }) => {
        onPageCount(totalPages);
        return "";
      }}
    />
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      {/* minPresenceAhead: if less than 40 pt is left under the heading, move the heading to
          the next page, so a heading is never alone at the bottom of a page. */}
      <Text style={styles.heading} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>{"•"}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

// ---- The document ---------------------------------------------------------------------------

export function CvDocument({ cv, onPageCount }: CvDocumentProps) {
  disableHyphenation();

  const summary = pdfText(cv.summary);

  const experience = cv.experience
    .map((job) => ({
      title: join([job.title, job.company], ", "),
      meta: join(
        [job.location, dateRange(job.startDate, job.endDate, job.isCurrent)],
        " | ",
      ),
      bullets: job.achievements.map(pdfLine).filter(Boolean),
    }))
    .filter((job) => job.title || job.meta || job.bullets.length > 0);

  const education = cv.education
    .map((school) => ({
      title: join([school.degree, school.field], ", "),
      meta: join(
        [
          school.institution,
          dateRange(school.startDate, school.endDate, false),
        ],
        " | ",
      ),
    }))
    .filter((school) => school.title || school.meta);

  const skills = join(cv.skills, ", ");

  const projects = cv.projects
    .map((project) => ({
      name: pdfLine(project.name),
      description: pdfLine(project.description),
      technologies: join(project.technologies, ", "),
      url: pdfLine(project.url),
    }))
    .filter(
      (project) =>
        project.name ||
        project.description ||
        project.technologies ||
        project.url,
    );

  const languages = join(
    cv.languages.map((language) =>
      language.proficiency
        ? `${pdfLine(language.name)} (${pdfLine(language.proficiency)})`
        : language.name,
    ),
    ", ",
  );

  return (
    // No author, subject or keywords: the file carries nothing personal in its metadata.
    <Document title="CV" language="en-GB">
      <Page size={PAGE_SIZE} style={styles.page}>
        <ContactHeader contact={cv.contact} />

        {summary ? (
          <Section title="Summary">
            <Text>{summary}</Text>
          </Section>
        ) : null}

        {experience.length > 0 ? (
          <Section title="Experience">
            {experience.map((job, index) => (
              <View key={index} style={styles.entry}>
                {/* wrap={false} only on this SMALL block (title, dates and the first bullet):
                    it keeps the title together with its first bullet. The rest of the
                    bullets flow normally and may continue on the next page. */}
                <View wrap={false}>
                  {job.title ? (
                    <Text style={styles.bold}>{job.title}</Text>
                  ) : null}
                  {job.meta ? <Text>{job.meta}</Text> : null}
                  {job.bullets[0] ? <Bullet text={job.bullets[0]} /> : null}
                </View>
                {job.bullets.slice(1).map((bullet, i) => (
                  <Bullet key={i} text={bullet} />
                ))}
              </View>
            ))}
          </Section>
        ) : null}

        {education.length > 0 ? (
          <Section title="Education">
            {education.map((school, index) => (
              <View key={index} style={styles.entry} wrap={false}>
                {school.title ? (
                  <Text style={styles.bold}>{school.title}</Text>
                ) : null}
                {school.meta ? <Text>{school.meta}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {skills ? (
          <Section title="Skills">
            <Text>{skills}</Text>
          </Section>
        ) : null}

        {projects.length > 0 ? (
          <Section title="Projects">
            {projects.map((project, index) => (
              <View key={index} style={styles.entry}>
                {project.name ? (
                  <Text style={styles.bold}>{project.name}</Text>
                ) : null}
                {project.description ? (
                  <Text>{project.description}</Text>
                ) : null}
                {project.technologies ? (
                  <Text>{`Technologies: ${project.technologies}`}</Text>
                ) : null}
                {project.url ? <Text>{project.url}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {languages ? (
          <Section title="Languages">
            <Text>{languages}</Text>
          </Section>
        ) : null}

        <PageCounter onPageCount={onPageCount} />
      </Page>
    </Document>
  );
}
