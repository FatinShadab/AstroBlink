"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surfaces";
import { useT } from "@/lib/i18n/LangProvider";
import { useHasHydrated } from "@/lib/state/useHasHydrated";
import { useUserStore } from "@/lib/state/useUserStore";

/**
 * Shows its children only to a signed-in user. Contributing, my stats and the certificate need an
 * account. Until the stored state has loaded, nothing is shown, so a signed-in user never sees a flash.
 */
export function RequireSignIn({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHasHydrated();
  const user = useUserStore((s) => s.user);
  const signedIn = hydrated && user !== null;
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  useEffect(() => {
    if (hydrated && !user) router.replace(loginHref);
  }, [hydrated, user, router, loginHref]);

  if (signedIn) return <>{children}</>;

  return (
    <Card className="mx-auto flex max-w-[520px] flex-col gap-4 p-6 text-center">
      <h1 className="font-display text-h3 font-medium text-text-primary">
        {t("auth.required.title")}
      </h1>
      <p className="text-body-sm text-text-secondary">{t("auth.required.body")}</p>
      <div className="flex justify-center">
        <Link href={loginHref} className={buttonStyles({ variant: "primary" })}>
          {t("header.signIn")}
        </Link>
      </div>
    </Card>
  );
}
