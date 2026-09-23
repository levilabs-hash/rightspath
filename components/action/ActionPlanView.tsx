"use client";

import { VerifiedSourceCard } from "@/components/rights/SourceCard";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { buildActionPlan, type ActionPlan, type ActionStep } from "@/lib/action/plan";
import { analyzeCase } from "@/lib/case/analysis";
import { useCaseDraft } from "@/components/case/CaseDraftProvider";
import { Check, CircleAlert, Minus } from "lucide-react";
import { useSyncExternalStore } from "react";

const PRIORITY_LABEL: Record<ActionStep["priority"], string> = {
  now: "Now",
  next: "Next",
  if_needed: "If needed",
};

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ActionPlanView() {
  const { draft } = useCaseDraft();
  const mounted = useMounted();
  const analysis = mounted ? analyzeCase(draft) : null;
  const plan = analysis ? buildActionPlan(analysis) : null;

  return (
    <div className="min-w-0">
      <Eyebrow>Action plan</Eyebrow>
      <h1 className="mt-4 font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        Your next steps
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
        Here’s what you can do with what we know so far.
      </p>

      {mounted && !plan ? <PlanFallback /> : null}
      {plan ? <PlanBody plan={plan} /> : null}
    </div>
  );
}

function PlanBody({ plan }: { plan: ActionPlan }) {
  const StatusIcon =
    plan.status === "ready" ? Check : plan.status === "needs_information" ? CircleAlert : Minus;
  const statusClass =
    plan.status === "ready"
      ? "border-green/30 bg-green-soft text-green"
      : plan.status === "needs_information"
        ? "border-amber/30 bg-amber-soft text-amber"
        : "border-border bg-paper text-slate";

  return (
    <>
      <dl className="mt-8 grid gap-4 border-y border-border py-6 sm:grid-cols-2">
        {plan.summary.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-sm font-medium text-ink">{item.label}</dt>
            <dd className="mt-1 break-words text-base text-slate">{item.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8" aria-labelledby="plan-status" aria-live="polite">
        <h2 id="plan-status" className="sr-only">
          Plan status
        </h2>
        <p
          className={`inline-flex min-h-11 items-center gap-2 rounded-button border px-3 text-sm font-medium ${statusClass}`}
        >
          <StatusIcon aria-hidden="true" className="size-4" />
          {plan.statusLabel}
        </p>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">{plan.statusDetail}</p>
        {plan.notice ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink">{plan.notice}</p>
        ) : null}
      </section>

      {plan.steps.length > 0 ? (
        <section className="mt-12" aria-labelledby="plan-steps">
          <h2 id="plan-steps" className="font-display text-3xl text-ink">
            What to do next
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">
            Do these in order. A missing fact is not a conclusion.
          </p>
          <ol className="mt-4 border-t border-border">
            {plan.steps.map((step) => (
              <li key={step.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 border-b border-border py-6">
                <span className="font-display text-3xl leading-none text-ink">
                  {String(step.number).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium uppercase tracking-widest text-slate">
                    {PRIORITY_LABEL[step.priority]}
                  </p>
                  <h3 className="mt-2 text-xl font-medium text-ink">{step.title}</h3>
                  <p className="mt-3 break-words text-base leading-relaxed text-slate">
                    {step.description}
                  </p>
                  {step.reason ? (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-ink">
                        Why this step appears
                      </summary>
                      <p className="mt-2 break-words text-base leading-relaxed text-slate">
                        {step.reason}
                      </p>
                    </details>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {plan.evidence.length > 0 ? (
        <section className="mt-12" aria-labelledby="plan-evidence">
          <h2 id="plan-evidence" className="font-display text-3xl text-ink">
            Evidence to keep
          </h2>
          <ul className="mt-4 border-t border-border">
            {plan.evidence.map((item) => (
              <li key={item.id} className="border-b border-border py-4">
                <p className="text-base font-medium text-ink">{item.label}</p>
                <p className="mt-1 break-words text-base leading-relaxed text-slate">
                  {item.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.escalation ? (
        <section className="mt-12" aria-labelledby="plan-next">
          <h2 id="plan-next" className="font-display text-3xl text-ink">
            {plan.escalation.title}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">
            {plan.escalation.body}
          </p>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">
            {plan.escalation.help}
          </p>
        </section>
      ) : null}

      {plan.source ? (
        <div className="mt-8">
          <VerifiedSourceCard
            name={plan.source.name}
            title={plan.source.title}
            url={plan.source.url}
            verifiedLabel={plan.source.verifiedLabel}
          />
        </div>
      ) : null}

      <section className="mt-12" aria-labelledby="plan-limits">
        <h2 id="plan-limits" className="font-display text-3xl text-ink">
          Important limits
        </h2>
        <ul className="mt-4 grid max-w-2xl gap-3">
          {plan.limits.map((item) => (
            <li key={item} className="text-base leading-relaxed text-slate">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="plan-end">
        <h2 id="plan-end" className="font-display text-3xl text-ink">
          Your action letter
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate">
          The next page is a draft you can review, copy, or download. It uses the facts from this case. It does not decide the dispute.
        </p>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row">
          <Button href="/case/letter" className="w-full sm:w-auto">
            Review your letter
          </Button>
          <Button href="/case/rights" variant="secondary" className="w-full sm:w-auto">
            Back to the comparison
          </Button>
        </div>
      </section>
    </>
  );
}

function PlanFallback() {
  return (
    <div className="mt-10">
      <h2 className="font-display text-3xl text-ink">We can’t open a plan yet.</h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
        Start with a California security deposit story so there are findings to organize.
      </p>
      <div className="mt-8">
        <Button href="/case/story" variant="secondary">
          Back to your story
        </Button>
      </div>
    </div>
  );
}
