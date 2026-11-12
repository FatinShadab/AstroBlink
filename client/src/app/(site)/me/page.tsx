import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { StatsView } from "@/components/stats/StatsView";

export const metadata: Metadata = { title: "My stats" };

export default function MePage() {
  return (
    <Container className="flex flex-col gap-8 py-10 md:py-12">
      <StatsView />
    </Container>
  );
}
