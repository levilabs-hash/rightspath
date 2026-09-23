"use client";

import { useCaseDraft } from "@/components/case/CaseDraftProvider";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  ANALYSIS_STEPS,
  analysisStepDelay,
  analyzeCase,
  canEnterAnalysis,
  processingAppearance,
  writeAnalysis,
} from "@/lib/case/analysis";
import type { CaseDraft } from "@/lib/case/draft";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

const intro = {
  title: "Understanding your situation",
  body: "RightsPath is organizing what you told us so you can review it before we explain what the official sources say.",
};

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduce;
}

export function AnalysisScreen() {
  const { draft } = useCaseDraft();
  const mounted = useMounted();
  const reduce = usePrefersReducedMotion();
  const eligible = mounted && reduce !== null && canEnterAnalysis(draft);

  if (mounted && !canEnterAnalysis(draft)) {
    return <AnalysisFallback draft={draft} />;
  }

  return (
    <AnalysisProgress
      draft={draft}
      eligible={eligible}
      prefersReducedMotion={reduce === true}
    />
  );
}

function AnalysisProgress({
  draft,
  eligible,
  prefersReducedMotion,
}: {
  draft: CaseDraft;
  eligible: boolean;
  prefersReducedMotion: boolean;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(0);
  const shown = prefersReducedMotion ? ANALYSIS_STEPS.length : completed;
  const appearance = processingAppearance(prefersReducedMotion || !eligible);
  const current = ANALYSIS_STEPS[Math.min(shown, ANALYSIS_STEPS.length - 1)];

  useEffect(() => {
    if (!eligible) {
      return;
    }

    const analysis = analyzeCase(draft);
    if (!analysis) {
      return;
    }

    writeAnalysis(analysis);

    let timeout = 0;
    let cancelled = false;
    let step = 0;
    const finishDelay = prefersReducedMotion ? 400 : 200;

    if (prefersReducedMotion) {
      timeout = window.setTimeout(() => {
        if (!cancelled) {
          router.push("/case/review");
        }
      }, finishDelay);
      return () => {
        cancelled = true;
        window.clearTimeout(timeout);
      };
    }

    function tick() {
      timeout = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        step += 1;
        setCompleted(step);
        if (step >= ANALYSIS_STEPS.length) {
          timeout = window.setTimeout(() => {
            if (!cancelled) {
              router.push("/case/review");
            }
          }, finishDelay);
          return;
        }
        tick();
      }, analysisStepDelay(false));
    }

    tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [draft, eligible, prefersReducedMotion, router]);

  return (
    <div>
      <Eyebrow>Your case</Eyebrow>
      <h1 className="mt-4 font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        {intro.title}
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate">{intro.body}</p>
      <p aria-live="polite" className="mt-8 min-h-5 text-sm font-medium text-ink">
        {eligible
          ? shown >= ANALYSIS_STEPS.length
            ? ANALYSIS_STEPS[3].label
            : current.label
          : null}
      </p>
      <ol
        aria-label="Analysis progress"
        className="mt-4 border-t border-border"
        style={{ opacity: appearance.opacity, animation: appearance.animation }}
      >
        {ANALYSIS_STEPS.map((step, index) => {
          const done = eligible && index < shown;
          const currentStep = eligible && shown < ANALYSIS_STEPS.length && index === shown;
          return (
            <li
              key={step.id}
              aria-current={currentStep ? "step" : undefined}
              className="flex items-baseline gap-4 border-b border-border py-4"
            >
              <span
                className={cn(
                  "font-display text-xl tabular-nums",
                  done || currentStep ? "text-ink" : "text-slate",
                )}
              >
                {step.number}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 text-base leading-relaxed",
                  done || currentStep ? "text-ink" : "text-slate",
                  currentStep && "font-medium",
                )}
              >
                {step.label}
              </span>
              {done ? (
                <Check aria-hidden="true" className="size-4 shrink-0 text-green" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AnalysisFallback({ draft }: { draft: CaseDraft }) {
  const missingIssue = draft.issue === null;

  return (
    <div>
      <Eyebrow>Your case</Eyebrow>
      <h1 className="mt-4 font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        {missingIssue ? "Choose what happened first." : "Tell us what happened first."}
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate">
        {missingIssue
          ? "RightsPath can organize a security deposit dispute, a repair problem, or an eviction notice."
          : "RightsPath needs your story before it can organize the details. Nothing has been analyzed."}
      </p>
      <div className="mt-8">
        <Button href={missingIssue ? "/case/issue" : "/case/story"}>
          {missingIssue ? "Choose an issue" : "Back to your story"}
        </Button>
      </div>
    </div>
  );
}
