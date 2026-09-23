"use client";

import { useCaseDraft } from "@/components/case/CaseDraftProvider";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { canEnterAnalysis } from "@/lib/case/analysis";
import { STORY_LIMIT, storyError } from "@/lib/case/draft";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

const placeholder =
  "For example: I moved out three weeks ago and my landlord hasn't returned my $1,800 deposit. I've texted them twice but haven't received a response.";

export function StoryForm() {
  const { draft, setStory } = useCaseDraft();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = storyError(draft.story);
    if (message) {
      setError(message);
      fieldRef.current?.focus();
      return;
    }
    if (!canEnterAnalysis(draft)) {
      router.push("/case/issue");
      return;
    }
    setError(null);
    router.push("/case/analyzing");
  }

  return (
    <form onSubmit={onSubmit}>
      <h1 className="font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        Tell us what happened.
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate">
        Use your own words. You don’t need to know the legal terminology.
      </p>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-slate">
        Next, we’ll organize the facts and show what is still missing. Nothing is decided on this page.
      </p>
      <div className="mt-8">
        <Textarea
          ref={fieldRef}
          id="story"
          name="story"
          label="Your story"
          hint="Don’t have everything? That’s okay. We’ll tell you what’s missing."
          placeholder={placeholder}
          value={draft.story}
          maxLength={STORY_LIMIT}
          error={error ?? undefined}
          onChange={(event) => {
            setStory(event.target.value);
            setError(null);
          }}
        />
      </div>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between">
        <Button type="submit" className="w-full sm:w-auto">
          Continue
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        <Button
          href="/case/issue"
          variant="ghost"
          className="w-full sm:w-auto"
          aria-label="Back to what happened"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back
        </Button>
      </div>
    </form>
  );
}
