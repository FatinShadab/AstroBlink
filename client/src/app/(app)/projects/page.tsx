"use client";

/** Project gallery: pick a science project to contribute to. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { contributedPictureIds } from "@/lib/contributions";
import { BENCHMARK_TARGETS } from "@/lib/mock/spherexMockEngine";
import { PROJECTS, picturesFor, type ProjectCategory } from "@/lib/mock/projectCatalog";

const CATEGORIES: Array<ProjectCategory | "All"> = ["All", "Brown dwarfs", "Moving objects", "Variable stars"];

export default function ProjectsGalleryPage() {
  const session = useSession();
  const userId = session.status === "authenticated" ? session.user.id : undefined;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProjectCategory | "All">("All");

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROJECTS.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!q || `${p.name} ${p.summary}`.toLowerCase().includes(q)),
    );
  }, [query, category]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Project gallery</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Choose a project</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">Each project asks a different question of the same SPHEREx sky.</p>
        </div>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Search projects</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            className="w-full rounded-xl border border-white/10 bg-slate-900/70 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
          />
        </label>
      </header>

      <div role="group" aria-label="Filter by category" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
              category === c ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100" : "border-white/10 text-slate-400 hover:text-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {projects.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
          No projects match that search.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const pictures = picturesFor(p.id);
            const done = userId ? contributedPictureIds(userId, p.id).size : 0;
            const pct = pictures.length ? Math.round((done / pictures.length) * 100) : 0;
            const targets = BENCHMARK_TARGETS.filter((t) => p.targetIds.includes(t.id)).map((t) => t.name);
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-5 transition hover:border-cyan-400/30 hover:bg-slate-900/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200/90">
                      {p.category}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-400">
                      {done}/{pictures.length} fields
                    </span>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-100 group-hover:text-white">{p.name}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{p.summary}</p>
                  </div>
                  <div className="mt-auto flex flex-col gap-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-500">Targets: {targets.join(" · ")}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
