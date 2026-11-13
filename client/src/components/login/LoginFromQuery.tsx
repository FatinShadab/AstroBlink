"use client";

import { useSearchParams } from "next/navigation";
import { LoginView } from "@/components/login/LoginView";
import { safeNext } from "@/lib/auth/next";

/** Reads ?next= in the browser, so the login page also works as a static export (no server). */
export function LoginFromQuery() {
  const next = useSearchParams().get("next") ?? undefined;
  return <LoginView next={safeNext(next)} />;
}
