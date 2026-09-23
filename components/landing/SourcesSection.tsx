import { Container } from "@/components/layout/Container";
import { SourceCard } from "@/components/rights/SourceCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { officialSources } from "@/lib/sources";

export function SourcesSection() {
  return (
    <section id="sources" className="scroll-mt-16 border-t border-border py-12 lg:py-16">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
          <div>
            <Eyebrow>Sources</Eyebrow>
            <h2 className="mt-4 font-display text-4xl leading-[1.15] text-ink sm:text-5xl">
              Official California sources.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate">
              If RightsPath states a rule, it shows the source. If there is no
              source, it does not state the rule.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {officialSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
