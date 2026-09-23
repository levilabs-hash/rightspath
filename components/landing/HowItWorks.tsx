import { Container } from "@/components/layout/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";

const steps = [
  {
    number: "01",
    title: "Tell your story",
    body: "Use your own words. You don’t need the legal terminology.",
  },
  {
    number: "02",
    title: "Review what RightsPath understood",
    body: "See the facts that were found, and the details still missing.",
  },
  {
    number: "03",
    title: "See the relevant source-grounded information",
    body: "Legal information is tied to an official California source you can open.",
  },
  {
    number: "04",
    title: "Get practical next steps",
    body: "A short plan, then a draft letter you can review and download. Check every fact before you send it.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 py-12 lg:py-16">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-4 max-w-md font-display text-4xl leading-[1.15] text-ink sm:text-5xl">
              From your words to a plan you can use.
            </h2>
          </div>
          <ol>
            {steps.map((step) => (
              <li
                key={step.number}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-t border-border py-6 last:border-b"
              >
                <span className="font-display text-2xl tabular-nums text-ink">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-lg font-medium text-ink">{step.title}</h3>
                  <p className="mt-2 max-w-md text-base leading-relaxed text-slate">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
