"use client";

import { useCaseDraft } from "@/components/case/CaseDraftProvider";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { analyzeCase } from "@/lib/case/analysis";
import {
  PLACEHOLDER_ADDRESS,
  PLACEHOLDER_LANDLORD,
  PLACEHOLDER_TENANT,
  buildLetter,
  letterText,
  withLetterDetails,
  type ActionLetter,
} from "@/lib/letter/draft";
import { renderLetterPdf } from "@/lib/letter/pdf";
import { CircleAlert } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function LetterView() {
  const { draft, setLetterDetails } = useCaseDraft();
  const mounted = useMounted();
  const analysis = mounted ? analyzeCase(draft) : null;
  const built = mounted ? buildLetter(analysis, new Date().toISOString().slice(0, 10)) : null;
  const [status, setStatus] = useState("");

  const letter =
    built?.ok === true
      ? withLetterDetails(built.letter, {
          landlord: draft.landlordName,
          property: draft.propertyAddress,
          tenant: draft.tenantName,
        })
      : null;

  return (
    <div className="min-w-0">
      <Eyebrow>Your next step</Eyebrow>
      <h1 className="mt-4 font-display text-4xl leading-[1.12] text-ink sm:text-5xl">
        Your action letter
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
        Use this draft to document your situation and communicate clearly. Review every detail before sending.
      </p>
      <p className="sr-only">
        {letter ? "Your action letter is ready to review." : ""}
      </p>

      {!mounted ? null : letter ? (
        <LetterReady
          letter={letter}
          landlord={draft.landlordName}
          property={draft.propertyAddress}
          tenant={draft.tenantName}
          onLandlord={(value) => setLetterDetails({ landlordName: value })}
          onProperty={(value) => setLetterDetails({ propertyAddress: value })}
          onTenant={(value) => setLetterDetails({ tenantName: value })}
          onStatus={setStatus}
          status={status}
        />
      ) : (
        <LetterFallback message={built?.ok === false ? built.message : ""} />
      )}
    </div>
  );
}

function LetterReady({
  letter,
  landlord,
  property,
  tenant,
  onLandlord,
  onProperty,
  onTenant,
  onStatus,
  status,
}: {
  letter: ActionLetter;
  landlord: string;
  property: string;
  tenant: string;
  onLandlord: (value: string) => void;
  onProperty: (value: string) => void;
  onTenant: (value: string) => void;
  onStatus: (value: string) => void;
  status: string;
}) {
  async function download() {
    try {
      const bytes = await renderLetterPdf(letter);
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "rightspath-action-letter.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
      onStatus("PDF downloaded.");
    } catch {
      onStatus("The PDF could not be created. You can still copy the letter.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(letterText(letter));
      onStatus("Letter copied.");
    } catch {
      onStatus("The letter could not be copied. You can still download the PDF.");
    }
  }

  return (
    <>
      <div className="mt-8 flex gap-4 rounded-card border border-border bg-amber-soft p-4">
        <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-amber" />
        <div>
          <h2 className="text-base font-medium text-ink">Review before sending</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink">
            This draft is based on the information you provided and the sources RightsPath identified. Review names, dates, amounts, and facts before sending.
          </p>
        </div>
      </div>

      <article
        aria-labelledby="letter-subject"
        className="mx-auto mt-8 max-w-3xl border border-border bg-surface px-6 py-10 text-ink shadow-none sm:px-16 sm:py-16"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        <p className="text-sm text-slate">{letter.preparedOn}</p>
        <p className="mt-6 text-base text-ink">{letter.recipient}</p>
        <p className="text-base text-ink">{letter.property}</p>
        <h2 id="letter-subject" className="mt-8 text-2xl text-ink">
          {letter.subject}
        </h2>
        <p className="mt-6 text-base leading-relaxed text-ink">{letter.salutation}</p>
        {letter.paragraphs.map((paragraph) => (
          <p key={paragraph} className="mt-4 text-base leading-relaxed text-ink">
            {paragraph}
          </p>
        ))}
        <h3 className="mt-8 text-base font-medium text-ink">What I am requesting</h3>
        <ul className="mt-3 grid gap-2">
          {letter.requests.map((request) => (
            <li key={request} className="text-base leading-relaxed text-ink">
              {request}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-base font-medium text-ink">Information still missing</h3>
        <ul className="mt-3 grid gap-2">
          {letter.unknowns.map((item) => (
            <li key={item} className="text-base leading-relaxed text-ink">
              {item}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-base font-medium text-ink">Sources used for this draft</h3>
        <ul className="mt-3 grid gap-3">
          {letter.sources.map((source) => (
            <li key={source.url} className="text-sm leading-relaxed text-slate">
              <span className="text-ink">{source.name}: {source.title}</span>
              <br />
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-blue underline-offset-4 hover:underline"
              >
                {source.url}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-8 whitespace-pre-line text-base leading-relaxed text-ink">{letter.closing}</p>
        <p className="mt-8 text-xs uppercase tracking-widest text-slate">Prepared with RightsPath</p>
      </article>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate">
        RightsPath provides information and drafting assistance, not legal representation.
      </p>

      <section className="mt-8 max-w-3xl" aria-labelledby="complete-letter">
        <h2 id="complete-letter" className="font-display text-2xl text-ink">
          Complete your letter
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate">
          These details are saved with this case for this browser session. A blank field stays as a placeholder.
        </p>
        <IdentityGaps letter={letter} />
        <form className="mt-4 grid gap-4" onSubmit={(event) => event.preventDefault()}>
          <DetailField id="letter-tenant" label="Tenant name" value={tenant} onChange={onTenant} placeholder="[Tenant name]" />
          <DetailField id="letter-landlord" label="Landlord or property manager name" value={landlord} onChange={onLandlord} placeholder="[Landlord name]" />
          <DetailField id="letter-property" label="Property address" value={property} onChange={onProperty} placeholder="[Property address]" />
        </form>
      </section>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button type="button" onClick={download} className="w-full sm:w-auto">
          Download PDF
        </Button>
        <Button type="button" variant="secondary" onClick={copy} className="w-full sm:w-auto">
          Copy letter
        </Button>
      </div>
      <p className="mt-4 min-h-6 text-sm font-medium text-ink" role="status" aria-live="polite">
        {status}
      </p>
      <div className="mt-6">
        <Button href="/case/action-plan" variant="ghost">
          Back to the action plan
        </Button>
      </div>
    </>
  );
}

function IdentityGaps({ letter }: { letter: ActionLetter }) {
  const missing = [
    letter.tenant === PLACEHOLDER_TENANT ? "your name" : null,
    letter.recipient === PLACEHOLDER_LANDLORD ? "the landlord or property manager name" : null,
    letter.property === PLACEHOLDER_ADDRESS ? "the property address" : null,
  ].filter((item): item is string => item !== null);

  if (missing.length === 0) {
    return (
      <p className="mt-3 text-sm leading-relaxed text-ink">
        The name and address fields are filled in on this draft.
      </p>
    );
  }

  return (
    <p className="mt-3 text-sm leading-relaxed text-ink">
      Still missing: {missing.join(", ")}.
    </p>
  );
}

function DetailField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-medium text-ink">
      {label}
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-input border border-border bg-surface px-3 text-base font-normal text-ink"
      />
    </label>
  );
}

function LetterFallback({ message }: { message: string }) {
  return (
    <div className="mt-10">
      <h2 className="font-display text-3xl text-ink">This letter cannot be drafted.</h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
        {message || "Go back to your story so RightsPath has a case to use. A letter is not created from a blank or unreadable case."}
      </p>
      <div className="mt-8">
        <Button href="/case/action-plan" variant="secondary">
          Back to the action plan
        </Button>
      </div>
    </div>
  );
}
