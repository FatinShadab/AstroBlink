import { RequireSignIn } from "@/components/auth/RequireSignIn";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { ClassifyFlow } from "@/components/classify/ClassifyFlow";
import { PROJECTS, projectBySlug } from "@/data/projects";

/** Every project is known at build time, so each slug is prerendered (needed for the static export). */
export function generateStaticParams() {
  return PROJECTS.map((project) => ({ slug: project.slug }));
}

/** Reads the slug inside Suspense, as Next 16 requires for route params (instant navigation). */
async function ClassifyContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();
  return (
    <RequireSignIn>
      <ClassifyFlow project={project} />
    </RequireSignIn>
  );
}

export default function ClassifyPage({ params }: PageProps<"/projects/[slug]/classify">) {
  return (
    <Container variant="wide" className="flex flex-col gap-8 py-8">
      <Suspense fallback={null}>
        <ClassifyContent params={params} />
      </Suspense>
    </Container>
  );
}
