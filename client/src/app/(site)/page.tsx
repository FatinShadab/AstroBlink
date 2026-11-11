import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { HomeIntro } from "./HomeIntro";

export default function HomePage() {
  return (
    <Container className="flex flex-1 flex-col justify-center gap-6 py-16">
      <HomeIntro />
      <Link href="/dev/ui" className="text-body-sm text-primary underline underline-offset-4">
        UI primitives
      </Link>
    </Container>
  );
}
