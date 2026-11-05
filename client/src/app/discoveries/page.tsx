"use client";

/**
 * /discoveries — crowd candidates (seeded community history) plus the tags this
 * viewer has saved locally, with JSON / CSV export.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import type { CandidateResponse } from "@/lib/api/generated/types";
import { ANNOTATION_CATEGORIES, type TaggedCandidate } from "@/lib/api/types";
import ConsensusBadge from "@/components/ConsensusBadge";
import GlassPanel from "@/components/GlassPanel";
import { candidatesToCsv, candidatesToJson, downloadText } from "@/lib/export";

const TAG_STORAGE_KEY = "astroblink.tags.v1";

export default function DiscoveriesPage() {
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [tags, setTags] = useState<TaggedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listCandidates()
      .then((res) => {
        if (!cancelled) setCandidates(res.candidates);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load candidates");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    try {
      const raw = window.localStorage.getItem(TAG_STORAGE_KEY);
      if (raw) setTags(JSON.parse(raw) as TaggedCandidate[]);
    } catch {
      // Storage unavailable — show only shared candidates.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Discoveries</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Candidate feed</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Crowd candidates from the community consensus pipeline, and your own saved tags.
          </p>
        </div>
        <Link href="/" className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700/70">
          ← Back to observatory
        </Link>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <GlassPanel
        eyebrow="Community"
        title={loading ? "Loading candidates…" : `${candidates.length} candidates`}
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {candidates.map((c) => (
            <li key={c.id} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize text-slate-100">
                    {c.category === "brown_dwarf" ? "Brown dwarf candidate" : c.category.replace(/_/g, " ")}
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-500">{c.subject_id}</p>
                </div>
                <ConsensusBadge status={c.status} count={c.n_classifications} reliability={c.mean_reliability} />
              </div>
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel
        eyebrow="Your tags"
        title={`${tags.length} saved on this device`}
        actions={
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={!tags.length}
              onClick={() => downloadText(`astroblink-candidates-${stamp()}.json`, "application/json", candidatesToJson(tags))}
              className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-40"
            >
              Export JSON
            </button>
            <button
              type="button"
              disabled={!tags.length}
              onClick={() => downloadText(`astroblink-candidates-${stamp()}.csv`, "text/csv", candidatesToCsv(tags))}
              className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-40"
            >
              Export CSV
            </button>
          </div>
        }
      >
        {tags.length ? (
          <ul className="divide-y divide-white/5 text-sm">
            {tags.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-200">{ANNOTATION_CATEGORIES.find((a) => a.value === t.category)?.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-slate-400">
                  E{t.epoch} · RA {t.ra.toFixed(4)}° · Dec {t.dec.toFixed(4)}°
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            No tags yet. Open the <Link className="text-cyan-300 underline-offset-2 hover:underline" href="/">observatory</Link>, enable tag mode and click a source.
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
