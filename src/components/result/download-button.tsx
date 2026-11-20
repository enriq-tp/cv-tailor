// A download button that does nothing yet (downloads come in a later task).
// aria-disabled, not `disabled`: the button stays reachable with the keyboard and a screen
// reader reads it and its note. It never navigates or downloads. The note is ALWAYS in the
// page and linked with aria-describedby.
export function DownloadButton({ id, label }: { id: string; label: string }) {
  return (
    <div>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={`${id}-note`}
        onClick={(e) => e.preventDefault()}
        className="min-h-11 cursor-not-allowed rounded-md bg-disabled px-6 font-medium text-slate"
      >
        {label}
      </button>
      <p id={`${id}-note`} className="mt-1 text-slate">
        Download is coming soon.
      </p>
    </div>
  );
}
