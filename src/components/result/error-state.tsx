import Link from "next/link";
import { FieldError } from "../field-error";

// Plain message, no details: error messages must never contain user data.
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      // ResultView moves focus here after "Try again" fails again (see its comment).
      // It is small, so a ring around it is fine; focus: (not only focus-visible) so the
      // ring also shows after a mouse click.
      data-focus-target
      tabIndex={-1}
      className="mt-8 max-w-[60ch] border-2 border-edge bg-paper p-5 focus:outline-3 focus:outline-offset-2 focus:outline-cobalt"
    >
      <FieldError>The sample result could not be loaded.</FieldError>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-md bg-cobalt px-6 font-medium text-paper transition-colors hover:bg-cobalt-dark"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-4"
        >
          Back to the start
        </Link>
      </div>
    </div>
  );
}
