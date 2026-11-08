"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInLocally, useSession, validateCredentials } from "@/lib/auth/session";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session.status === "authenticated") router.replace(next.startsWith("/") ? next : "/");
  }, [session.status, next, router]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = validateCredentials(email, password);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    signInLocally(email);
    router.replace(next.startsWith("/") ? next : "/");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/30 to-amber-400/20 ring-1 ring-white/10">
            <span className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(56,189,248,0.9)]" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Sign in to AstroBlink</h1>
            <p className="mt-1 text-sm text-slate-400">Join a project and contribute to SPHEREx discoveries.</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
        >
          <label className="flex flex-col gap-1.5 text-sm text-slate-300">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              placeholder="you@example.org"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-slate-300">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
              placeholder="At least 8 characters"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-cyan-500/30 px-4 py-2.5 font-semibold text-cyan-50 ring-1 ring-cyan-400/50 transition hover:bg-cyan-500/40 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            Local sign-in: the backend account service is not connected yet, so this only remembers you on this device.
          </p>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
