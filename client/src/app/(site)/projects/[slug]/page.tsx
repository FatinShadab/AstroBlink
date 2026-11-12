import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { projectBySlug } from "@/data/projects";

export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = projectBySlug(slug);
  return { title: project ? project.slug.replace(/-/g, " ") : "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();
  return (
    <Container className="flex flex-col gap-8 py-10 md:py-12">
      <ProjectOverview project={project} />
    </Container>
  );
}
