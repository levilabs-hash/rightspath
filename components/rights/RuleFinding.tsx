import type { ExplanationFinding } from "@/lib/rights/explanation";
import { Check, CircleAlert, CircleX, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STATUS_STYLE: Record<
  ExplanationFinding["status"],
  { icon: LucideIcon; className: string }
> = {
  pass: { icon: Check, className: "border-green/30 bg-green-soft text-green" },
  fail: { icon: CircleX, className: "border-red/30 bg-red-soft text-red" },
  needs_information: {
    icon: CircleAlert,
    className: "border-amber/30 bg-amber-soft text-amber",
  },
  not_applicable: { icon: Minus, className: "border-border bg-paper text-slate" },
};

export function RuleFinding({ finding }: { finding: ExplanationFinding }) {
  const style = STATUS_STYLE[finding.status];
  const Icon = style.icon;

  return (
    <article className="min-w-0 border-b border-border py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="font-display text-3xl leading-tight text-ink">{finding.title}</h3>
        <p
          className={`inline-flex min-h-11 items-center gap-2 self-start rounded-button border px-3 text-sm font-medium uppercase tracking-widest ${style.className}`}
        >
          <Icon aria-hidden="true" className="size-4" />
          {finding.statusLabel}
        </p>
      </div>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate">{finding.summary}</p>
      {finding.facts.length > 0 ? (
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          {finding.facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-sm font-medium text-ink">{fact.label}</dt>
              <dd className="mt-1 break-words text-base text-slate">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-6 text-sm leading-relaxed text-slate">
        Source: {finding.sourceName}.{" "}
        <a
          className="text-blue underline decoration-blue/40 underline-offset-4"
          href={finding.sourceUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {finding.sourceTitle}
          <span className="sr-only">, opens in a new tab</span>
        </a>
      </p>
    </article>
  );
}
