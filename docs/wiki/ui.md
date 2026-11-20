# UI (Task 5: input screen, mocked)

Status: the home page `/` has the input screen (CV drop zone, job posting notepad, "Tailor my CV" button). Nothing is processed: a valid form navigates to the placeholder `/result` (the real result screen is Task 6).

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
src/app/result/page.tsx    placeholder "Result - CV Tailor" with a link back (Server)
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

- The CV file and the pasted text stay in React state only. The file's content is never read (no `FileReader`, `arrayBuffer`, `text()`, `createObjectURL`). Only name and size are shown.
- Nothing goes into the URL or query string, no `localStorage`, `sessionStorage`, IndexedDB or cookies, no `console.*`, no `fetch`.

## Required notes

a) Several user-facing phrases are only true while the app is mocked and will stop being true when the CV is uploaded to the server in Phase 2: "Nothing leaves your browser in this version" (`src/app/page.tsx`), "Ready. Nothing is uploaded yet." (helper text in `src/components/tailor-form.tsx`) and "Nothing was processed." (`src/app/result/page.tsx`). Before changing any of them in Phase 2, search the code for "Nothing" and review every match (code comments and this wiki also contain the word; only the user-facing ones must change).

b) The folded corner, the notepad lines and the margin rule are CSS pseudo-elements and backgrounds. They are not part of the accessibility tree, so they carry no information for assistive technology and never carry meaning. (The error icon is an inline SVG and does have `aria-hidden`.)

c) The browser's character count can differ slightly from the server's: the server normalises the text (collapses blank lines, trims). The SERVER is authoritative and re-validates. At the exact boundary the browser may accept something the server rejects.

d) Finding for Task 6 / Phase 2: the file is not kept across navigation (`router.push` unmounts the form). In Phase 2 the file is uploaded to the server and the result is addressed by an id, so the file does not need to survive navigation. No client provider is built now.

e) Dark mode is deferred. The template's `prefers-color-scheme: dark` block was removed and `color-scheme: light` is set, so the page stays light even when the system is dark.

## Limitations

- Dropping a PDF outside the sheet makes the browser open the file and leave the page, because only the sheet handles drag and drop. Accepted for now.

## Not verified in Task 5

Not verified: layout between 768 and 1024 px with long file names.

No browser tool was available, so the visual result, keyboard flow, drag and drop and reduced motion were not checked in a real browser. Only HTML output, build, lint, tests and contrast numbers were checked. Do this manually (see the task report).
