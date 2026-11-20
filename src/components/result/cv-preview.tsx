"use client";

import type { Decisions, MockResult, SuggestedChange } from "@/lib/mock";
import { applyChanges } from "@/lib/result/apply-changes";
import { useMediaQuery } from "./use-media-query";

type Props = {
  // The Cv type taken from MockResult, so this file never imports the zod schemas.
  originalCv: MockResult["originalCv"];
  changes: SuggestedChange[];
  decisions: Decisions;
};

// Which slots of the CV still wait for a decision. Used only to draw the quiet "pending" mark.
function findPendingSlots(changes: SuggestedChange[], decisions: Decisions) {
  const slots = {
    summary: false,
    achievements: new Set<string>(),
    skills: new Set<number>(),
  };
  for (const { id, target } of changes) {
    if (decisions[id]?.status !== "pending") continue;
    if (target.kind === "summary") slots.summary = true;
    else if (target.kind === "skill") slots.skills.add(target.skillIndex);
    else
      slots.achievements.add(
        `${target.experienceIndex}-${target.achievementIndex}`,
      );
  }
  return slots;
}

// Text mark, not colour: "pending" in italics.
function Pending() {
  return <span className="ml-2 text-slate italic">(pending)</span>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-5 border-b border-edge pb-1 font-heading text-lg font-semibold">
      {children}
    </h4>
  );
}

// The CV as a sheet. It shows the result of applyChanges: accepted and edited changes are in,
// rejected and pending ones show the original text.
function CvSheet({ originalCv, changes, decisions }: Props) {
  const cv = applyChanges(originalCv, changes, decisions);
  const pending = findPendingSlots(changes, decisions);
  const contact = cv.contact;

  return (
    <article className="min-w-0 px-5 py-6 wrap-break-word">
      <p className="font-heading text-2xl font-semibold">{contact.fullName}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 text-slate">
        {[contact.email, contact.phone, contact.location]
          .filter(Boolean)
          .map((item) => (
            <span key={item}>{item}</span>
          ))}
      </p>

      {cv.summary && (
        <>
          <SectionTitle>Summary</SectionTitle>
          <p className="mt-2">
            {cv.summary}
            {pending.summary && <Pending />}
          </p>
        </>
      )}

      {cv.experience.length > 0 && (
        <>
          <SectionTitle>Experience</SectionTitle>
          {cv.experience.map((job, jobIndex) => (
            <div key={jobIndex} className="mt-3">
              <p className="font-semibold">
                {job.title}, {job.company}
              </p>
              <p className="text-slate">
                {job.startDate} to {job.endDate}
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {job.achievements.map((text, i) => (
                  <li key={i}>
                    {text}
                    {pending.achievements.has(`${jobIndex}-${i}`) && (
                      <Pending />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {cv.education.length > 0 && (
        <>
          <SectionTitle>Education</SectionTitle>
          {cv.education.map((school, i) => (
            <div key={i} className="mt-3">
              <p className="font-semibold">
                {school.degree} {school.field}, {school.institution}
              </p>
              <p className="text-slate">
                {school.startDate} to {school.endDate}
              </p>
            </div>
          ))}
        </>
      )}

      {cv.skills.length > 0 && (
        <>
          <SectionTitle>Skills</SectionTitle>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {cv.skills.map((skill, i) => (
              <li key={i}>
                {skill}
                {pending.skills.has(i) && <Pending />}
              </li>
            ))}
          </ul>
        </>
      )}

      {cv.languages.length > 0 && (
        <>
          <SectionTitle>Languages</SectionTitle>
          <ul className="mt-2 space-y-1">
            {cv.languages.map((language, i) => (
              <li key={i}>
                {language.name} ({language.proficiency})
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

const SHEET = "border-2 border-edge bg-paper shadow-[0_1px_0_var(--edge)]";

// ONE preview in the DOM, two wrappers:
// - Wide screens (1024 px and up): sticky, with a maximum height. If the CV is taller, the box
//   scrolls inside. A scrolling box must be reachable with the keyboard, so it gets
//   tabIndex=0, a role and a name (and the global focus ring shows when it is focused).
// - Narrow screens: an open <details> (the user can fold it), no inner scroll area.
// Sticky is pure CSS (.cv-preview-sticky / .cv-preview-box in globals.css): it applies only when
// the viewport is also tall enough (min-height 40rem), so in a short window or at large text zoom
// the preview is a normal block that scrolls with the page (still a keyboard stop), and the
// notice bar can never cover it. All offsets there are rem, so they scale with text zoom.
export function CvPreview(props: Props) {
  const isWide = useMediaQuery("(min-width: 1024px)");

  if (isWide) {
    return (
      <div className="cv-preview-sticky">
        <h3 className="font-heading text-xl font-semibold">CV preview</h3>
        <div
          role="region"
          aria-label="CV preview"
          tabIndex={0}
          className={`${SHEET} cv-preview-box mt-2`}
        >
          <CvSheet {...props} />
        </div>
      </div>
    );
  }

  return (
    <details open>
      <summary className="min-h-11 cursor-pointer py-2 font-heading text-xl font-semibold">
        CV preview
      </summary>
      <div className={`${SHEET} mt-2`}>
        <CvSheet {...props} />
      </div>
    </details>
  );
}
