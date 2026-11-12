import type { Metadata } from "next";
import { CommunityView } from "@/components/community/CommunityView";
import { Container } from "@/components/layout/Container";

export const metadata: Metadata = { title: "Community" };

export default function CommunityPage() {
  return (
    <Container className="flex flex-col gap-8 py-10 md:py-12">
      <CommunityView />
    </Container>
  );
}
