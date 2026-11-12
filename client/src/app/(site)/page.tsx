import type { Metadata } from "next";
import { AstroLanding } from "@/components/landing/AstroLanding";

export const metadata: Metadata = {
  title: { absolute: "AstroBlink · Watch the sky change" },
};

/** Landing page in the scroll-globe design (components/ui/landing-page.tsx). */
export default function HomePage() {
  return <AstroLanding />;
}
