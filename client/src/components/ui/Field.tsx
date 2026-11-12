import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
}

/** Design §9.2: 44px high, surface-2 fill, 1px border-strong, primary border on focus. */
export function Input({ invalid = false, mono = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-[var(--radius-sm)] border bg-surface-2 px-3 text-body text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none",
        invalid ? "border-danger" : "border-border hover:border-border-strong",
        mono && "font-mono tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/**
 * Design §9.3: 36px high, pill, selected = primary-subtle fill + primary border + leading check.
 * The 44px hit area is added with ::before (rules §3.7).
 */
export function Chip({ selected = false, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-body-sm font-medium before:absolute before:inset-x-0 before:-top-1.5 before:-bottom-1.5 before:content-['']",
        selected
          ? "border-primary bg-primary-subtle text-text-primary"
          : "border-border bg-surface-2 text-text-secondary hover:border-border-strong hover:text-text-primary",
        className,
      )}
      {...props}
    >
      {selected && (
        <span aria-hidden="true" className="text-primary">
          ✓
        </span>
      )}
      {children}
    </button>
  );
}
