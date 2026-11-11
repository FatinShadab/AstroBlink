import { cn } from "@/lib/utils/cn";

/** AstroBlink mark: a ring with a bright dot. Geometric only, no NASA marks (rules §2.3). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0 text-primary", className)}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="15.5" cy="8.5" r="2.25" fill="var(--accent)" />
    </svg>
  );
}
