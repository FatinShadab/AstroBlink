import { cn } from "@/lib/utils/cn";

/** Design §9.5: surface-1 fill, 1px border, radius-md, 24px padding (16 on mobile). */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-border bg-surface-1 p-4 md:p-6",
        className,
      )}
      {...props}
    />
  );
}

export interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: string;
}

/** Design §9.6: caption label → Space Grotesk 32px value (tabular) → optional delta. */
export function KpiTile({ label, value, delta }: KpiTileProps) {
  return (
    <Card className="flex min-h-[120px] flex-col gap-1">
      <p className="text-caption font-medium text-text-secondary">{label}</p>
      <p className="font-display text-[2rem] leading-10 font-semibold tabular-nums text-text-primary">
        {value}
      </p>
      {delta && <p className="text-caption text-text-muted">{delta}</p>}
    </Card>
  );
}

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "primary";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-text-secondary",
  accent: "bg-accent-subtle text-accent",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  primary: "bg-primary-subtle text-primary",
};

/** Design §9.8: 22px high pill, caption text. Always text, never colour alone. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full px-2 text-caption font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Design §9.10 banner: icon + words, semantic subtle fill. */
export function Banner({
  tone = "warning",
  icon,
  children,
  action,
}: {
  tone?: "warning" | "danger" | "info";
  icon: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const styles = {
    warning: "bg-warning-subtle text-warning",
    danger: "bg-danger-subtle text-danger",
    info: "bg-accent-subtle text-accent",
  }[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-body-sm",
        styles,
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <p className="min-w-0 flex-1 text-text-primary">{children}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[var(--radius-md)] bg-surface-3", className)}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <h4 className="font-sans text-h4 font-medium text-text-primary">{title}</h4>
      <p className="max-w-[68ch] text-body-sm text-text-secondary">{body}</p>
      {action}
    </div>
  );
}

export function ProgressBar({
  label,
  value,
  max,
  valueLabel,
}: {
  label: string;
  value: number;
  max: number;
  valueLabel?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-body-sm font-medium text-text-primary">{label}</span>
        <span className="text-caption tabular-nums text-text-muted">
          {valueLabel ?? `${Math.round(pct)}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[250ms] ease-[cubic-bezier(0.2,0,0,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
