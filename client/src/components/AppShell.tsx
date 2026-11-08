"use client";

/**
 * AppShell — signed-in chrome: top navigation and the route guard that sends
 * anonymous visitors to /login (and back to where they were after sign-in).
 */

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutLocally, useSession } from "@/lib/auth/session";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/observatory", label: "Observatory" },
  { href: "/discoveries", label: "Discoveries" },
  { href: "/tutorial", label: "Tutorial" },
];

export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [session.status, pathname, router]);

  if (session.status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-xs text-slate-500" role="status">
        Checking session…
      </div>
    );
  }
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="AstroBlink home">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/30 to-amber-400/20 ring-1 ring-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-100">AstroBlink</span>
          </Link>

          <nav aria-label="Primary" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive(item.href) ? "bg-white/10 text-slate-50" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {session.status === "authenticated" && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden max-w-[10rem] truncate text-xs text-slate-400 md:inline" title={session.user.email}>
                {session.user.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  signOutLocally();
                  router.replace("/login");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
              >
                <LogOut size={13} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
