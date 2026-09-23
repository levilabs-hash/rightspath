"use client";

import { useCaseDraft } from "@/components/case/CaseDraftProvider";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { analyzeCase, writeAnalysis } from "@/lib/case/analysis";
import {
  REVIEW_HEADING,
  REVIEW_SUPPORT,
  REVIEW_TRUST,
  PROVIDED_SOURCE,
  reviewForDraft,
  reviewLayout,
  reviewPrimary,
  reviewSecondary,
} from "@/lib/case/review";
import { cn } from "@/lib/cn";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function CaseReview() {
  const { draft } = useCaseDraft();
  const mounted = useMounted();
  const model = mounted ? safeReview(draft) : null;

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const analysis = analyzeCase(draft);
    if (analysis) {
      writeAnalysis(analysis);
    }
  }, [draft, mounted]);

  return (
    <div className={reviewLayout.page}>
      <Eyebrow>Case review</Eyebrow>
      <h1 className="mt-4 font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        {REVIEW_HEADING}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-slate">{REVIEW_SUPPORT}</p>

      {mounted && !model ? <ReviewFallback /> : null}
      {model ? <ReviewBody model={model} /> : null}
    </div>
  );
}

function ReviewBody({ model }: { model: NonNullable<ReturnType<typeof reviewForDraft>> }) {
  const detail = model.statusBody.startsWith(model.statusTitle)
    ? model.statusBody.slice(model.statusTitle.length).replace(/^[\s.]+/, "")
    : model.statusBody;

  return (
    <>
      <p className="mt-6 flex items-start gap-3 text-base leading-relaxed text-ink" role="status">
        {model.status === "READY" ? (
          <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-green" />
        ) : (
          <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-amber" />
        )}
        <span>
          <span className="font-medium">{model.statusTitle}. </span>
          {detail}
        </span>
      </p>

      <section className="mt-10" aria-labelledby="case-summary">
        <h2 id="case-summary" className="text-sm font-medium uppercase tracking-widest text-ink">
          Your situation
        </h2>
        <dl className="mt-4 border-t border-border">
          <SummaryRow label="Issue" value={model.issueLabel} source="From your answers" />
          <SummaryRow
            label="Jurisdiction"
            value={model.jurisdictionLabel}
            source="California residential tenancies only"
          />
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="found-facts">
        <h2 id="found-facts" className="flex items-center gap-3 text-sm font-medium uppercase tracking-widest text-ink">
          <Check aria-hidden="true" className="size-4 text-green" />
          What you told us
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate">
          Facts your story stated clearly. A calculated amount is labeled as calculated.
        </p>
        {model.rows.some((row) => row.provided) ? (
          <ul className="mt-4 border-t border-border">
            {model.rows.filter((row) => row.provided).map((row) => (
              <li key={row.field} className="flex gap-3 border-b border-border py-4">
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-green" />
                <div className={reviewLayout.fact}>
                  <p className="text-sm text-slate">{row.label}</p>
                  <p className="mt-1 text-base leading-relaxed text-ink">{row.value}</p>
                  {row.source !== PROVIDED_SOURCE ? (
                    <p className="mt-1 text-sm text-slate">{row.source}.</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border-t border-border pt-4 text-base leading-relaxed text-slate">
            Nothing in the story was clear enough to record yet.
          </p>
        )}
      </section>

      <section className="mt-10 border border-border bg-amber-soft px-4 py-5 sm:px-6" aria-labelledby="need-to-know">
        <h2 id="need-to-know" className="flex items-center gap-3 text-sm font-medium uppercase tracking-widest text-ink">
          <CircleAlert aria-hidden="true" className="size-4 text-amber" />
          What we still need
        </h2>
        {model.needs.length > 0 ? (
          <>
            <p className="mt-3 text-base leading-relaxed text-ink">We still need:</p>
            <ul className="mt-4 flex flex-col gap-4">
              {model.needs.map((item) => (
                <li key={item.question} className="flex gap-3">
                  <span className="mt-1 text-ink" aria-hidden="true">
                  •
                </span>
                  <div className={reviewLayout.fact}>
                    <p className="text-base leading-relaxed text-ink">{item.question}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate">{item.why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-base leading-relaxed text-ink">
            Nothing important is still missing from your story. You can continue to the next step.
          </p>
        )}
      </section>

      <section className="mt-10" aria-labelledby="not-assumed">
        <h2 id="not-assumed" className="text-sm font-medium uppercase tracking-widest text-ink">
          What we didn’t assume
        </h2>
        <p className="mt-3 text-base leading-relaxed text-ink">{REVIEW_TRUST}</p>
        {model.assumptions.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {model.assumptions.map((note) => (
              <li key={note} className="text-base leading-relaxed text-slate">
                {note}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <RuleCheck model={model} />

      {model.note && model.note !== model.statusBody ? (
        <section className="mt-10 border-t border-border pt-6" aria-labelledby="review-notes">
          <h2 id="review-notes" className="text-sm font-medium uppercase tracking-widest text-ink">
            Notes
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink">{model.note}</p>
        </section>
      ) : null}

      <ReviewActions model={model} />
    </>
  );
}

function RuleCheck({ model }: { model: NonNullable<ReturnType<typeof reviewForDraft>> }) {
  const check = model.ruleCheck;
  return (
    <section className="mt-10 border-t border-border pt-6" aria-labelledby="rule-check">
      <h2 id="rule-check" className="text-sm font-medium uppercase tracking-widest text-ink">
        What the rule check found
      </h2>
      <p className="mt-4 flex items-start gap-3 text-base leading-relaxed text-ink">
        {check.status === "READY" ? (
          <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-green" />
        ) : (
          <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-amber" />
        )}
        <span>
          <span className="font-medium">{check.title}. </span>
          {check.summary}
        </span>
      </p>
      {check.matched.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-6">
          {check.matched.map((rule) => (
            <li key={rule.ruleId} className="min-w-0 border-t border-border pt-4">
              <h3 className="text-base font-medium text-ink">{rule.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-slate">{rule.explanation}</p>
              {rule.calculations.length > 0 ? (
                <dl className="mt-4 border-t border-border">
                  {rule.calculations.map((item) => (
                    <div key={item.name} className="border-b border-border py-3">
                      <dt className="text-sm text-slate">{item.name}</dt>
                      <dd className="mt-1 break-words text-base text-ink">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <p className="mt-3 text-sm leading-relaxed text-slate">
                <a href={rule.sourceUrl} className="text-blue underline underline-offset-2">
                  {rule.sourceName}
                </a>
                <span> · Checked {rule.verifiedAt}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {check.unmatched.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-4">
          {check.unmatched.map((rule) => (
            <li key={rule.ruleId} className="min-w-0">
              <h3 className="text-base font-medium text-ink">{rule.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-slate">{rule.explanation}</p>
              {rule.missingFacts.length > 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  Still needed: {rule.missingFacts.join("; ")}.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ReviewActions({
  model,
}: {
  model: NonNullable<ReturnType<typeof reviewForDraft>>;
}) {
  const primary = reviewPrimary(model);
  const secondary = reviewSecondary();
  return (
    <section className="mt-10 border-t border-border pt-6" aria-labelledby="confirm-review">
      <h2 id="confirm-review" className="font-display text-3xl leading-tight text-ink">
        Does this look right?
      </h2>
      <div className={reviewLayout.actions}>
        {primary ? (
          <Button href={primary.href} className="w-full sm:w-auto">
            {primary.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
        <Button href={secondary.href} variant="secondary" className="w-full sm:w-auto">
          {secondary.label}
        </Button>
      </div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  source,
  missing = false,
}: {
  label: string;
  value: string;
  source: string;
  missing?: boolean;
}) {
  return (
    <div className="border-b border-border py-4">
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="mt-1">
        <p className={cn(reviewLayout.fact, "text-base font-medium", missing ? "text-slate" : "text-ink")}>
          {value}
        </p>
        <p className="mt-1 text-sm text-slate">{source}</p>
      </dd>
    </div>
  );
}

function safeReview(draft: unknown) {
  try {
    return reviewForDraft(draft);
  } catch {
    return null;
  }
}

function ReviewFallback() {
  return (
    <div className="mt-10 border-t border-border pt-6">
      <h2 className="font-display text-3xl leading-tight text-ink">We can’t open a review yet.</h2>
      <p className="mt-4 text-base leading-relaxed text-slate">
        RightsPath still needs a supported issue and your story from this browser.
        Nothing here has been compared with a legal source.
      </p>
      <div className="mt-8">
        <Button href="/case/story">Back to your story</Button>
      </div>
    </div>
  );
}
