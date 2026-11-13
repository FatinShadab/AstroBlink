import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginFromQuery } from "@/components/login/LoginFromQuery";

export const metadata: Metadata = { title: "Sign in" };

/** ?next= is read on the client inside Suspense (see LoginFromQuery). */
export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <LoginFromQuery />
      </Suspense>
    </div>
  );
}
