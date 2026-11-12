import type { Metadata } from "next";
import { EmbedLoader } from "@/components/embed/EmbedLoader";

export const metadata: Metadata = {
  title: "AstroBlink sky viewer",
  robots: { index: false, follow: false },
};

export default function EmbedPage() {
  return <EmbedLoader />;
}
