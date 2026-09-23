import { Container } from "@/components/layout/Container";
import { lawHelpCa } from "@/lib/sources";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="grid gap-8 py-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:py-16">
        <div>
          <p className="font-display text-2xl text-ink">RightsPath</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate">
            Know what comes next. California residential tenancy only.
            RightsPath is not a law firm and does not provide legal advice.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-4 text-sm">
          <Link href="/#how-it-works" className="text-ink underline-offset-4 hover:underline">
            How it works
          </Link>
          <Link href="/#sources" className="text-ink underline-offset-4 hover:underline">
            Sources
          </Link>
          <Link href="/#about" className="text-ink underline-offset-4 hover:underline">
            About
          </Link>
          <Link
            href="/case/jurisdiction"
            className="text-ink underline-offset-4 hover:underline"
          >
            Start your case
          </Link>
          <a
            href={lawHelpCa.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline-offset-4 hover:underline"
          >
            Find legal help
            <span className="sr-only"> at {lawHelpCa.name}, opens in a new tab</span>
          </a>
        </nav>
      </Container>
    </footer>
  );
}
