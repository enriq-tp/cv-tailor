// Loading UI: a polite status message plus a grey sketch of the final layout.
// Used both as the Suspense fallback (page.tsx) and while the mock "thinks" (ResultView).
// The pulse is `animate-pulse`; globals.css switches every animation off for people who
// prefer reduced motion.
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-sm bg-fold ${className}`} />;
}

// showMessage:
// - Suspense fallback (page.tsx): true. The page is still plain HTML before hydration, so
//   screen readers just find this text when they read the page; it is not a live announcement
//   (there is no live region yet, and one created together with its text is often not spoken).
// - Inside ResultView: false. There the message lives in ResultView's persistent live region,
//   and this component only draws the skeleton.
export function LoadingState({
  showMessage = true,
}: {
  showMessage?: boolean;
}) {
  return (
    <div className={showMessage ? "mt-8" : "mt-6"}>
      {showMessage && (
        <p className="text-lg font-medium">Preparing the sample result...</p>
      )}
      {/* The sketch is decoration: hidden from screen readers. */}
      <div
        aria-hidden="true"
        className={`${showMessage ? "mt-6" : ""} space-y-10`}
      >
        <div className="space-y-3">
          <Bar className="h-7 w-48" />
          <Bar className="h-12 w-full" />
          <Bar className="h-12 w-full" />
          <Bar className="h-12 w-5/6" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Bar className="h-7 w-56" />
            <Bar className="h-40 w-full" />
            <Bar className="h-40 w-full" />
          </div>
          <Bar className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
}
