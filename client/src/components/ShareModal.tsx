"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  embedUrl: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ShareModal({ open, onClose, shareUrl, embedUrl }: ShareModalProps) {
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const iframe = `<iframe src="${embedUrl}" width="640" height="640" style="border:0;border-radius:16px" loading="lazy" title="AstroBlink blink comparator"></iframe>`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const flash = (kind: "link" | "embed", ok: boolean) => {
    if (ok) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/90 p-5 text-slate-100 shadow-2xl backdrop-blur-xl focus:outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="share-title" className="text-base font-semibold">Share this view</h2>
            <p className="text-xs text-slate-400">Coordinates, FoV, band, mode and playback are encoded in the URL.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100">
            <X size={16} />
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-300" htmlFor="share-url">Shareable link</label>
        <div className="mb-2 flex gap-2">
          <input id="share-url" readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-[11px] text-slate-200" />
          <button
            type="button"
            onClick={async () => flash("link", await copyText(shareUrl))}
            className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-medium text-cyan-100 ring-1 ring-cyan-400/50 hover:bg-cyan-500/30"
          >
            {copied === "link" ? "Copied" : "Copy"}
          </button>
        </div>

        <label className="mb-1 mt-4 block text-xs font-medium text-slate-300" htmlFor="embed-snippet">Embed &lt;iframe&gt;</label>
        <div className="flex gap-2">
          <textarea id="embed-snippet" readOnly rows={3} value={iframe} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 resize-none rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-[11px] text-slate-200" />
          <button
            type="button"
            onClick={async () => flash("embed", await copyText(iframe))}
            className="self-start rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-100 ring-1 ring-amber-400/50 hover:bg-amber-500/30"
          >
            {copied === "embed" ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">The embed link renders a compact blinker with the outer chrome hidden.</p>
      </div>
    </div>
  );
}
