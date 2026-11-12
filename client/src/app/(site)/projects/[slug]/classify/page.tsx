import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { ClassifyFlow } from "@/components/classify/ClassifyFlow";
import { projectBySlug } from "@/data/projects";

export default async function ClassifyPage({ params }: PageProps<"/projects/[slug]/classify">) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();
  return (
    <Container variant="wide" className="flex flex-col gap-8 py-8">
      <ClassifyFlow project={project} />
    </Container>
  );
}
