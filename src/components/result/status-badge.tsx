import type { RequirementStatus } from "@/lib/mock";

// Icon + word, never colour alone. The icons are decorative (aria-hidden): the word says it.
const BADGES: Record<
  RequirementStatus,
  { word: string; className: string; icon: React.ReactNode }
> = {
  covered: {
    word: "Covered",
    className: "border-covered bg-covered-bg text-covered",
    icon: <path d="M4.5 10.5l3.5 3.5 7.5-8" />, // check mark
  },
  partial: {
    word: "Partly covered",
    className: "border-partial bg-partial-bg text-partial",
    icon: <path d="M5 10h10" />, // dash: half way
  },
  missing: {
    word: "Missing",
    className: "border-brick bg-missing-bg text-brick",
    icon: <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />, // cross
  },
};

export function StatusBadge({ status }: { status: RequirementStatus }) {
  const badge = BADGES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-medium ${badge.className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-[18px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {badge.icon}
      </svg>
      {badge.word}
    </span>
  );
}
