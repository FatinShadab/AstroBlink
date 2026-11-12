import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";

/** Pages WITH header and footer (architecture §3). The header reads the path, so it sits in Suspense. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink />
      <Suspense fallback={<div className="h-14 border-b border-border bg-surface-1 md:h-16" />}>
        <SiteHeader />
      </Suspense>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
