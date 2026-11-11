"use client";

import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { buttonStyles } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LangProvider";

export function NotFoundContent() {
  const { t } = useT();
  return (
    <main id="main" className="flex min-h-full flex-1 flex-col justify-center">
      <Container className="flex flex-col items-start gap-4 py-16">
        <h1 className="font-display text-h1 font-semibold text-text-primary">
          {t("notFound.title")}
        </h1>
        <p className="max-w-[68ch] text-body-lg text-text-secondary">{t("notFound.body")}</p>
        <Link href="/explore" className={buttonStyles({ variant: "primary", size: "lg" })}>
          {t("notFound.cta")}
        </Link>
      </Container>
    </main>
  );
}
