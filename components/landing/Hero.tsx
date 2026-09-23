import { Container } from "@/components/layout/Container";
import { PathPreview } from "@/components/landing/PathPreview";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

const trust = [
  {
    title: "Private by design",
    body: "No account. What you write stays in this browser tab.",
  },
  {
    title: "California only",
    body: "Built for California residential tenancies only.",
  },
  {
    title: "Source-grounded",
    body: "Each comparison cites an official California page you can open.",
  },
];

export function Hero() {
  return (
    <Container className="pb-12 pt-12 lg:pb-16 lg:pt-16">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <div>
          <p className="text-sm text-slate">California residential tenancy</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.12] text-ink sm:text-6xl">
            Know what comes next.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate">
            For renters dealing with a security deposit, a repair, or an eviction
            notice. You get the facts we understood, a cited California source,
            and a short plan. This is information, not legal advice.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button href="/case/jurisdiction" className="w-full sm:w-auto">
              Start your case
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
            <Button
              href="/#how-it-works"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              How it works
            </Button>
          </div>
        </div>
        <PathPreview />
      </div>

      <dl className="mt-12 grid gap-8 border-t border-border pt-8 sm:grid-cols-3">
        {trust.map((item) => (
          <div key={item.title}>
            <dt className="text-sm font-medium text-ink">{item.title}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-slate">{item.body}</dd>
          </div>
        ))}
      </dl>
    </Container>
  );
}
