import type { ReactNode } from "react";
import { AppShell, AuthGate } from "@/components/AppShell";

/** Every signed-in page: session guard plus the top navigation. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
