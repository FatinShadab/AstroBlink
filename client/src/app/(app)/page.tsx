"use client";

/** Landing page after sign-in: purpose, personal progress, and the way in. */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { listContributions } from "@/lib/contributions";
import { ALL_PICTURE_COUNT, PROJECTS, picturesFor } from "@/lib/mock/projectCatalog";
import GlassPanel from "@/components/GlassPanel";

const STEPS = [
  { title: "Pick a project", body: "Choose a science goal: brown dwarfs, moving objects or variable stars." },
  { title: "Select a picture", body: "Open a sky field from the project's gallery. Each one has four epochs." },
  { title: "Blink and tag", body: "Compare epochs, then tag anything that moves, varies or looks like an artifact." },
];

export default function LandingPage() {
  const session = useSession();
  const userId = session.status === "authenticated" ? session.user.id : undefined;
  const mine = userId ? listContributions(userId) : [];
  const firstName = session.status === "authenticated" ? session.user.name.split(" ")[0] : "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-12">
      <section className="flex flex-col gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
          {firstName ? `Welcome back, ${firstName}` : "Citizen science · NASA SPHEREx"}
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
          Help find the next Pluto in the infrared sky.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          SPHEREx images the whole sky every six months. Blink the same field across epochs to spot moving objects,
          brown dwarfs and variable stars that no single image could reveal.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/25 px-5 py-2.5 text-sm font-semibold text-cyan-50 ring-1 ring-cyan-400/50 transition hover:bg-cyan-500/35"
          >
            Browse projects <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link
            href="/tutorial"
            className="inline-flex items-center rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/5"
          >
            How to blink
          </Link>
        </div>
      </section>

      <section aria-label="Your progress" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Projects", value: PROJECTS.length },
          { label: "Sky fields", value: ALL_PICTURE_COUNT },
          { label: "Your contributions", value: mine.length },
          { label: "Fields you've worked", value: new Set(mine.map((c) => c.pictureId)).size },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <p className="font-mono text-2xl tabular-nums text-slate-50">{s.value}</p>
            <p className="mt-1 text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="how-heading" className="flex flex-col gap-3">
        <h2 id="how-heading" className="text-lg font-semibold text-slate-100">How it works</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <GlassPanel>
                <p className="font-mono text-xs text-amber-300">0{i + 1}</p>
                <p className="mt-2 text-sm font-medium text-slate-100">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.body}</p>
              </GlassPanel>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="featured-heading" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2">
          <h2 id="featured-heading" className="text-lg font-semibold text-slate-100">Active projects</h2>
          <Link href="/projects" className="text-xs text-cyan-300 hover:underline">
            All projects
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {PROJECTS.slice(0, 2).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 transition hover:border-white/20 hover:bg-slate-900/70"
            >
              <p className="text-[11px] uppercase tracking-wider text-cyan-300/80">{p.category}</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{p.name}</p>
              <p className="mt-1 text-xs text-slate-400">{p.summary}</p>
              <p className="mt-3 font-mono text-[11px] text-slate-500">{picturesFor(p.id).length} sky fields</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
