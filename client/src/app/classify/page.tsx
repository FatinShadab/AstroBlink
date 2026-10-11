"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import BandSelector, { type Band } from "@/components/BandSelector";
import BlinkCanvas, { type ClickedMark } from "@/components/BlinkCanvas";
import { api } from "@/lib/api/client";

interface SubjectData {
  id: string;
  ra_deg: number;
  dec_deg: number;
  size_deg: number;
  epochs: number[];
  tile_urls: Record<string, string>;
  wcs_urls?: Record<string, string>;
  classification_count?: number;
  retired?: boolean;
}

interface ClassificationResult {
  classification_id: string;
  subject_id: string;
  category: string;
  marks_count: number;
  subject_classification_count: number;
  subject_retired: boolean;
  badges_earned: string[];
  message: string;
}

const CATEGORIES = [
  { value: "asteroid_neo", label: "Asteroid / NEO" },
  { value: "comet", label: "Comet" },
  { value: "brown_dwarf", label: "Brown Dwarf" },
  { value: "planet_x_candidate", label: "Planet X Candidate" },
  { value: "artifact", label: "Artifact" },
  { value: "nothing", label: "Nothing Here" },
];

export default function ClassifyPage() {
  const [subject, setSubject] = useState<SubjectData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentBand, setCurrentBand] = useState<Band>("swir");
  const [epochIdx, setEpochIdx] = useState<number>(0);
  const [autoBlink, setAutoBlink] = useState<boolean>(true);
  const [category, setCategory] = useState<string>("asteroid_neo");

  const [lastMark, setLastMark] = useState<ClickedMark | null>(null);
  const [submitResult, setSubmitResult] = useState<ClassificationResult | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadTimestampRef = useRef<number>(Date.now());

  const loadNextSubject = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastMark(null);
    setSubmitResult(null);
    try {
      const data = (await api.getNextSubject()) as SubjectData;
      setSubject(data);
      setEpochIdx(0);
      loadTimestampRef.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subject");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNextSubject();
  }, [loadNextSubject]);

  // Auto-blink timer: alternates epochs within the same selected band
  useEffect(() => {
    if (!autoBlink || !subject || subject.epochs.length < 2) return;
    const timer = setInterval(() => {
      setEpochIdx((prev) => (prev + 1) % subject.epochs.length);
    }, 800);
    return () => clearInterval(timer);
  }, [autoBlink, subject]);

  const currentEpoch = subject?.epochs[epochIdx] ?? 1;

  const handleImageClick = async (pixelX: number, pixelY: number) => {
    if (!subject || submitting) return;

    const ra = Number(
      (((subject.ra_deg + (pixelX / 128 - 0.5) * subject.size_deg) % 360) + 360) % 360
    );
    const dec = Number(
      Math.max(-90, Math.min(90, subject.dec_deg + (0.5 - pixelY / 128) * subject.size_deg)).toFixed(6)
    );
    const roundedRa = Number(ra.toFixed(6));

    const mark: ClickedMark = {
      epoch: currentEpoch,
      pixel_x: pixelX,
      pixel_y: pixelY,
      ra: roundedRa,
      dec,
    };
    setLastMark(mark);
    setSubmitting(true);
    setError(null);

    try {
      const loadTimeMs = Math.max(100, Date.now() - loadTimestampRef.current);
      const effectiveCategory = category === "nothing" ? "asteroid_neo" : category;
      const res = (await api.submitClassification({
        subject_id: subject.id,
        category: effectiveCategory,
        marks: [mark],
        load_time_ms: loadTimeMs,
      })) as ClassificationResult;

      setSubmitResult(res);
      setSubject((prev) =>
        prev
          ? {
              ...prev,
              classification_count: res.subject_classification_count,
              retired: res.subject_retired,
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen gap-6 p-6 md:p-10 text-gray-100">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Blink Comparator</h1>
        <p className="text-gray-400 max-w-xl text-sm">
          Blink multi-epoch images of the same spectral band and click on any moving source to submit a classification.
        </p>
      </div>

      {loading && (
        <div className="p-8 text-gray-400 font-mono">Loading next subject...</div>
      )}

      {error && (
        <div
          role="alert"
          className="w-full max-w-xl p-4 rounded border border-red-500/60 bg-red-950/50 text-red-200 text-sm"
        >
          Error: {error}
        </div>
      )}

      {submitResult && lastMark && (
        <div
          role="status"
          className="w-full max-w-xl p-4 rounded border border-emerald-500/60 bg-emerald-950/60 text-emerald-200 text-sm space-y-1"
        >
          <div className="font-semibold">
            ✓ {submitResult.message} (ID: {submitResult.classification_id})
          </div>
          <div className="font-mono text-xs text-emerald-300">
            Epoch {lastMark.epoch} · Pixel ({lastMark.pixel_x}, {lastMark.pixel_y}) · Sky RA={lastMark.ra}°, Dec={lastMark.dec}° · Category={submitResult.category} · Total Classifications={submitResult.subject_classification_count}
          </div>
        </div>
      )}

      {subject && !loading && (
        <div className="flex flex-col items-center gap-5 w-full max-w-xl">
          {/* Subject metadata bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded bg-astro-surface border border-gray-700 text-xs font-mono text-gray-300">
            <span>Subject: {subject.id.slice(0, 8)}…</span>
            <span>
              RA {subject.ra_deg.toFixed(3)}° · Dec {subject.dec_deg.toFixed(3)}°
            </span>
            <span>Classifications: {subject.classification_count ?? 0}</span>
          </div>

          {/* Controls row: Band selector + Category selector */}
          <div className="w-full flex flex-wrap items-center justify-between gap-4">
            <BandSelector currentBand={currentBand} onBandChange={setCurrentBand} />

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <span>Category:</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-1.5 rounded bg-astro-surface border border-gray-700 text-sm text-gray-100"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Main Blink Canvas (only blinks images of the active band) */}
          <BlinkCanvas
            tileUrls={subject.tile_urls}
            currentEpoch={currentEpoch}
            currentBand={currentBand}
            lastMark={lastMark}
            onImageClick={handleImageClick}
          />

          {/* Auto-blink toggle + Manual Epoch Slider */}
          <div className="w-full flex flex-col gap-3 p-4 rounded bg-astro-surface border border-gray-700">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setAutoBlink((prev) => !prev)}
                className={`px-4 py-2 rounded text-sm font-medium border transition ${
                  autoBlink
                    ? "bg-emerald-600 border-emerald-400 text-white"
                    : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {autoBlink ? "⏸ Auto-Blink: ON" : "▶ Auto-Blink: OFF"}
              </button>

              <span className="text-sm font-mono text-gray-300">
                Showing Epoch {currentEpoch} of {subject.epochs.length} ({currentBand.toUpperCase()})
              </span>

              <button
                type="button"
                onClick={() => void loadNextSubject()}
                className="px-3 py-2 rounded text-sm bg-gray-800 border border-gray-600 text-gray-200 hover:bg-gray-700 transition"
              >
                Next Subject →
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400">
                Epoch {subject.epochs[0]}
              </span>
              <input
                type="range"
                aria-label="Manual epoch slider"
                min={0}
                max={Math.max(0, subject.epochs.length - 1)}
                step={1}
                value={epochIdx}
                onChange={(e) => {
                  setAutoBlink(false);
                  setEpochIdx(Number(e.target.value));
                }}
                className="flex-1 accent-blue-500 cursor-pointer"
              />
              <span className="text-xs font-mono text-gray-400">
                Epoch {subject.epochs[subject.epochs.length - 1]}
              </span>
            </div>
          </div>

          {/* Side-by-side preview of both epochs for the active band */}
          <div className="w-full grid grid-cols-2 gap-4">
            {subject.epochs.map((ep, idx) => {
              const key = `${ep}_${currentBand}`;
              const url = subject.tile_urls[key];
              const isSelected = idx === epochIdx;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setAutoBlink(false);
                    setEpochIdx(idx);
                  }}
                  className={`flex flex-col items-center p-2 rounded border text-left transition ${
                    isSelected
                      ? "border-blue-400 bg-blue-950/30"
                      : "border-gray-700 bg-astro-surface hover:border-gray-500"
                  }`}
                >
                  <span className="text-xs font-mono mb-1 text-gray-300">
                    Epoch {ep} ({currentBand.toUpperCase()})
                  </span>
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`Thumbnail Epoch ${ep} ${currentBand}`}
                      className="w-24 h-24 object-contain rounded border border-gray-800"
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
