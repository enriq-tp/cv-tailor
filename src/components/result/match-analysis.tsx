import type { MatchItem } from "@/lib/mock";
import { StatusBadge } from "./status-badge";

function countByStatus(items: MatchItem[]) {
  return {
    covered: items.filter((i) => i.status === "covered").length,
    partial: items.filter((i) => i.status === "partial").length,
    missing: items.filter((i) => i.status === "missing").length,
  };
}

// One group of requirements as a real list: requirement, badge, short reason.
function RequirementList({
  title,
  items,
}: {
  title: string;
  items: MatchItem[];
}) {
  return (
    <div>
      <h3 className="font-heading text-xl font-semibold">{title}</h3>
      <ul className="mt-2 divide-y divide-fold border-y-2 border-edge bg-paper">
        {items.map((item) => (
          <li
            key={item.id}
            className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)] md:items-start md:gap-6"
          >
            <p className="font-medium wrap-break-word">{item.requirement}</p>
            <p>
              <StatusBadge status={item.status} />
            </p>
            <p className="text-slate wrap-break-word">{item.justification}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchAnalysis({ items }: { items: MatchItem[] }) {
  const counts = countByStatus(items);
  return (
    <section aria-labelledby="match-heading">
      <h2
        id="match-heading"
        // ResultView moves focus here when the result finishes loading after "Try again".
        data-focus-target
        tabIndex={-1}
        className="font-heading text-3xl font-semibold tracking-tight focus:outline-3 focus:outline-offset-2 focus:outline-cobalt"
      >
        How the sample CV matches the job
      </h2>
      <p className="mt-2 text-lg">
        {counts.covered} covered, {counts.partial} partly covered,{" "}
        {counts.missing} missing
      </p>
      <div className="mt-5 grid gap-8">
        <RequirementList
          title="Required"
          items={items.filter((i) => i.kind === "required")}
        />
        <RequirementList
          title="Nice to have"
          items={items.filter((i) => i.kind === "niceToHave")}
        />
      </div>
    </section>
  );
}
