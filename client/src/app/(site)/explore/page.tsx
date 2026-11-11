import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { ExploreLoader } from "@/components/explore/ExploreLoader";

export const metadata: Metadata = {
  title: "Explore",
  description: "Blink SPHEREx infrared images of any sky position. Simulated sky is labelled.",
};

export default function ExplorePage() {
  return (
    <Container variant="wide" className="flex flex-col gap-6 py-6 md:py-8">
      <ExploreLoader />
    </Container>
  );
}
