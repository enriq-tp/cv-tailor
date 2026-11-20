import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DemoNotice } from "@/components/result/demo-notice";
import { LoadingState } from "@/components/result/loading-state";
import { ResultView } from "@/components/result/result-view";

// Each page gets its own title so screen reader users know where they are.
export const metadata: Metadata = {
  title: "Result - CV Tailor",
};

// Server Component: the notice, the heading and the link are static, so they are in the
// first HTML. ResultView is a Client Component (state, effects, useSearchParams).
// useSearchParams needs a Suspense boundary; the loading UI is the fallback.
// This page is independent of what was entered on the first page (a mock, on purpose).
export default function ResultPage() {
  return (
    <>
      <DemoNotice />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6">
          <p className="font-heading text-xl font-semibold">CV Tailor</p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-4"
          >
            Start over
          </Link>
        </div>
        <h1 className="mt-4 font-heading text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
          Sample result
        </h1>
        <p className="mt-3 max-w-[60ch] text-lg text-slate">
          A made-up example of the review screen, so you can try it out.
        </p>
        <Suspense fallback={<LoadingState />}>
          <ResultView />
        </Suspense>
      </main>
    </>
  );
}
