"use client";

import { ChoiceCard } from "@/components/intake/ChoiceCard";
import { Button } from "@/components/ui/Button";
import { useCaseDraft } from "@/components/case/CaseDraftProvider";
import { issueOptions } from "@/lib/case/issues";
import type { IssueId } from "@/lib/case/draft";
import { lawHelpCa } from "@/lib/sources";
import { ArrowLeft, ArrowRight, Banknote, CircleAlert, ScrollText, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

const icons: Record<IssueId, ReactNode> = {
  deposit_dispute: <Banknote className="size-5" />,
  repair_neglect: <Wrench className="size-5" />,
  eviction_notice: <ScrollText className="size-5" />,
};

export function IssueForm() {
  const router = useRouter();
  const { draft, setIssue } = useCaseDraft();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.issue) {
      return;
    }
    router.push("/case/story");
  }

  return (
    <form onSubmit={onSubmit}>
      <h1 className="font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        What happened?
      </h1>
      <p id="issue-help" className="mt-4 max-w-xl text-lg leading-relaxed text-slate">
        Choose the situation that fits best. You can describe it in your own
        words on the next step.
      </p>
      <fieldset className="mt-8" aria-describedby="issue-help">
        <legend className="sr-only">What happened?</legend>
        <div className="flex flex-col gap-4">
          {issueOptions.map((issue) => (
            <ChoiceCard
              key={issue.id}
              name="issue"
              value={issue.id}
              title={issue.title}
              description={issue.description}
              icon={icons[issue.id]}
              checked={draft.issue === issue.id}
              onChange={() => setIssue(issue.id)}
            />
          ))}
        </div>
      </fieldset>
      <div aria-live="polite" className="mt-6">
        {draft.issue === "eviction_notice" ? (
          <div className="flex gap-4 rounded-card border border-border bg-amber-soft p-4">
            <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-amber" />
            <p className="text-sm leading-relaxed text-ink">
              This may require prompt attention. Eviction notices can have
              strict deadlines. Review the notice carefully and consider
              qualified housing or legal help if you’re unsure what it means.{" "}
              <a
                href={lawHelpCa.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue underline-offset-4 hover:underline"
              >
                Find legal help
                <span className="sr-only"> at {lawHelpCa.name}, opens in a new tab</span>
              </a>
              .
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between">
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={!draft.issue}
        >
          Continue
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        <Button
          href="/case/jurisdiction"
          variant="ghost"
          className="w-full sm:w-auto"
          aria-label="Back to where you rent"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back
        </Button>
      </div>
    </form>
  );
}
