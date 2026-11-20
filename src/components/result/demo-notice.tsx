// Always on screen (loading, error and ready): the page must never suggest that the
// user's CV was analysed. Server Component: it is static text, so it is in the first HTML.
// Sticky behaviour (and the zoom / focus handling) is in globals.css under ".demo-notice".
// A note, not an alert: it is not an error and must not interrupt a screen reader.
export function DemoNotice() {
  return (
    <div
      role="note"
      className="demo-notice border-b-2 border-cobalt bg-paper px-4 py-2 md:px-8"
    >
      <p className="mx-auto flex max-w-6xl items-start gap-2 font-medium">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="mt-[3px] size-[18px] shrink-0 text-cobalt"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="10" cy="10" r="8" />
          <path d="M10 9v5.5M10 5.8v.1" />
        </svg>
        <span>Sample result: this is demo data, not based on your CV.</span>
      </p>
    </div>
  );
}
