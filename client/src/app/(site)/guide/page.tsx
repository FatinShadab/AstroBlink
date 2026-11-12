import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { FieldGuideIntro } from "@/components/projects/FieldGuideIntro";
import { FieldGuideList } from "@/components/projects/FieldGuideList";

export const metadata: Metadata = { title: "Field guide" };

export default function GuidePage() {
  return (
    <Container className="flex flex-col gap-8 py-10 md:py-12">
      <FieldGuideIntro />
      <FieldGuideList />
    </Container>
  );
}
