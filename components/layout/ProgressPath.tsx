import { cn } from "@/lib/cn";
import { CASE_STEPS, formatProgress, stepIndex, type StepId } from "@/lib/case/steps";
import Link from "next/link";

export function ProgressPath({ currentId }: { currentId: StepId }) {
  const currentIndex = stepIndex(currentId);
  const current = CASE_STEPS[currentIndex];

  return (
    <nav aria-label="Progress">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium tabular-nums text-ink">
          {formatProgress(currentId)}
        </p>
        <p className="text-sm text-slate lg:hidden">{current.label}</p>
      </div>
      <ol className="mt-4 hidden gap-4 lg:grid lg:grid-cols-4">
        {CASE_STEPS.map((step, index) => {
          const state =
            index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
          const labelClass = cn(
            "text-sm",
            state === "current" && "font-medium text-ink underline decoration-blue decoration-2 underline-offset-8",
            state === "complete" && "text-ink",
            state === "upcoming" && "text-slate",
          );

          return (
            <li key={step.id} aria-current={state === "current" ? "step" : undefined}>
              {state === "complete" && "href" in step && step.href ? (
                <Link href={step.href} className={labelClass}>
                  <span className="mr-2 tabular-nums text-slate">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step.label}
                </Link>
              ) : (
                <span className={labelClass}>
                  <span className="mr-2 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden="true">
        {CASE_STEPS.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "h-1 rounded-sm",
              index <= currentIndex ? "bg-ink" : "bg-border",
            )}
          />
        ))}
      </div>
    </nav>
  );
}
