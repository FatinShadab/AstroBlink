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
        "h-11 w-full rounded-[var(--radius-sm)] border bg-surface-2 px-3 text-body text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none",
        invalid ? "border-danger" : "border-border-strong",
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
 * Glass pill, 44px high (rules §3.7). Selected = lime-tinted glass + primary border + leading check.
 */
export function Chip({ selected = false, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "glass relative inline-flex h-11 items-center gap-2 rounded-full px-5 text-body font-medium",
        selected
          ? "border-primary! bg-primary-subtle! text-text-primary"
          : "text-text-secondary hover:text-text-primary",
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
