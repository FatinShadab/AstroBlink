import type { Metadata } from "next";
import { AboutContent } from "@/components/about/AboutContent";
import { Container } from "@/components/layout/Container";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <Container variant="read" className="flex flex-col py-10 md:py-14">
      <AboutContent />
    </Container>
  );
}
