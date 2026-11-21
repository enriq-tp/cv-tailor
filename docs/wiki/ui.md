# UI (Task 5: input screen, Task 6: result screen, both mocked; Task 6.5: PDF template and download)

Status: the home page `/` has the input screen (CV drop zone, job posting notepad, "Tailor my CV" button). Nothing is processed: a valid form navigates to `/result`, which shows a SAMPLE result made of invented data (Task 6, see "Result screen" below). The result page does not read anything from the first page, on purpose.

## Visual direction

Subject: a job seeker putting two documents side by side. The memorable element is that the two inputs look like two sheets of paper:

- **CV** = a portrait A4-ratio sheet with a folded top-right corner. A dropped file shows its name, size and Replace / Remove buttons on the sheet.
- **Job posting** = a lined notepad with a red-ish left margin rule.

Everything else is deliberately quiet (chalk page, one cobalt accent, left aligned, short lines). It is not a generic template because there is no gradient hero, no row of identical rounded cards, no all-caps eyebrow labels, no numbered steps and no arrow on the button: the structure (two documents, one action) comes from the task itself. Light only.

## Palette and measured contrast

Tokens live in `src/app/globals.css` as CSS variables and are exposed to Tailwind through `@theme inline` (`bg-chalk`, `text-slate`, `text-cobalt`, ...). Ratios were computed with a small WCAG 2.x script (relative luminance), run outside the repo. No hex had to be adjusted.

| Token         | Hex       | Use                                        |
| ------------- | --------- | ------------------------------------------ |
| chalk         | `#EEF1EC` | page background                            |
| paper         | `#FFFFFF` | the sheets                                 |
| ink           | `#18212B` | text                                       |
| slate         | `#4D5967` | secondary text, placeholder                |
| cobalt        | `#1F44C7` | primary button, focus ring, links, accent  |
| cobalt-dark   | `#183899` | button hover                               |
| brick         | `#B3261E` | errors (always with icon and text)         |
| edge          | `#6F7B88` | border of the sheets                       |
| line          | `#E4E9E2` | notepad ruled lines (decorative)           |
| margin-rule   | `#E8B4B0` | notepad margin rule (decorative)           |
| disabled      | `#D9DED8` | button background while the form is incomplete |
| drag          | `#E6ECFB` | drop zone while dragging a file over it    |

| Pair                                  | Ratio  | Needed | Result |
| ------------------------------------- | ------ | ------ | ------ |
| ink on chalk                          | 14.27  | 4.5    | AA pass |
| ink on paper                          | 16.26  | 4.5    | AA pass |
| slate on chalk                        | 6.27   | 4.5    | AA pass |
| slate on paper (also placeholder)     | 7.14   | 4.5    | AA pass |
| white on cobalt (button text)         | 7.75   | 4.5    | AA pass |
| white on cobalt-dark (hover)          | 10.17  | 4.5    | AA pass |
| cobalt on paper (links, Replace text) | 7.75   | 4.5    | AA pass |
| cobalt on chalk (focus ring, link)    | 6.80   | 3      | pass   |
| cobalt on paper (focus ring, border)  | 7.75   | 3      | pass   |
| brick on paper (errors)               | 6.54   | 4.5    | AA pass |
| brick on chalk (errors)               | 5.74   | 4.5    | AA pass |
| edge on chalk (sheet border)          | 3.79   | 3      | pass   |
| edge on paper (sheet border)          | 4.32   | 3      | pass   |
| ink on drag                           | 13.75  | 4.5    | AA pass |
| slate on drag                         | 6.04   | 4.5    | AA pass |
| cobalt on drag                        | 6.55   | 4.5    | AA pass |
| disabled button: slate on disabled    | 5.23   | exempt (aimed 3) | pass |
| disabled button background on chalk   | 1.20   | exempt | low on purpose: it must look inactive; the hint text next to it explains why |
| notepad line on paper                 | 1.23   | none (decorative) | deliberately very faint so typed text stays legible |

## Typography

`next/font/google` (self-hosted at build time, no request to Google from the browser, no new dependency): **Bricolage Grotesque** for headings and sheet titles (`font-heading`), **Public Sans** for body and UI (`font-sans`). All text is at least 16 px so mobile browsers do not zoom on focus. Left aligned; paragraphs are capped at 60 characters wide.

## Components and files

```
src/app/layout.tsx         fonts, <html lang="en">, title and description (Server)
src/app/globals.css        tokens, focus style, sheet and notepad CSS, reduced motion
src/app/page.tsx           wordmark, h1, sub-line, <TailorForm /> (Server)
src/app/result/page.tsx    "Result - CV Tailor": notice, h1, Suspense around ResultView (Server)
src/components/
  tailor-form.tsx          "use client": state, derived validity, submit
  cv-dropzone.tsx          "use client": the CV sheet (file input, drag and drop)
  job-textarea.tsx         "use client": the notepad, counter, errors
  field-error.tsx          icon + text for an error (no state)
  form-validation.ts       pure TS: validateCvFile(s), validateJobTextInput, countCharacters, formatFileSize
  form-validation.test.ts  node:test for form-validation.ts
```

Server vs Client: pages are Server Components (static text, metadata). Only the form is a Client Component because it needs state, events and `useRouter`. Limits are imported from `@/lib/limits` (no imports, safe for the browser).

## Behaviour

- **File**: validated when chosen or dropped; the error shows at once and a rejected file is not kept (the previous file is cleared too, to keep one simple rule: an error means no file). Several files dropped -> "Drop one PDF at a time." PDF = MIME `application/pdf` OR name ending `.pdf` (Windows can report an empty MIME type). Max size and the other numbers in messages come from `limits.ts`. "Choose a PDF file." (missing file) appears only after a submit attempt or after a rejected/empty selection. **Remove** clears the file and resets the "touched" state, so the message does NOT appear right after pressing Remove; it appears when the user then presses the main button, which also moves focus to the file input.
- **Job text**: "too long" shows immediately; "too short" only after the field was left once or after a submit attempt. An empty untouched field shows no error. The counter `n / 20,000` is always visible.
- **Button uses `aria-disabled="true"`, not `disabled`**, while the form is invalid. Why: a `disabled` button cannot be focused or activated, so keyboard and screen reader users get no feedback about what is missing. With `aria-disabled` it stays focusable; activating it does not navigate, it marks both fields as touched (errors appear) and moves focus to the first invalid field (file input first, otherwise the textarea). The hint element (`#submit-hint`, linked with `aria-describedby`) is ALWAYS in the DOM: it explains what is missing, and says "Ready. Nothing is uploaded yet." when valid.
- **Valid**: `router.push("/result")`. Nothing is passed: no query string, no state, no storage.

## Accessibility decisions

- Every control has a visible `<label>`. The real file input is visually hidden (`sr-only`, not `display:none`) inside a `<label>`, so Tab, Enter and Space work; the focus ring is drawn on the sheet with `:focus-within`.
- Each field has an always-present `aria-live="polite"` region (errors go inside it), `aria-invalid` and `aria-describedby` (hint, file info, error). The character counter is not live, so it does not announce every keystroke.
- Errors are icon (aria-hidden) plus text, never colour alone.
- Visible cobalt focus ring (3 px) on everything. Buttons are at least 44 px high. `prefers-reduced-motion: reduce` turns off transitions and animations.
- Layout works from 360 px (stacked) and uses two columns from 768 px.

## Privacy rules for the UI

- The CV file and the pasted text stay in React state only. The file's content is never read (no `FileReader`, `arrayBuffer`, `text()`, `createObjectURL`). Only name and size are shown. (Since Task 6.5 `createObjectURL` has ONE exception: the generated output PDF, in `generate-pdf.ts`. See "PDF template and download".)
- Nothing goes into the URL or query string, no `localStorage`, `sessionStorage`, IndexedDB or cookies, no `console.*`, no `fetch`.

## Required notes

a) Several user-facing phrases are only true while the app is mocked and will stop being true when the CV is uploaded to the server in Phase 2: "Nothing leaves your browser in this version" (`src/app/page.tsx`) and "Ready. Nothing is uploaded yet." (helper text in `src/components/tailor-form.tsx`). Before changing any of them in Phase 2, search the code for "Nothing" and review every match (code comments and this wiki also contain the word; only the user-facing ones must change). ("Nothing was processed." of the old placeholder result page is gone.)

Added in Task 6, all to be reviewed or removed in Phase 2 (search the code for "sample" and "coming soon"):

- "Sample result: this is demo data, not based on your CV." (`demo-notice.tsx`) and the h1 "Sample result" plus its sub-line "A made-up example of the review screen, so you can try it out." (`app/result/page.tsx`). Remove when the result is real.
- "Preparing the sample result..." (`loading-state.tsx`) and "The sample result could not be loaded." (`error-state.tsx`), "How the sample CV matches the job" (`match-analysis.tsx`).
- ("Download is coming soon." is gone since Task 6.5: the buttons really download. Its replacement phrases are listed under "PDF template and download".)
- The invented person and company: Sam Placeholder, Sample Systems Ltd, Example Apps Inc, Demo Logistics, Senior Backend Engineer (sample) (all in `src/lib/mock/mock-data.ts`, shown in cards, preview, match list and letter).
- Cover letter texts, which come from the mock data (Phase 2 replaces it): the three button labels ("Answer", "I don't have this experience", "Skip"), the follow-up and general question texts, the three hint texts, the done messages "All questions answered" / "All questions done. N skipped; the letter leaves them out.", and the mock's letter frames ("On <topic>:", "I have not done this yet. The closest I have done:").
- The `?demo=error` switch in `result-view.tsx`: MUST be removed in Phase 2. It is already ignored when `NODE_ENV` is `production`.
- In Phase 2 the result is addressed by an id and stored server-side, so no state is passed through the URL (the page `/result` would become something like `/result/<id>`).

b) The folded corner, the notepad lines and the margin rule are CSS pseudo-elements and backgrounds. They are not part of the accessibility tree, so they carry no information for assistive technology and never carry meaning. (The error icon is an inline SVG and does have `aria-hidden`.)

c) The browser's character count can differ slightly from the server's: the server normalises the text (collapses blank lines, trims). The SERVER is authoritative and re-validates. At the exact boundary the browser may accept something the server rejects.

d) Finding for Task 6 / Phase 2: the file is not kept across navigation (`router.push` unmounts the form). In Phase 2 the file is uploaded to the server and the result is addressed by an id, so the file does not need to survive navigation. No client provider is built now.

e) Dark mode is deferred. The template's `prefers-color-scheme: dark` block was removed and `color-scheme: light` is set, so the page stays light even when the system is dark.

## Limitations

- Dropping a PDF outside the sheet makes the browser open the file and leave the page, because only the sheet handles drag and drop. Accepted for now.

## Result screen (Task 6, mocked)

Everything on `/result` is invented sample data from `@/lib/mock`. The page never implies the user's CV was analysed: h1 "Sample result", and a notice that is always visible.

### Layout

- 1024 px and up: match analysis full width; then two columns: change cards (left) and the sticky CV preview (right); then the cover letter in two columns (questions left, draft right).
- 360 px (and up to 1023 px): one column in this order: notice, heading, match analysis, review (counters, Download CV, cards), CV preview (open `<details>`), cover letter (questions, then draft). Long words wrap (`wrap-break-word`, `min-w-0`).
- Look: same chalk page, white sheets and cobalt as Task 5. The cards are rows of ONE sheet separated by faint rules (not a grid of identical shadowed cards); the "After" text has a cobalt left bar and the label "Before" / "After" in words. Sentence case everywhere, no numbered steps, no arrows.

### Files

```
src/app/result/page.tsx                 Server: notice, h1, Start over, Suspense(ResultView)
src/components/result/
  result-view.tsx          "use client": loads the mock (loading / error / ready); ReadyResult owns the review state
  review-reducer.ts        pure TS: reviewReducer, createInitialDecisions, countDecisions
  review-reducer.test.ts   node:test for the reducer and the counters
  demo-notice.tsx          the sticky notice (Server-safe, no hooks)
  loading-state.tsx        role="status" + skeleton
  error-state.tsx          role="alert" + Try again + link back
  match-analysis.tsx       requirements as two lists (Required, Nice to have) + count line
  status-badge.tsx         icon + word: Covered / Partly covered / Missing
  change-card.tsx          one change: Before, After, status line, Accept/Reject/Edit/Undo, inline edit
  cv-preview.tsx           applyChanges() result as a sheet; sticky region or open <details>
  use-media-query.ts       useSyncExternalStore around matchMedia
  cover-letter-panel.tsx   owns answers, draft, draftEdited rule, announcement, done message
  question-form.tsx        the current question: textarea, hint, buttons per kind
  conversation-list.tsx    read-only list of handled questions, follow-ups nested
  topic-text.ts            pure TS: displayTopic (one line, capped topic for display)
  topic-text.test.ts       node:test for displayTopic
  download-action.tsx      "use client": a download button with its status/alert messages (Task 6.5; replaced download-button.tsx)
src/components/pdf/        the fixed PDF template and the download logic (Task 6.5, see "PDF template and download" below)
```

### Review state model

`Decisions` = one record: change id -> `{ status: "pending" | "accepted" | "rejected", editedText? }`. All start pending. `reviewReducer` handles accept, reject, undo (back to pending, forgets the edit) and edit (status accepted plus the text). Unknown ids are ignored. The counters are NOT stored: `countDecisions(changes, decisions)` recomputes them on every render, so the visible counter, the screen reader announcement and the cards always agree. The preview is `applyChanges(originalCv, changes, decisions)`: accepted (edited text wins) and nothing else changes the CV; pending slots show the original text with a quiet italic "(pending)" mark (text, not colour).

Card status words: "Pending", "Accepted", "Edited and accepted", "Rejected". Buttons say which change they act on (`aria-label="Accept change 2: Experience, ..."`, visible text "Accept"). Accept, Reject and Edit stay in the page while pressed (a vanishing button would drop keyboard focus); only Undo appears and goes, and pressing it moves focus to Accept.

Inline edit: Edit opens a textarea (label "Edit the new text for change N", prefilled with the current text), focus moves into it, Save and Cancel return focus to the Edit button. The text is normalised by `normalizeEditedText(target, text)` (trim; in a bullet or skill, line breaks become single spaces; the summary keeps inner line breaks). The counter, the validation and the saved text all use that same normalised text, and the CV preview shows the saved text. `validateEditedText` (empty or too long) shows an icon + text message in an always-present `aria-live="polite"` region, sets `aria-invalid` and does not save. The counter "n / max" is not live. There is no `maxLength` attribute because it would silently cut pasted text.

A visually hidden `aria-live="polite"` paragraph announces e.g. "Change 2 accepted. 1 pending, 2 accepted, 0 rejected." If the same message repeats exactly (saving two edits in a row with the same counts) a screen reader may not repeat it; accepted for now.

### Cover letter state

Answers (`CoverLetterAnswers`: question id -> `answered` with text, `noExperience`, or `skipped`), the draft, `draftEdited`, a `proposed` draft, a status and a hidden announcement live in `CoverLetterPanel` state only. Which question is current and which are visible is NEVER decided in the component: it calls `getCurrentQuestion`, `getVisibleQuestions` and `summarizeAnswers` from `@/lib/result/question-flow` (pure, client-safe).

- **Three kinds.** `gap` (about a missing required requirement), `followUp` (optional, revealed only after "I don't have this experience" on its gap question), `general`. All are skippable.
- **Buttons.** gap: "Answer", "I don't have this experience", "Skip". followUp and general: "Answer" and "Skip". Every outcome (answered, no experience, skipped) requests a new mock draft; only the newest request may apply its result.
- **Accessible names use the topic.** Visible text stays short, the `aria-label` says which question it acts on: `Answer: <topic>`, `I don't have this experience: <topic>`, `Skip: <topic>`; for a follow-up `Answer the follow-up on <topic>` and `Skip the follow-up on <topic>`. The textarea label is the question text. Each label starts with its visible text (WCAG label in name).
- **Topic is plain text.** It is always rendered through normal JSX, never `dangerouslySetInnerHTML`. Why: in Phase 2 it derives from the untrusted job posting. Every place that shows a topic (the "Follow-up on ..." lines and all button `aria-label`s) goes through `displayTopic` (`topic-text.ts`): whitespace and line breaks become single spaces, the result is trimmed and cut to `COVER_LETTER_TOPIC_MAX_CHARS` code points INCLUDING the "…" (an emoji counts as one and is never split; a multi-code-point emoji such as a family emoji could still be cut between its parts, accepted).
- **Phase 2 checklist:** validate the model's topic (`isValidTopic`) or truncate it before it reaches the UI. `displayTopic` is only the last safety net at render time.
- **Hints.** gap: "No experience with this? Say so and we'll ask one optional follow-up. Skip leaves it out of the letter." followUp and general: "Optional. Skip leaves it out of the letter."
- **Blank answer.** "Answer" with blank text shows the inline message "Write an answer, or use Skip." and does not advance (the flow helpers would otherwise count a blank text as answered).
- **Follow-up reveal.** The follow-up is a new current question, so its form mounts with a context line "Follow-up on <topic>". Focus moves to its textarea (focus-on-mount only after the user has acted, never on first load) and an always-present `aria-live="polite"` visually hidden paragraph says "One optional follow-up question added."
- **Conversation list.** A semantic `<ul>` of the handled questions (visible minus current), in order: the question and its outcome (the answer text, "I don't have this experience", or "Skipped"). A follow-up is indented with a left bar and carries the words "Follow-up on <topic>", so nesting is not colour alone.
- **Done message.** A heading with `tabIndex={-1}` that receives focus when the last question is done. If `summarizeAnswers(...).skipped` is 0: "All questions answered". Otherwise "All questions done. N skipped; the letter leaves them out." ("no experience" counts as answered; a skipped follow-up counts as skipped).
- **Draft.** If the user has edited the draft by hand (`draftEdited`), the new draft is NOT applied: the status says "An updated draft is ready. Your edits were kept." and a "Replace with updated draft" button applies it and clears the flag (focus goes to the draft). A failed draft call shows a `role="alert"` message and "Try again". A skipped question adds nothing to the letter, so no experience is invented.

### Sticky notice, zoom and focus

The notice ("Sample result: this is demo data, not based on your CV.") is a `role="note"` block with a `<p>` (not an alert: it is not an error). It is compact: icon, one or two lines, `py-2`. It is sticky (`.demo-notice` in `globals.css`). To avoid hiding the focused element (WCAG 2.2 focus not obscured), `html { scroll-padding-top: 6rem }` makes the browser leave room above anything it scrolls into view. On short viewports (`max-height: 30rem`, e.g. a laptop at 400% zoom) the notice becomes `position: static` and the padding is 0, because a sticky bar would take too much of the screen; the text is still at the top of the page.

### CV preview

At 1024 px and up (`useMediaQuery`): a region box that is sticky only when the viewport is ALSO at least `40rem` tall (CSS classes `.cv-preview-sticky` and `.cv-preview-box` in `globals.css`): `top: 6rem` (same as `scroll-padding-top`), `max-height: max(20rem, 100vh - 9rem)` and inner scroll. Offsets are rem so they grow with text zoom. In a shorter viewport (a short window, or large text zoom, where a taller notice could cover a sticky preview) it is a normal block that scrolls with the page, without inner scroll. Because it can scroll, it is a keyboard stop: `role="region"`, `aria-label="CV preview"`, `tabIndex={0}`, with the global focus ring. Below 1024 px: an open `<details>` with the summary "CV preview" and no inner scroll. Only one preview is in the DOM; the wrapper changes, not the content. Because the wrapper changes when the window is resized across 1024 px, the preview remounts (it has no state of its own, so nothing is lost).

### Loading and error

Loading: `ResultView` always renders ONE persistent `role="status"` paragraph (`aria-live="polite"`) and only changes its text: "Preparing the sample result..." (visible while loading), then "Sample result ready." (visually hidden). It is never recreated, because screen readers announce changes in an existing live region. The skeleton is `aria-hidden`; the pulse is `animate-pulse`, switched off by the global `prefers-reduced-motion` rule. The Suspense fallback (first render, before hydration) is the same skeleton plus the message as plain text without a role: there is no live region yet, so screen readers find the text when reading the page but may not announce it. Error: `role="alert"`, icon + "The sample result could not be loaded.", a "Try again" button and a link back to `/`. Focus after "Try again": the button disappears, so focus parks on the small status paragraph (explicit `focus:` ring, so it shows after a mouse click too). When the load finishes, focus moves to the new state's `data-focus-target` (the error box, or the "How the sample CV matches the job" heading), but only if it is still on the status paragraph, so it never falls to `<body>` and the first load never steals focus. No ring is drawn around the whole result. `/result?demo=error` makes the mock fail so this screen can be seen; it is ignored when `NODE_ENV` is `production` (compiled into the build) and must be removed in Phase 2.

### New colours (measured with a WCAG 2.x script outside the repo)

| Token         | Hex       | Use                                  |
| ------------- | --------- | ------------------------------------ |
| covered       | `#17622F` | "Covered" text, icon, border; accepted status |
| covered-bg    | `#E1F1E4` | "Covered" badge background           |
| partial       | `#7A4A00` | "Partly covered" text, icon, border  |
| partial-bg    | `#FCEFD0` | "Partly covered" badge background    |
| missing-bg    | `#F9E6E4` | "Missing" badge background (text and icon use brick) |

| Pair                          | Ratio | Needed | Result  |
| ----------------------------- | ----- | ------ | ------- |
| covered on covered-bg         | 6.34  | 4.5    | AA pass |
| covered on paper (status line)| 7.43  | 4.5    | AA pass |
| partial on partial-bg         | 6.55  | 4.5    | AA pass |
| partial on paper              | 7.48  | 4.5    | AA pass |
| brick on missing-bg           | 5.44  | 4.5    | AA pass |
| brick on paper (rejected)     | 6.54  | 4.5    | AA pass |
| covered on chalk              | 6.52  | 4.5    | AA pass |
| partial on chalk              | 6.57  | 4.5    | AA pass |

Icons and badge borders use the text colour, so they have the same ratios (needed 3, all pass). The badge background tints are about 1.2:1 against paper on purpose: the border, icon and word carry the meaning, never the tint.

### Accessibility decisions

- Visible labels for every field; visible cobalt focus ring (global `:focus-visible`); every action works with the keyboard; buttons at least 44 px high; text at least 16 px; no `maxLength` truncation.
- Status never by colour alone: icon (aria-hidden) plus word for requirements and for change status.
- Live regions that always exist: the decision announcement, the edit error message, the question error message, the draft status. Loading uses `role="status"`, load and draft errors use `role="alert"`.
- Each change card is `role="group"` labelled by its heading. One `h1`, each area is a `<section>` with `aria-labelledby` and its own `h2`.
- Reduced motion: global rule turns off all transitions and animations (skeleton pulse included). There is no smooth scrolling.
- Mobile preview `<details>` is open by default; the headings inside the preview start at `h4`, so on narrow screens the outline skips `h3` there. Accepted.

### Privacy for the result screen

No fetch, no API route, no database, no `console.*`, no `localStorage`, `sessionStorage`, IndexedDB or cookies, nothing in the URL except the optional `?demo=error`. Cover letter answers are free text and may be personal data: they stay in React state only. The mock never receives the user's CV or job text.

### Not verified in the Task 6 review fixes

No browser was used. NOT checked: the visible focus ring on the status message after "Try again" (keyboard and mouse), focus moving to the error box or the first heading afterwards, a screen reader announcing "Preparing the sample result..." and "Sample result ready.", what a screen reader gets from the Suspense fallback, the preview becoming non-sticky below 40rem tall or at large text zoom, an edit with trailing spaces or line breaks, and a long topic (it needs a temporary edit of the mock).

### Not verified in Task 6 extension step 2

No browser was used. NOT checked: the follow-up reveal and the focus move into its textarea, the screen reader announcement (it may be cut short by the focus move; accepted), the nested list layout, the done message focus, the blank-answer message, the draft showing the "not yet" paragraph, and keyboard-only flow. Only types, lint, format, build, tests, the served HTML and code greps were checked.

### Not verified in Task 6

No browser tool was available, so these were NOT checked in a real browser: visual layout at 360 px and 1280 px, horizontal scroll, keyboard-only flow and focus movement, focus not obscured by the sticky bar and the non-sticky switch at high zoom, the sticky preview and its inner scroll, screen reader announcements, reduced motion, the `<details>` / region swap at 1024 px, and a real `next start` check of the `?demo=error` production rule (only the code and the build were checked). The mock failing path for the draft cannot be triggered (the mock never fails). Do these manually (see the task report).

## Not verified in Task 5

Not verified: layout between 768 and 1024 px with long file names.

No browser tool was available, so the visual result, keyboard flow, drag and drop and reduced motion were not checked in a real browser. Only HTML output, build, lint, tests and contrast numbers were checked. Do this manually (see the task report).

## PDF template and download (Task 6.5)

"Download CV" and "Download letter" on `/result` now build a real PDF in the browser and download it. Nothing is uploaded, no API route is called, nothing is stored or logged. The data is still the invented sample data.

### What gets downloaded

- **CV** (`cv-tailored.pdf`): `applyChanges(originalCv, changes, decisions)`, exactly what the preview shows (accepted and edited changes applied, pending and rejected keep the original text).
- **Letter** (`cover-letter.pdf`): the CURRENT text of the draft textarea (what the user sees), with the contact data of the sample CV (`data.originalCv.contact`, passed to `CoverLetterPanel` as the `contact` prop; mock only) for the header.

### Files

```
src/components/pdf/
  package.json               {"type": "module"}: see "Tests" below (why this file is here)
  pdf-styles.ts              page size, margins, colours, StyleSheet, hyphenation switched off (react-pdf)
  cv-document.tsx            CvDocument: the fixed CV template (react-pdf); also ContactHeader and PageCounter
  letter-document.tsx        LetterDocument: the cover letter, same header and typography
  supported-characters.ts    pure TS: which characters Helvetica can show, the checks, the message text
  generate-pdf.ts            the ONLY file that loads react-pdf (lazy) and uses URL.createObjectURL
  *.test.ts                  supported-characters.test.ts, pdf-render.test.ts, pdf-isolation.test.ts
src/components/result/download-action.tsx   the button + messages used for both documents
```

### States of a download button

| State | What the user sees | Notes |
| --- | --- | --- |
| idle | the button | |
| checking | nothing visible | Instant and synchronous: the characters are checked BEFORE react-pdf is loaded. |
| unsupported characters | `role="alert"` error naming the characters and sections | Nothing is generated or downloaded. |
| preparing | "Preparing your PDF..." in the polite status line; the button is `aria-disabled` and `aria-busy` | A second click does nothing (a ref stops it, because `aria-disabled` alone does not block clicks). Focus stays on the button. |
| error | `role="alert"`: "The PDF could not be created. Nothing was downloaded. Try again." | A broken file is never downloaded. The error object is never shown or logged. |
| long-document warning | status text "This CV is 3 pages long. Most employers expect one or two. Nothing was cut." plus buttons "Download anyway" and "Keep editing" | CV: 3 or more pages. Letter: more than 1 page. Nothing is cut or shrunk. |
| done | "CV downloaded." / "Letter downloaded." in the status line | |

Messages sit right under the button that caused them. Two live regions per button are ALWAYS in the page and only their content changes (screen readers announce changes in an existing live region, not new elements): `role="status"` (progress, warning, confirmation) and `role="alert"` (errors). The button points at both with `aria-describedby`.

**Focus.** Focus is never moved by force: it stays on the Download button while generating. When the warning appears, its two buttons are the very next tab stops, and the warning text is announced by the status region, so no focus jump (and no trap) is needed. "Download anyway" and "Keep editing" disappear when pressed, so each puts focus back on the Download button (otherwise it would fall to `<body>`).

**Stale results.** The state belongs to one version of the content (`contentKey`: the review decisions for the CV, the draft text for the letter). If the content changes, an old warning or error is hidden, and a file that finishes after a change is dropped without downloading. So "Download anyway" can never download content that no longer matches the screen.

**"Download anyway" reuses the blob** that was already generated; it does not render the PDF again.

### The template

One fixed design, A4, 18 mm margins, Helvetica. Single column.

```
+--------------------------------------------------+
|  Sam Placeholder                      (20 pt, bold, cobalt)
|  email | phone | location | links    (one line, only the items that exist)
|  ----------------------------------   (thin cobalt rule)
|
|  Summary                              (12 pt bold, fixed English headings)
|  Two or three lines of text.
|
|  Experience
|  Backend Engineer, Sample Systems Ltd (bold)
|  Sampletown | 2021-03 - Present
|  •  Built a REST API used by three internal teams.
|  •  Moved the order database to PostgreSQL.
|
|  Education     (degree, field / institution | dates)
|  Skills        (one comma-separated line)
|  Projects      (name, description, "Technologies: ...", url)
|  Languages     (English (Native), ...)
+--------------------------------------------------+
```

- Order: Summary, Experience, Education, Skills, Projects, Languages. A section with no content is left out completely: no heading without content, no label without a value, no empty separators (a missing phone leaves no " |" behind).
- Dates: "start - end"; "Present" when `isCurrent`. Links are printed as plain text, not as clickable annotations.
- Page: no images, no tables, no columns, no icons, no page numbers, no header or footer. Colours: name and rule in the app's cobalt, text in the app's ink.
- Metadata: title "CV" (letter: "Cover letter"), language "en-GB", no author, subject or keywords. (react-pdf itself writes "react-pdf" as producer and creator, and a creation date; nothing personal.)
- **Section headings are in English on purpose** (the target market is UK jobs), whatever the language of the CV text.
- **Cover letter:** the same header and fonts, one A4 page. A blank line starts a new paragraph; a single line break inside a paragraph is KEPT as a line break (people type "Kind regards," and the name on the next line). If it is longer than one page it flows to a second page and the screen warns.

### Concept: how react-pdf lays out a page

- A document is made of `<Document>` > `<Page>` > `<View>` and `<Text>`. `<Page>` is a sheet of paper, `<View>` a box (like a `div`), `<Text>` holds text. Text must be inside a `<Text>`.
- Styles look like CSS but the unit is the POINT (1/72 inch), not the pixel. A4 is 595 x 842 pt, so the 18 mm margins are about 51 pt.
- Layout is flexbox, and the default direction is a column: boxes stack from top to bottom. A bullet is a row (`flexDirection: "row"`): a narrow column for the "•" and a column with `flex: 1` for the text, so a long bullet wraps under its own text.
- **Automatic page breaks:** when content does not fit, react-pdf continues on a new page. A box with `wrap={false}` is never split across two pages (we use it only on small blocks: an experience title with its dates and first bullet, an education entry). It must not be put on tall blocks: a block taller than a page cannot be placed, and content can disappear. `minPresenceAhead` on a heading moves it to the next page if less than 40 pt would follow it.
- A `fixed` element is repeated on every page. Its `render` function receives `{ pageNumber, totalPages }`. We use that to learn the page count (see below).

### Concept: why a fixed template is predictable

The data (a JSON `Cv`) and the layout are separate. The LLM (Phase 2) only changes the data; it never decides fonts, margins or order. So the layout is written, tested and checked ONCE, and every CV goes through the same code: the same headings in the same order, the same fonts, a known length per line. The alternative (a model that writes the layout for each CV) would give a different, unchecked file each time, which can break the reading order for an ATS, overflow the page or use fonts the reader does not have.

### Concept: what makes a CV readable by an ATS

An ATS (applicant tracking system) extracts the text of the PDF and tries to sort it into fields. It helps it when:

- **Real text.** Selectable text, not a picture of text (a scanned or image-based CV has nothing to extract). The template draws only text.
- **Single column.** Text is read in the order it is drawn. Two columns or a sidebar can be read line by line across both columns and mix up the sections.
- **Standard fonts.** Helvetica is a standard PDF font, so every reader has it and the characters map to real text.
- **Standard headings.** "Summary", "Experience", "Education", "Skills" are words an ATS looks for. Creative names ("My journey") are not understood.
- **No tables, images or icons.** Tables can be read cell by cell in a strange order. Icons (a phone symbol) can come out as odd characters. Text inside images is invisible.
- **Reading order.** The order in the file is the reading order: name, contact, summary, then each job with its title before its bullets. The tests assert this order on the extracted text.
- **No headers or footers.** Some systems drop them, and the contact details would be lost.

### Characters: what works and what happens otherwise

The PDF uses Helvetica, a standard PDF font built into every reader (nothing is embedded, so files stay small). Helvetica only has the Western European alphabet. Results from probing react-pdf 4.9.0:

- Works and reads back correctly: printable ASCII; Latin-1 (é ñ ü ç ß å ø æ ...); the Windows-1252 punctuation (– — “ ” ‘ ’ … • € £ and friends). The supported set is U+0020-U+007E, U+00A0-U+00FF and the Windows-1252 extras, MINUS the micro sign (see below). Every one of them is rendered and read back in `pdf-render.test.ts`.
- **Fails SILENTLY:** Latin Extended (ł ő ř ş ź), Cyrillic, Greek, CJK and emoji. react-pdf shows no warning; it draws a wrong character ("Łódź" came out as "Aódz", "Привет" as "@825B"). A CV with a wrong name is worse than no CV, so the template cannot be trusted to fail by itself.
- So BEFORE generating, `findUnsupportedCharacters` / `checkCvCharacters` / `checkLetterCharacters` look at every text field (by code point, so an emoji is one character) and the download is blocked with a message that names the section and the characters, for example "These characters can't be shown in the PDF: ł, ź (Summary); Ж (Experience). Remove or replace them to download." At most 10 characters per section are listed ("and N more"). Invisible characters are named by code (U+200B). There is NO automatic replacement (ł to l): it would change a person's name without asking.
- Found by the round-trip test: the micro sign "µ" (U+00B5) is drawn correctly but extracted as the Greek letter "μ" (U+03BC), so it is NOT in the supported set (the user is asked to replace it).
- Normalised, not blocked: a non-breaking space (U+00A0) becomes a normal space and a soft hyphen (U+00AD) is removed, because readers do not return them unchanged.
- Whitespace: line breaks (`\n`, `\r`) and tabs are not reported. In a one-line field (title, bullet, skill...) any run of whitespace becomes one space; in the summary and the letter line breaks are kept and tabs become spaces.
- Hyphenation is switched off (`Font.registerHyphenationCallback`): by default react-pdf breaks long words ("expi-" / "alidocious"), which cuts one word in two in the extracted text. A word wider than a whole line may still be broken by the layout at the line end; that is a hard limit, not hyphenation.

**KNOWN LIMITATION (dead end).** A person whose name contains an unsupported character (for example "Łukasz") cannot download a PDF: the check blocks it and there is no screen where the name can be edited yet (the review screen only edits the suggested changes). It stays like this until a full CV editing screen exists. **Phase 2 path:** embed a Unicode font such as Noto Sans (SIL Open Font License) with `Font.register`; then the Latin Extended and Cyrillic alphabets work and the check shrinks to "characters the font does not have". CJK and emoji need other fonts.

### The page count

Both documents contain a `fixed` `<Text>` whose `render` receives `totalPages` and calls `onPageCount`. It returns an empty string and is `position: absolute`, so it adds no text and takes no space (a test compares the extracted text with and without it). Why not count `/Type /Page` in the bytes: that is a guess about the file format, it breaks on compressed object streams, and it would count a different thing than the layout did. The test also checks the callback equals the number of pages the loader reads back. If the callback never reports (page count 0), generation is treated as failed (loud failure instead of a hidden warning).

### Lazy loading

`generate-pdf.ts` loads react-pdf and the two document modules with `await import(...)` inside the functions. Next.js (Turbopack) puts a dynamically imported module and its dependencies in their own chunks, fetched when first needed, so the initial JavaScript of `/result` does not carry the PDF library (it is large). `generate-pdf.ts` itself is small and is imported statically. `src/components/result/` never imports react-pdf, the documents or the styles.

### `URL.createObjectURL` exception

The Task 5 rule "never `createObjectURL`" was about the uploaded input file, which is never read, and it stays. The ONE exception is `downloadPdf` in `generate-pdf.ts`: it creates an object URL for the PDF WE generated, clicks a temporary hidden link, and revokes the URL one second later (`revokeObjectURL`). It is not revoked in the same line because `click()` only asks the browser to start the download and some browsers read the address a moment later. A test checks that `createObjectURL` appears in no other file of `src/components/pdf` or `src/components/result`.

### Tests

`npm test` now includes three files in `src/components/pdf/`. They render real PDFs (`renderToBuffer`) and read them back with the project's own loader (`loadPdf`), using invented data only. Because react-pdf and its hyphenation package are ES modules, tsx must load them as ES modules, and tsx follows the nearest `package.json`: that is why `src/components/pdf/package.json` contains `{"type": "module"}` (without it the import fails with "Package subpath './en-us' is not defined by exports"). Test files are `.ts` (no JSX): they call `CvDocument({ ... })` as a function. The component functions use no hooks, so calling them directly is fine.

### Phase 2 review list (new user-facing phrases, Task 6.5)

Review or remove together with the other sample phrases:

- File names: `cv-tailored.pdf`, `cover-letter.pdf`.
- Progress: "Preparing your PDF..."
- Confirmations: "CV downloaded.", "Letter downloaded."
- Error: "The PDF could not be created. Nothing was downloaded. Try again."
- Unsupported characters: "These characters can't be shown in the PDF: ... Remove or replace them to download." (the section names Contact, Summary, Experience, Education, Skills, Projects, Languages and Cover letter are shown to the user).
- Long document: "This CV is N pages long. Most employers expect one or two. Nothing was cut." and "This letter is N pages long. A cover letter usually fits on one page. Nothing was cut."; buttons "Download anyway" and "Keep editing".
- The fixed English section headings in the PDF (deliberate, see `decisions.md`) and the PDF titles "CV" and "Cover letter".

### Not verified in Task 6.5

No browser was used. NOT checked: how the PDF looks in Acrobat, Chrome, Firefox and macOS Preview; the Next.js / Turbopack build of the dynamic imports and that react-pdf stays out of the initial chunks (commands in the task report); the real browser download and the file name; screen reader announcements of the status and alert regions; the visual layout of the buttons and messages (long messages at 360 px, the warning box); keyboard flow and focus return after "Download anyway" / "Keep editing"; text selection and copy in each reader. Checked by tests: text extraction, reading order, empty fields, character round trip, hyphenation, page count, metadata, isolation.
