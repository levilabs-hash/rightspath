"use client";

import { Badge } from "@/components/ui/Badge";
import { Rise } from "@/components/motion/Rise";
import { officialSources } from "@/lib/sources";
import { Check, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

const found = [
  { label: "Move-out date", value: "August 12" },
  { label: "Deposit amount", value: "$1,800" },
  { label: "Amount returned", value: "$0" },
];

const sequence = ["Your words", "We found", "We need", "Verified source"];

function Stage({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-border pt-4">
      <p className="flex items-baseline gap-4">
        <span className="font-display text-xl tabular-nums text-ink">{number}</span>
        <span className="text-xs font-medium uppercase tracking-widest text-ink">
          {title}
        </span>
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function PathPreview() {
  const source = officialSources[0];

  return (
    <Rise>
      <div className="relative pb-2 pr-2">
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-x-2 translate-y-2 rounded-surface border border-border"
        />
        <aside
          aria-label="Fictional example of how a story becomes a source-grounded review"
          className="relative rounded-surface border border-border bg-surface p-6"
        >
          <Badge>Fictional example</Badge>
          <p className="mt-4 text-sm leading-relaxed text-slate">
            Not your case, and not a legal conclusion.
          </p>
          <p className="mt-4 text-sm font-medium leading-relaxed text-ink" aria-hidden="true">
            {sequence.map((label, index) => (
              <span key={label}>
                {index > 0 ? <span className="text-slate"> → </span> : null}
                {label}
              </span>
            ))}
          </p>
          <p className="sr-only">
            This example moves from your words, to what we found, to what we
            still need, to a verified source.
          </p>

          <Stage number="01" title="Your words">
            <blockquote className="font-display text-xl italic leading-snug text-ink">
              “I moved out on August 12. My deposit was $1,800, and my landlord
              returned $0. I’ve texted them twice.”
            </blockquote>
          </Stage>

          <Stage number="02" title="We found">
            <ul className="space-y-4">
              {found.map((fact) => (
                <li
                  key={fact.label}
                  className="flex items-baseline justify-between gap-4"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                    <Check aria-hidden="true" className="size-4 shrink-0 text-green" />
                    {fact.label}
                  </span>
                  <span className="shrink-0 text-sm font-medium text-ink">
                    {fact.value}
                  </span>
                </li>
              ))}
            </ul>
          </Stage>

          <Stage number="03" title="We need">
            <p className="flex items-center justify-between gap-4 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-ink">
                <CircleAlert
                  aria-hidden="true"
                  className="size-4 shrink-0 text-amber"
                />
                Itemized statement
              </span>
              <span className="shrink-0 font-medium text-ink">Still needed</span>
            </p>
          </Stage>

          <Stage number="04" title="Verified source">
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm leading-relaxed text-slate">
                {source.publisher} · {source.program}
                <span className="mt-1 block text-ink">{source.topic}</span>
              </p>
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-medium text-blue underline-offset-4 hover:underline"
              >
                View source
                <span className="sr-only">, {source.title}, opens in a new tab</span>
              </a>
            </div>
          </Stage>
        </aside>
      </div>
    </Rise>
  );
}
