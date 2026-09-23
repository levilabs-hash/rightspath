import type { UnknownItem } from "@/lib/rights/explanation";
import { CircleAlert } from "lucide-react";

export function UnknownFacts({
  intro,
  items,
}: {
  intro: string;
  items: UnknownItem[];
}) {
  return (
    <section className="mt-12" aria-labelledby="unknown-facts" aria-live="polite">
      <h2 id="unknown-facts" className="font-display text-3xl text-ink">
        We still need a few facts
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">{intro}</p>
      {items.length > 0 ? (
        <ul className="mt-6 grid gap-4 border-t border-border">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 border-b border-border py-4">
              <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-amber" />
              <div className="min-w-0">
                <p className="text-base font-medium text-ink">{item.question}</p>
                <p className="mt-1 break-words text-base leading-relaxed text-slate">{item.blocks}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
