"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMockResult } from "@/lib/mock";
import type { MockResult } from "@/lib/mock";
import { ChangeCard } from "./change-card";
import { CoverLetterPanel } from "./cover-letter-panel";
import { CvPreview } from "./cv-preview";
import { DownloadButton } from "./download-button";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";
import { MatchAnalysis } from "./match-analysis";
import {
  countDecisions,
  createInitialDecisions,
  reviewReducer,
} from "./review-reducer";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: MockResult };

// The part that is shown once the result is ready. The review state (one decision per
// change) lives here and is created from the loaded data.
function ReadyResult({ data }: { data: MockResult }) {
  const { changes } = data;
  const [decisions, dispatch] = useReducer(
    reviewReducer,
    changes,
    createInitialDecisions,
  );
  // What happened last, e.g. "Change 2 accepted". The numbers after it are derived.
  const [lastEvent, setLastEvent] = useState("");

  // Counters are calculated from the decisions every render, never stored.
  const counts = countDecisions(changes, decisions);
  const summary = `${counts.pending} pending, ${counts.accepted} accepted, ${counts.rejected} rejected`;

  function announce(index: number, what: string) {
    setLastEvent(`Change ${index + 1} ${what}.`);
  }

  return (
    <div className="mt-8 flex flex-col gap-14">
      <MatchAnalysis items={data.match.items} />

      <section aria-labelledby="review-heading">
        <h2
          id="review-heading"
          className="font-heading text-3xl font-semibold tracking-tight"
        >
          Review the suggested changes
        </h2>
        <p className="mt-2 max-w-[60ch] text-lg">
          Accept, reject or edit each change. The CV preview updates as you
          decide.
        </p>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <p className="text-lg font-medium">{summary}</p>
          <DownloadButton id="download-cv" label="Download CV" />
        </div>
        {/* Screen reader announcement; the visible counter above is not live. */}
        <p aria-live="polite" className="sr-only">
          {lastEvent && `${lastEvent} ${summary}.`}
        </p>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2">
          <ul className="min-w-0 divide-y divide-fold border-y-2 border-edge bg-paper">
            {changes.map((change, index) => (
              <li key={change.id}>
                <ChangeCard
                  change={change}
                  number={index + 1}
                  total={changes.length}
                  decision={decisions[change.id]}
                  onAccept={() => {
                    dispatch({ type: "accept", id: change.id });
                    announce(index, "accepted");
                  }}
                  onReject={() => {
                    dispatch({ type: "reject", id: change.id });
                    announce(index, "rejected");
                  }}
                  onUndo={() => {
                    dispatch({ type: "undo", id: change.id });
                    announce(index, "set back to pending");
                  }}
                  onEdit={(text) => {
                    dispatch({ type: "edit", id: change.id, text });
                    announce(index, "edited and accepted");
                  }}
                />
              </li>
            ))}
          </ul>
          <CvPreview
            originalCv={data.originalCv}
            changes={changes}
            decisions={decisions}
          />
        </div>
      </section>

      <CoverLetterPanel
        questions={data.questions}
        initialDraft={data.initialDraft}
      />
    </div>
  );
}

export function ResultView() {
  const searchParams = useSearchParams();
  // Demo switch, only to look at the error screen. REMOVE IN PHASE 2. It is ignored in a
  // production build, so a real user can never be shown a fake error. It carries no user data.
  const forceError =
    process.env.NODE_ENV !== "production" &&
    searchParams.get("demo") === "error";

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  // Focus after "Try again". The button disappears, so focus would fall to <body>.
  // 1) retry() parks focus on the small status message (not on a box around everything,
  //    which would draw a giant ring). It is always mounted, so it is never replaced.
  // 2) When the load finishes, the status text is no longer a good place to be, so focus
  //    moves to the new state's own target (the error box or the first heading). We do it
  //    ONLY if focus is still parked on the status: if the user went elsewhere, or this is
  //    the first load, we never steal focus.
  useEffect(() => {
    if (state.status === "loading") return;
    if (document.activeElement !== statusRef.current) return;
    boxRef.current?.querySelector<HTMLElement>("[data-focus-target]")?.focus();
  }, [state.status]);

  useEffect(() => {
    // React's development mode runs effects twice, and "Try again" starts a new load.
    // `cancelled` makes sure only the latest call may change the state.
    let cancelled = false;
    getMockResult(undefined, { fail: forceError }).then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", data: result.value }
          : { status: "error" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, forceError]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
    // The Try again button disappears, so park focus on the status message (see above).
    statusRef.current?.focus();
  }

  // The text of the live region. Only the text changes; the element stays mounted, which is
  // what makes screen readers announce the change. The error has its own role="alert".
  const statusText =
    state.status === "loading"
      ? "Preparing the sample result..."
      : state.status === "ready"
        ? "Sample result ready."
        : "";

  return (
    <div ref={boxRef}>
      {/* Visible while loading (it is the loading message), visually hidden afterwards.
          The focus ring is explicit (focus:, not only :focus-visible) so it also shows after
          a mouse click on Try again. */}
      <p
        ref={statusRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={
          state.status === "loading"
            ? "mt-8 w-fit text-lg font-medium focus:outline-3 focus:outline-offset-2 focus:outline-cobalt"
            : "sr-only"
        }
      >
        {statusText}
      </p>
      {state.status === "loading" && <LoadingState showMessage={false} />}
      {state.status === "error" && <ErrorState onRetry={retry} />}
      {state.status === "ready" && <ReadyResult data={state.data} />}
    </div>
  );
}
