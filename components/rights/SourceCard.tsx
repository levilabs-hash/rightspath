import { ArrowUpRight } from "lucide-react";
import type { OfficialSource } from "@/lib/sources";

export function VerifiedSourceCard({
  name,
  title,
  url,
  verifiedLabel,
}: {
  name: string;
  title: string;
  url: string;
  verifiedLabel: string;
}) {
  return (
    <article className="min-w-0 rounded-card border border-border border-l-blue bg-surface p-6 sm:border-l-2">
      <p className="text-xs font-medium uppercase tracking-widest text-slate">Official source</p>
      <h3 className="mt-3 font-display text-2xl text-ink">{name}</h3>
      <p className="mt-2 text-base leading-relaxed text-slate">{title}</p>
      <p className="mt-4 text-sm text-ink">{verifiedLabel}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue underline-offset-4 hover:underline"
      >
        Read official source
        <span className="sr-only">, {title}, opens in a new tab</span>
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </article>
  );
}

export function SourceCard({
  source,
  embedded = false,
}: {
  source: OfficialSource;
  embedded?: boolean;
}) {
  const publisher = `${source.publisher} · ${source.program}`;

  return (
    <article
      className={
        embedded
          ? undefined
          : "rounded-card border border-border bg-surface p-6"
      }
    >
      <p className="text-xs font-medium uppercase tracking-widest text-slate">
        Verified source
      </p>
      <p className="mt-4 text-sm text-slate">{publisher}</p>
      <h3 className="mt-1 text-lg font-medium text-ink">{source.title}</h3>
      <p className="mt-2 text-sm font-medium text-ink">{source.topic}</p>
      <p className="mt-4 text-base leading-relaxed text-slate">
        {source.explanation}
      </p>
      <a
        href={source.href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue underline-offset-4 hover:underline"
      >
        View source
        <span className="sr-only">, {source.title}, opens in a new tab</span>
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </article>
  );
}
