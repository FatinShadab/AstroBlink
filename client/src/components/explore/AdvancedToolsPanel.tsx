"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Radix";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Badge, Card } from "@/components/ui/Surfaces";
import { DETECTORS } from "@/lib/sky/detectors";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { fill } from "@/lib/i18n/format";
import { useViewerUiStore } from "@/lib/state/useViewerUiStore";
import type { DiffStyle } from "@/lib/sky/modes";
import type { Detector, SpectrumPoint, StretchKind } from "@/lib/data/types";
import dynamic from "next/dynamic";
import { spectrumCsv } from "@/lib/sky/spectrumCsv";

const SpectrumChart = dynamic(() => import("./SpectrumChart").then((m) => m.SpectrumChart), {
  ssr: false,
  loading: () => <p className="text-body-sm text-text-muted">…</p>,
});

export interface AdvancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detector: Detector;
  onDetector: (d: Detector) => void;
  stretch: StretchKind;
  onStretch: (s: StretchKind) => void;
  frameLabels: string[];
  a: number;
  b: number;
  onA: (i: number) => void;
  onB: (i: number) => void;
  diffStyle: DiffStyle;
  onDiffStyle: (s: DiffStyle) => void;
  showFlags: boolean;
  onShowFlags: (on: boolean) => void;
  flagCount: number;
  spectrum: { points: SpectrumPoint[] | null; loading: boolean; error: string | null };
  pick: { x: number; y: number } | null;
  shareUrl: string;
  embedSnippet: string;
  onCopy: (text: string, doneKey: DictKey) => void;
  onDownloadPng: () => void;
}

const TABS = ["image", "compare", "flags", "spectrum", "overlays", "share"] as const;

/** Advanced tools (design §8.2): a tabbed card below the viewer. Collapsed by default; remembers its state. */
export function AdvancedToolsPanel(props: AdvancedProps) {
  const { t } = useT();
  const { open, onOpenChange } = props;
  const brightness = useViewerUiStore((s) => s.brightness);
  const contrast = useViewerUiStore((s) => s.contrast);
  const setBrightness = useViewerUiStore((s) => s.setBrightness);
  const setContrast = useViewerUiStore((s) => s.setContrast);
  const resetAdjust = useViewerUiStore((s) => s.resetAdjust);
  const stackIds = useViewerUiStore((s) => s.stackIds);
  const toggleStackId = useViewerUiStore((s) => s.toggleStackId);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-h4 font-medium text-text-primary">{t("explore.advanced")}</h2>
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          {open ? t("explore.hide") : t("explore.show")}
        </Button>
      </div>

      {open && (
        <Tabs defaultValue="image" className="flex flex-col">
          <TabsList aria-label={t("explore.advanced")}>
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(`explore.tab.${tab}` as DictKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="image" className="grid gap-6 md:grid-cols-12">
            <div className="flex flex-col gap-4 md:col-span-4">
              <SegmentedControl<Detector>
                label={t("explore.detector")}
                value={props.detector}
                onChange={props.onDetector}
                options={DETECTORS.map((d) => ({ value: d.id, label: d.id }))}
              />
              <p className="text-caption text-text-muted">
                {DETECTORS.map(
                  (d) => `${d.id} ${d.minUm.toFixed(2)}–${d.maxUm.toFixed(2)} μm`,
                ).join(" · ")}
              </p>
              <SegmentedControl<StretchKind>
                label={t("explore.stretch")}
                value={props.stretch}
                onChange={props.onStretch}
                options={[
                  { value: "linear", label: t("explore.stretch.linear") },
                  { value: "log", label: t("explore.stretch.log") },
                  { value: "asinh", label: t("explore.stretch.asinh") },
                ]}
              />
            </div>
            <div className="flex flex-col gap-4 md:col-span-8">
              <Slider
                label={t("explore.brightness")}
                min={-0.5}
                max={0.5}
                step={0.01}
                value={brightness}
                onChange={setBrightness}
              />
              <Slider
                label={t("explore.contrast")}
                min={0.25}
                max={3}
                step={0.05}
                value={contrast}
                onChange={setContrast}
              />
              <div>
                <Button variant="secondary" size="sm" onClick={resetAdjust}>
                  {t("explore.reset")}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compare" className="grid gap-6 md:grid-cols-12">
            <div className="flex flex-col gap-4 md:col-span-4">
              <FrameSelect
                label={t("explore.compareA")}
                value={props.a}
                labels={props.frameLabels}
                onChange={props.onA}
              />
              <FrameSelect
                label={t("explore.compareB")}
                value={props.b}
                labels={props.frameLabels}
                onChange={props.onB}
              />
              <SegmentedControl<DiffStyle>
                label={t("explore.diffStyle")}
                value={props.diffStyle}
                onChange={props.onDiffStyle}
                options={[
                  { value: "grey", label: t("explore.diff.grey") },
                  { value: "colour", label: t("explore.diff.colour") },
                ]}
              />
            </div>
            <fieldset className="flex flex-col gap-2 md:col-span-8">
              <legend className="mb-2 text-body-sm font-medium text-text-primary">
                {t("explore.stackFrames")}
              </legend>
              <p className="text-caption text-text-muted">{t("explore.stackHelp")}</p>
              {props.frameLabels.map((label, i) => (
                <label
                  key={label}
                  className="flex min-h-11 items-center gap-3 text-body-sm text-text-primary"
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--primary)]"
                    checked={stackIds.length === 0 || stackIds.includes(i)}
                    onChange={() => toggleStackId(i)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </TabsContent>

          <TabsContent value="flags" className="flex flex-col gap-4">
            <label className="flex min-h-11 items-center gap-3 text-body text-text-primary">
              <input
                type="checkbox"
                className="size-5 accent-[var(--primary)]"
                checked={props.showFlags}
                onChange={(e) => props.onShowFlags(e.target.checked)}
              />
              {t("explore.showFlags")}
            </label>
            <div className="flex items-center gap-3 text-body-sm text-text-secondary">
              <span
                aria-hidden="true"
                className="inline-block size-6 rounded-[4px] border border-border-strong"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, var(--data-6) 0 1px, transparent 1px 4px)",
                }}
              />
              {t("explore.flagLegend")}
            </div>
            <p className="text-body-sm text-text-secondary">
              {fill(t("explore.flagCount"), { count: props.flagCount })}
            </p>
          </TabsContent>

          <TabsContent value="spectrum" className="flex flex-col gap-4">
            <p className="text-body-sm text-text-secondary">{t("explore.spectrumHint")}</p>
            {props.pick === null && (
              <p className="text-body-sm text-text-muted">{t("explore.spectrumWaiting")}</p>
            )}
            {props.spectrum.loading && (
              <p className="text-body-sm text-text-muted">{t("common.loading")}</p>
            )}
            {props.spectrum.error && (
              <p className="text-body-sm text-danger">{t("explore.spectrumError")}</p>
            )}
            {props.spectrum.points && (
              <>
                <SpectrumChart points={props.spectrum.points} />
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      downloadText(
                        "spectrum.csv",
                        spectrumCsv(props.spectrum.points ?? []),
                        "text/csv",
                      )
                    }
                  >
                    {t("explore.exportCsv")}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="overlays" className="flex flex-col gap-3">
            {(["explore.overlayGaia", "explore.overlayWise"] as const).map((key) => (
              <label
                key={key}
                className="flex min-h-11 items-center gap-3 text-body text-text-muted"
              >
                <input type="checkbox" disabled className="size-5" />
                {t(key)}
                <Badge tone="accent" className="ml-1">
                  {t("common.comingSoon")}
                </Badge>
              </label>
            ))}
          </TabsContent>

          <TabsContent value="share" className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => props.onCopy(props.shareUrl, "explore.linkCopied")}
              >
                {t("explore.copyLink")}
              </Button>
              <Button variant="secondary" onClick={props.onDownloadPng}>
                {t("explore.downloadPng")}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-body-sm font-medium text-text-primary">{t("explore.embedCode")}</p>
              <pre className="overflow-x-auto rounded-[var(--radius-sm)] bg-surface-2 p-3 font-mono text-mono text-text-secondary">
                <code>{props.embedSnippet}</code>
              </pre>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => props.onCopy(props.embedSnippet, "explore.embedCopied")}
                >
                  {t("explore.copyEmbed")}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}

function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-body-sm font-medium text-text-primary">
      <span className="flex justify-between">
        {label}
        <span className="font-mono tabular-nums text-text-muted">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-[var(--primary)]"
      />
    </label>
  );
}

function FrameSelect({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: number;
  labels: string[];
  onChange: (i: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-body-sm font-medium text-text-primary">
      {label}
      <select
        className="h-11 rounded-[var(--radius-sm)] border border-border-strong bg-surface-2 px-3 text-body text-text-primary"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {labels.map((text, i) => (
          <option key={text} value={i}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
