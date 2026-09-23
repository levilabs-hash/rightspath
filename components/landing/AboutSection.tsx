import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { lawHelpCa } from "@/lib/sources";
import { ArrowRight } from "lucide-react";

const issues = [
  {
    title: "Security deposit disputes",
    body: "A deposit that was not returned, or deductions you disagree with.",
  },
  {
    title: "Repairs",
    body: "A problem in the home that the landlord has not addressed.",
  },
  {
    title: "Eviction notices",
    body: "A notice telling you to leave or to fix something. These can have strict deadlines.",
  },
];

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-16 border-t border-border py-12 lg:py-16">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
          <div>
            <Eyebrow>About</Eyebrow>
            <h2 className="mt-4 font-display text-4xl leading-[1.15] text-ink sm:text-5xl">
              For California renters, in plain language.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate">
              Residential tenancies in California only. RightsPath will not
              guess at another state’s rules, and it is not a lawyer.
            </p>
          </div>
          <div className="max-w-xl">
            <ul className="border-t border-border">
              {issues.map((issue) => (
                <li key={issue.title} className="border-b border-border py-4">
                  <p className="font-medium text-ink">{issue.title}</p>
                  <p className="mt-2 text-base leading-relaxed text-slate">
                    {issue.body}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-relaxed text-slate">
              If you need advice about your own situation, a lawyer or legal
              aid office can help.{" "}
              <a
                href={lawHelpCa.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue underline-offset-4 hover:underline"
              >
                {lawHelpCa.name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              lists legal aid offices in California.
            </p>
            <div className="mt-8">
              <Button href="/case/jurisdiction">
                Start your case
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
