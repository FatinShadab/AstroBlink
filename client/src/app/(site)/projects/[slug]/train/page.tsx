import { RequireSignIn } from "@/components/auth/RequireSignIn";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { TrainFlow } from "@/components/classify/TrainFlow";
import { projectBySlug } from "@/data/projects";

/** Reads the slug inside Suspense, as Next 16 requires for route params (instant navigation). */
async function TrainContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();
  return (
    <RequireSignIn>
      <TrainFlow project={project} />
    </RequireSignIn>
  );
}

export default function TrainPage({ params }: PageProps<"/projects/[slug]/train">) {
  return (
    <Container variant="wide" className="flex flex-col gap-8 py-8">
      <Suspense fallback={null}>
        <TrainContent params={params} />
      </Suspense>
    </Container>
  );
}
