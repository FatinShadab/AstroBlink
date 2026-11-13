import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { PROJECTS, projectBySlug } from "@/data/projects";

/** Every project is known at build time, so each slug is prerendered (needed for the static export). */
export function generateStaticParams() {
  return PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = projectBySlug(slug);
  return { title: project ? project.slug.replace(/-/g, " ") : "Project" };
}

/** Reads the slug inside Suspense, as Next 16 requires for route params (instant navigation). */
async function ProjectContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();
  return <ProjectOverview project={project} />;
}

export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Container className="flex flex-col gap-8 py-10 md:py-12">
      <Suspense fallback={null}>
        <ProjectContent params={params} />
      </Suspense>
    </Container>
  );
}
