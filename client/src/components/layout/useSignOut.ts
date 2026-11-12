"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n/LangProvider";
import { useUserStore } from "@/lib/state/useUserStore";

/**
 * Signs out with clear feedback: the profile is cleared, a "You're signed out" toast appears (announced by
 * screen readers through the toast's live region) with a lime line flowing across it, and the page goes
 * home unless `stay` is set.
 */
export function useSignOut() {
  const { t } = useT();
  const router = useRouter();
  const toast = useToast();
  const signOut = useUserStore((s) => s.signOut);
  return ({ stay = false }: { stay?: boolean } = {}) => {
    signOut();
    toast({ title: t("signout.title"), description: t("signout.body"), flow: true });
    if (!stay) router.push("/");
  };
}
