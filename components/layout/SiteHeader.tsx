"use client";

import { Container } from "@/components/layout/Container";
import { ProgressPath } from "@/components/layout/ProgressPath";
import { Button } from "@/components/ui/Button";
import { STEP_BY_PATH } from "@/lib/case/steps";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#sources", label: "Sources" },
  { href: "/#about", label: "About" },
];

export function SiteHeader({ variant = "marketing" }: { variant?: "marketing" | "case" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const currentId = STEP_BY_PATH[pathname] ?? "where";

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="font-display text-2xl leading-none tracking-tight text-ink"
        >
          RightsPath
        </Link>

        {variant === "marketing" ? (
          <>
            <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate underline-offset-4 hover:text-ink hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Button
                href="/case/jurisdiction"
                size="md"
                className="hidden lg:inline-flex"
              >
                Start your case
              </Button>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-button text-ink lg:hidden"
                aria-expanded={open}
                aria-controls={open ? "site-menu" : undefined}
                onClick={() => setOpen((value) => !value)}
              >
                {open ? (
                  <X aria-hidden="true" className="size-5" />
                ) : (
                  <Menu aria-hidden="true" className="size-5" />
                )}
                <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
              </button>
            </div>
          </>
        ) : (
          <Link href="/" className="text-sm text-slate underline-offset-4 hover:text-ink hover:underline">
            Home
          </Link>
        )}
      </Container>

      {variant === "marketing" && open ? (
        <nav id="site-menu" aria-label="Primary" className="border-t border-border lg:hidden">
          <Container className="flex flex-col gap-2 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex h-12 items-center text-base text-ink"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Button href="/case/jurisdiction" className="mt-2 w-full" onClick={() => setOpen(false)}>
              Start your case
            </Button>
          </Container>
        </nav>
      ) : null}

      {variant === "case" ? (
        <Container className="pb-4">
          <ProgressPath currentId={currentId} />
        </Container>
      ) : null}
    </header>
  );
}
