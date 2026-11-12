"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Surfaces";
import { useT } from "@/lib/i18n/LangProvider";
import { useUserStore } from "@/lib/state/useUserStore";
import { useSignOut } from "@/components/layout/useSignOut";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mock sign-in (rules §5.1): a display name and email kept in this browser only.
 * There is no password and nothing is sent anywhere.
 */
export function LoginView({ next }: { next?: string }) {
  const { t } = useT();
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const signIn = useUserStore((s) => s.signIn);
  const signOut = useSignOut();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <Card className="mx-auto flex w-full max-w-[420px] flex-col gap-4 rounded-[var(--radius-lg)] p-6">
        <h1 className="font-display text-h2 font-semibold text-text-primary">
          {t("login.signedIn")}
        </h1>
        <p className="text-body text-text-secondary">
          {t("login.as")} <span className="text-text-primary">{user.name}</span>
        </p>
        <p className="text-caption text-text-muted">{t("login.localNote")}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/me" className={buttonStyles({ variant: "primary" })}>
            {t("login.toStats")}
          </Link>
          <Button variant="secondary" onClick={() => signOut({ stay: true })}>
            {t("login.signOut")}
          </Button>
        </div>
      </Card>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === "") return setError(t("login.errName"));
    if (!EMAIL.test(email)) return setError(t("login.errEmail"));
    setError(null);
    signIn({ name: name.trim(), email: email.trim(), createdAt: new Date().toISOString() });
    router.replace(next ?? "/me");
  }

  return (
    <div className="relative grid w-full flex-1 lg:grid-cols-2">
      <Link
        href="/"
        className="absolute top-4 left-4 z-10 inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-surface-glass px-3 text-body-sm font-medium text-text-primary backdrop-blur-[12px] hover:bg-surface-3"
      >
        <span aria-hidden="true">←</span>
        {t("login.back")}
      </Link>
      <figure className="relative min-h-[300px] overflow-hidden lg:min-h-full">
        <Image
          src="/brand/login-hero-4k.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-[22%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" aria-hidden="true" />
        <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 md:p-8">
          <h2 className="font-display text-h2 font-semibold text-text-primary">{t("login.hookTitle")}</h2>
          <p className="max-w-[44ch] text-body text-text-secondary">{t("login.hookBody")}</p>
        </figcaption>
      </figure>

      <div className="flex items-center justify-center px-4 py-12 md:px-10 md:py-16">
      <Card className="w-full max-w-[420px] rounded-[var(--radius-lg)] bg-surface-glass p-6 backdrop-blur-[12px] md:p-8">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <h1 className="font-display text-h2 font-semibold text-text-primary">{t("login.title")}</h1>
        <label className="flex flex-col gap-1 text-body-sm font-medium text-text-primary">
          {t("login.name")}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            invalid={error === t("login.errName")}
          />
        </label>
        <label className="flex flex-col gap-1 text-body-sm font-medium text-text-primary">
          {t("login.email")}
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            invalid={error === t("login.errEmail")}
          />
        </label>
        {error && (
          <p className="flex items-start gap-1 text-body-sm text-danger">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        )}
        <Button type="submit" size="lg">
          {t("login.continue")}
        </Button>
        <div className="flex items-center gap-3 text-caption text-text-muted">
          <span className="h-px flex-1 bg-border" />
          {t("login.or")}
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            signIn({ name: t("login.guest"), email: "", createdAt: new Date().toISOString() });
            router.replace(next ?? "/me");
          }}
        >
          {t("login.guestButton")}
        </Button>
        <p className="text-caption text-text-muted">{t("login.localNote")}</p>
      </form>
      </Card>
      </div>
    </div>
  );
}
