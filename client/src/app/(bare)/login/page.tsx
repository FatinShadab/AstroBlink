import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginView } from "@/components/login/LoginView";
import { safeNext } from "@/lib/auth/next";

export const metadata: Metadata = { title: "Sign in" };

/** Reads ?next= inside Suspense (Next 16 requires params and search params there). */
async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginView next={safeNext(next)} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
