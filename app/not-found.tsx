import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
          <p className="text-sm text-slate">404</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">
            This page isn’t part of RightsPath.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate">
            The link may be out of date. You can return home and start again.
          </p>
          <div className="mt-8">
            <Button href="/">Back home</Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
