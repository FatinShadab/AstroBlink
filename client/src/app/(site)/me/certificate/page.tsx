import { RequireSignIn } from "@/components/auth/RequireSignIn";
import type { Metadata } from "next";
import { CertificateView } from "@/components/certificate/CertificateView";
import { Container } from "@/components/layout/Container";

export const metadata: Metadata = { title: "Certificate" };

export default function CertificatePage() {
  return (
    <Container className="flex flex-col gap-8 py-10 md:py-12">
      <RequireSignIn>
        \n <CertificateView />
        \n{" "}
      </RequireSignIn>
    </Container>
  );
}
