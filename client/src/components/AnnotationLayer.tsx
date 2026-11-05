"use client";

/**
 * AnnotationLayer — citizen-science tagging panel.
 *
 * A click on the blink canvas (in tag mode) places a pending reticle; this panel
 * classifies it, submits it through the API client, and keeps tagged candidates
 * (with their 102-band spectrum snapshot) for JSON / CSV export.
 */

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import {
  ANNOTATION_CATEGORIES,
  type AnnotationCategory,
  type SpectrumResponse,
  type TaggedCandidate,
} from "@/lib/api/types";
import type { ClassificationResponse } from "@/lib/api/generated/types";
import ConsensusBadge from "@/components/ConsensusBadge";

export interface PendingMark {
  x: number;
  y: number;
  ra: number;
  dec: number;
  epochIndex: number;
  epoch: number;
}

export interface AnnotationLayerProps {
  subjectId: string | null;
  pending: PendingMark | null;
  onClearPending: () => void;
  spectrum: SpectrumResponse | null;
  candidates: TaggedCandidate[];
  onSaved: (candidate: TaggedCandidate, result: ClassificationResponse) => void;
  onRemove: (id: string) => void;
  onExport: (kind: "json" | "csv") => void;
  consensus: { status: string; count: number; reliability?: number } | null;
  sessionStartMs: number;
  epochLabel: string;
}

export default function AnnotationLayer({
  subjectId,
  pending,
  onClearPending,
  spectrum,
  candidates,
  onSaved,
  onRemove,
  onExport,
  consensus,
  sessionStartMs,
  epochLabel,
}: AnnotationLayerProps) {
  const [category, setCategory] = useState<AnnotationCategory>("fast_mover");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!pending || !subjectId) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.submitClassification({
        subject_id: subjectId,
        category,
        marks: [{ epoch: pending.epoch, pixel_x: pending.x, pixel_y: pending.y, ra: pending.ra, dec: pending.dec }],
        load_time_ms: Math.max(100, Date.now() - sessionStartMs),
      });
      const candidate: TaggedCandidate = {
        id: `tag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        subject_id: subjectId,
        category,
        notes: notes.trim(),
        epoch: pending.epoch,
        pixel_x: pending.x,
        pixel_y: pending.y,
        ra: pending.ra,
        dec: pending.dec,
        created_at: new Date().toISOString(),
        spectrum,
        submit_result: result,
      };
      onSaved(candidate, result);
      setNotes("");
      setMessage(result.message ?? "Saved");
      onClearPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Tag a source</span>
          {consensus && <ConsensusBadge status={consensus.status} count={consensus.count} reliability={consensus.reliability} />}
        </div>

        {pending ? (
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-3 font-mono text-[11px] leading-relaxed tabular-nums text-slate-200">
            <div>
              {epochLabel} · px ({Math.floor(pending.x)}, {Math.floor(pending.y)})
            </div>
            <div className="text-slate-400">
              RA {pending.ra.toFixed(5)}° · Dec {pending.dec.toFixed(5)}°
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-3 text-[11px] text-slate-400">
            Enable tag mode, then click a source on the canvas to place a reticle.
          </p>
        )}

        <fieldset className="flex flex-col gap-1.5" disabled={!pending || submitting}>
          <legend className="sr-only">Classification</legend>
          {ANNOTATION_CATEGORIES.map((c) => (
            <label
              key={c.value}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                category === c.value ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-50" : "border-white/10 bg-slate-900/50 text-slate-300 hover:border-white/20"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <input type="radio" name="annotation-category" value={c.value} checked={category === c.value} onChange={() => setCategory(c.value)} className="mt-0.5 accent-cyan-400" />
              <span>
                <span className="block font-medium">{c.label}</span>
                <span className="block text-[10px] text-slate-400">{c.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-xs text-slate-300">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            disabled={!pending || submitting}
            rows={2}
            placeholder="What did you see across epochs?"
            className="resize-none rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!pending || submitting || !subjectId}
            className="flex-1 rounded-lg bg-cyan-500/25 px-3 py-2 text-xs font-semibold text-cyan-50 ring-1 ring-cyan-400/50 transition hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit tag"}
          </button>
          {pending && (
            <button type="button" onClick={onClearPending} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
              Clear
            </button>
          )}
        </div>
        {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
        {message && !error && <p role="status" className="text-[11px] text-emerald-300">{message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Your tags · {candidates.length}</span>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onExport("json")} disabled={!candidates.length} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-40">
              <Download size={12} /> JSON
            </button>
            <button type="button" onClick={() => onExport("csv")} disabled={!candidates.length} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-40">
              <Download size={12} /> CSV
            </button>
          </div>
        </div>
        <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
          {candidates.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-2.5 py-2 text-[11px]">
              <span className="min-w-0">
                <span className="block font-medium text-slate-100">{ANNOTATION_CATEGORIES.find((a) => a.value === c.category)?.label}</span>
                <span className="block font-mono tabular-nums text-slate-400">
                  E{c.epoch} · px ({Math.floor(c.pixel_x)}, {Math.floor(c.pixel_y)})
                </span>
              </span>
              <button type="button" onClick={() => onRemove(c.id)} aria-label="Remove tag" className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-rose-300">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
          {!candidates.length && <li className="text-[11px] text-slate-500">No tags yet.</li>}
        </ul>
      </div>
    </div>
  );
}
