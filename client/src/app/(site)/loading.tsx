import { Container } from "@/components/layout/Container";
import { Skeleton } from "@/components/ui/Surfaces";

export default function Loading() {
  return (
    <Container className="flex flex-col gap-4 py-12" aria-busy="true">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </Container>
  );
}
