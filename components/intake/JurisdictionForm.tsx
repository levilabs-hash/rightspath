"use client";

import { ChoiceCard } from "@/components/intake/ChoiceCard";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Building } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

export function JurisdictionForm() {
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/case/issue");
  }

  return (
    <form onSubmit={onSubmit}>
      <h1 className="font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        Where are you renting?
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate">
        RightsPath currently supports California residential tenancy issues.
      </p>
      <fieldset className="mt-8">
        <legend className="sr-only">Where are you renting?</legend>
        <ChoiceCard
          name="jurisdiction"
          value="california"
          title="California"
          description="Residential rentals. Not commercial property."
          icon={<Building className="size-5" />}
          checked
          onChange={() => undefined}
        />
      </fieldset>
      <p className="mt-6 text-sm leading-relaxed text-slate">
        If you rent outside California, we can’t safely complete a case.
        Another state’s rules would be different, and RightsPath will not guess.
      </p>
      <div className="mt-8">
        <Button type="submit" className="w-full sm:w-auto">
          Continue
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        <p className="mt-3 text-sm leading-relaxed text-slate">Next: what happened.</p>
      </div>
    </form>
  );
}
