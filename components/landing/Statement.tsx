import { Container } from "@/components/layout/Container";

export function Statement() {
  return (
    <section className="bg-ink text-paper" aria-label="A note about your story">
      <Container className="py-12 lg:py-16">
        <p className="max-w-3xl font-display text-4xl leading-[1.15] sm:text-5xl">
          Your story doesn’t need to sound like a legal document.
        </p>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/80">
          Write it the way it happened. RightsPath looks for the details that
          matter and tells you what is still missing.
        </p>
      </Container>
    </section>
  );
}
