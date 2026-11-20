import type { Metadata } from "next";
import Link from "next/link";

// Each page gets its own title so screen reader users know where they are.
export const metadata: Metadata = {
  title: "Result - CV Tailor",
};

// Placeholder: the real result screen is Task 6.
export default function ResultPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8 md:py-12">
      <p className="font-heading text-xl font-semibold">CV Tailor</p>
      <h1 className="mt-10 font-heading text-4xl leading-tight font-semibold tracking-tight">
        Result
      </h1>
      <p className="mt-4 max-w-[60ch] text-lg text-slate">
        The result screen comes in Task 6. Nothing was processed.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-4"
      >
        Back to the start
      </Link>
    </main>
  );
}
