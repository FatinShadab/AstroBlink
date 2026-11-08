"use client";

/**
 * Project page with picture selection: the sky fields this project asks you to
 * inspect. Choosing a field opens the observatory with that field and project
 * context, so each tag is recorded against both.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Telescope } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { contributedPictureIds } from "@/lib/contributions";
import { formatDecDms, formatRaHms } from "@/lib/coords";
import { getProject, observatoryHref, picturesFor } from "@/lib/mock/projectCatalog";
import { useEffect, useState } from "react";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const project = getProject(params.id);
  const session = useSession();
  const userId = session.status === "authenticated" ? session.user.id : undefined;
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId && project) setDone(contributedPictureIds(userId, project.id));
  }, [userId, project]);

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg text-slate-100">Project not found.</p>
        <Link href="/projects" className="mt-3 inline-block text-sm text-cyan-300 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const pictures = picturesFor(project.id);
  const doneCount = pictures.filter((p) => done.has(p.id)).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <Link href="/projects" className="inline-flex w-fit items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
        <ArrowLeft size={13} aria-hidden="true" /> All projects
      </Link>

      <header className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6">
        <span className="w-fit rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200/90">
          {project.category}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{project.name}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-300">{project.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={pictures.length ? Math.round((doneCount / pictures.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label="Your progress in this project">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${pictures.length ? (doneCount / pictures.length) * 100 : 0}%` }} />
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-400">
            {doneCount} of {pictures.length} fields contributed by you
          </span>
        </div>
      </header>

      <section aria-labelledby="pictures-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="pictures-heading" className="text-lg font-semibold text-slate-100">Select a picture</h2>
          <p className="text-xs text-slate-400">Each field shows four epochs of SPHEREx data. Pick one to start tagging.</p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pictures.map((pic) => {
            const contributed = done.has(pic.id);
            return (
              <li key={pic.id}>
                <Link
                  href={observatoryHref(pic)}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4 transition hover:border-cyan-400/40 hover:bg-slate-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {/* Placeholder frame: no imagery until SPHEREx tiles are served. */}
                  <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/60">
                    <Telescope size={22} aria-hidden="true" className="text-slate-600" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{pic.title}</p>
                      <p className="font-mono text-[11px] tabular-nums text-slate-400">
                        {formatRaHms(pic.ra)} · {formatDecDms(pic.dec)}
                      </p>
                    </div>
                    {contributed ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                        <Check size={11} aria-hidden="true" /> Contributed
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">Open</span>
                    )}
                  </div>
                  <p className="mt-auto font-mono text-[11px] text-slate-500">
                    FoV {pic.fovArcmin}′ · {pic.epochCount} epochs
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
