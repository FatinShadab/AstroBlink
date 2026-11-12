"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { PROJECTS } from "@/data/projects";
import {
  CERT_H,
  CERT_W,
  drawCertificate,
  type CertificateColours,
} from "@/lib/certificate/drawCertificate";
import { fill, formatDate } from "@/lib/i18n/format";
import { CERT_MIN_FIELDS, isCertificateEligible } from "@/lib/certificate/eligibility";
import { useLang, useT } from "@/lib/i18n/LangProvider";
import { myStats } from "@/lib/stats/selectors";
import { useUserStore } from "@/lib/state/useUserStore";

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Certificate preview with download (PNG) and print (design §8.10). */
export function CertificateView() {
  const { t } = useT();
  const { lang } = useLang();
  const user = useUserStore((s) => s.user);
  const classifications = useUserStore((s) => s.classifications);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stats = useMemo(() => myStats(classifications), [classifications]);
  const eligible = isCertificateEligible(stats.fieldsChecked);
  const name = user?.name ?? t("me.volunteer");
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = CERT_W;
    canvas.height = CERT_H;
    const colours: CertificateColours = {
      paper: cssVar("--cert-paper", "#fbf8f1"),
      ink: cssVar("--cert-ink", "#0b1220"),
      muted: cssVar("--cert-muted", "#4a5568"),
      accent: cssVar("--cert-accent", "#8a5a00"),
    };
    const usedProjects = PROJECTS.filter((p) => (stats.byProject[p.slug] ?? 0) > 0).map((p) =>
      t(p.titleKey),
    );
    const content = {
      brand: t("brand.name"),
      title: t("cert.title"),
      name,
      body: fill(t("cert.body"), { count: stats.fieldsChecked }),
      projectsLabel: t("cert.projects"),
      projects: usedProjects.length > 0 ? usedProjects : [t("cert.none")],
      dateLabel: t("cert.date"),
      dateText: formatDate(today, lang),
      credit: t("cert.credit"),
    };
    // Draw at once, then again with the AstroBlink logo when it has loaded (same origin, so the
    // canvas stays exportable).
    drawCertificate(ctx, content, colours);
    const logo = new Image();
    logo.onload = () => drawCertificate(ctx, content, colours, logo);
    logo.src = "/brand/astroblink-logo.png";
    return () => {
      logo.onload = null;
    };
  }, [name, stats.fieldsChecked, stats.byProject, lang, t, today]);

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "astroblink-certificate.png";
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">{t("cert.heading")}</h1>
      <div className="certificate-print mx-auto w-full max-w-[960px] overflow-hidden rounded-[var(--radius-md)] border border-border bg-cert-paper shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t("cert.preview")}
          className="block h-auto w-full"
        />
      </div>
      <p className="mx-auto max-w-[68ch] text-center text-caption text-text-muted">
        {t("cert.demoNote")}
      </p>
      {eligible ? (
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={download}>{t("cert.withdraw")}</Button>
          <Button variant="secondary" onClick={() => window.print()}>
            {t("cert.print")}
          </Button>
        </div>
      ) : (
        <p role="status" className="mx-auto max-w-[68ch] text-center text-body-sm text-text-secondary">
          {fill(t("cert.notEligible"), { min: CERT_MIN_FIELDS, count: stats.fieldsChecked })}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/me" className={buttonStyles({ variant: "tertiary" })}>
          {t("cert.back")}
        </Link>
      </div>
    </div>
  );
}
