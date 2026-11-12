import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { LoginView } from "@/components/login/LoginView";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Container className="flex flex-1 flex-col items-center py-12 md:py-20">
      <LoginView />
    </Container>
  );
}
