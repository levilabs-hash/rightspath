"use client";

import { useCaseDraft } from "@/components/case/CaseDraftProvider";
import { VerifiedSourceCard } from "@/components/rights/SourceCard";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { analyzeCase } from "@/lib/case/analysis";
import {
  explainSources,
  RIGHTS_HEADING,
  RIGHTS_SUPPORT,
  statusLabel,
  type PresentedRule,
  type SourceComparison,
} from "@/lib/rights/explanation";
import type { EvaluationStatus } from "@/lib/rules/types";
import { ArrowRight, CircleAlert, Info, Minus } from "lucide-react";
import { useSyncExternalStore } from "react";

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function RightsResultView() {
  const { draft } = useCaseDraft();
  const mounted = useMounted();
  const analysis = mounted ? safeAnalysis(draft) : null;
  const model = analysis ? explainSources(analysis) : null;

  return (
    <div className="min-w-0">
      <Eyebrow>California sources</Eyebrow>
      <h1 className="mt-4 font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        {RIGHTS_HEADING}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
        {model?.support ?? RIGHTS_SUPPORT}
      </p>

      {mounted && !model ? <RightsFallback /> : null}
      {model ? <Explanation model={model} /> : null}
    </div>
  );
}

function Explanation({ model }: { model: SourceComparison }) {
  return (
    <>
      <dl className="mt-8 grid gap-4 border-y border-border py-6 sm:grid-cols-2">
        {model.summary.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-sm font-medium text-ink">{item.label}</dt>
            <dd className="mt-1 break-words text-base text-slate">{item.value}</dd>
          </div>
        ))}
      </dl>

      {model.unavailable ? (
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-ink" role="status">
          {model.unavailable}
        </p>
      ) : (
        <div className="mt-10 border-t border-border" aria-live="polite">
          {model.rules.map((rule) => (
            <SourceRule key={rule.title} rule={rule} />
          ))}
        </div>
      )}

      <section className="mt-12 border-t border-border pt-8" aria-labelledby="rights-next">
        <h2 id="rights-next" className="font-display text-3xl text-ink">
          Here is what to do next
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">
          The next screen turns this comparison into steps. It does not predict how a dispute would come out.
        </p>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row">
          <Button href="/case/action-plan" className="w-full sm:w-auto">
            See your next steps
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
          <Button href="/case/review" variant="secondary" className="w-full sm:w-auto">
            Back to your facts
          </Button>
        </div>
      </section>
    </>
  );
}

function SourceRule({ rule }: { rule: PresentedRule }) {
  const headingId = rule.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (
    <article className="min-w-0 border-b border-border py-8" aria-labelledby={headingId}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h2 id={headingId} className="font-display text-3xl leading-tight text-ink">
          {rule.title}
        </h2>
        <StatusChip status={rule.status} label={rule.statusLabel} />
      </div>
      <Section heading="What we know" body={rule.known} />
      <Section heading="What the California source says" body={rule.ruleSays} />
      <Section heading="How it relates to your situation" body={rule.relates} />
      <Section heading="What remains unknown" body={rule.unknown} />
      <Section heading="What we cannot determine" body={rule.limits} />
      <div className="mt-6">
        <VerifiedSourceCard
          name={rule.source.name}
          title={rule.source.title}
          url={rule.source.url}
          verifiedLabel={`Verified ${rule.source.verifiedAt}`}
        />
      </div>
    </article>
  );
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="mt-6 max-w-2xl">
      <h3 className="text-sm font-medium uppercase tracking-widest text-ink">{heading}</h3>
      <p className="mt-2 text-base leading-relaxed text-slate">{body}</p>
    </div>
  );
}

function StatusChip({ status, label }: { status: EvaluationStatus; label: string }) {
  const Icon = status === "NEEDS_INFORMATION" ? CircleAlert : status === "APPLIES" ? Info : Minus;
  const tone =
    status === "NEEDS_INFORMATION"
      ? "border-amber/30 bg-amber-soft text-amber"
      : "border-border bg-paper text-ink";
  return (
    <p
      className={`inline-flex min-h-11 max-w-full items-center gap-2 self-start rounded-button border px-3 text-sm font-medium ${tone}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{label || statusLabel(status)}</span>
    </p>
  );
}

function safeAnalysis(draft: unknown) {
  try {
    return analyzeCase(draft);
  } catch {
    return null;
  }
}

function RightsFallback() {
  return (
    <div className="mt-10">
      <h2 className="font-display text-3xl text-ink">We can’t compare rules yet.</h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
        RightsPath still needs a supported California story from this browser. Nothing here is a legal conclusion.
      </p>
      <div className="mt-8">
        <Button href="/case/story" variant="secondary">
          Back to your story
        </Button>
      </div>
    </div>
  );
}
