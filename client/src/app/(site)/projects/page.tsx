import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { ProjectsGallery } from "@/components/projects/ProjectsGallery";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <Container className="flex flex-col gap-8 py-10 md:py-12">
      <ProjectsGallery />
    </Container>
  );
}
