import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { TrainFlow } from "@/components/classify/TrainFlow";
import { projectBySlug } from "@/data/projects";

export default async function TrainPage({ params }: PageProps<"/projects/[slug]/train">) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();
  return (
    <Container variant="wide" className="flex flex-col gap-8 py-8">
      <TrainFlow project={project} />
    </Container>
  );
}
