import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg" | "answer";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition-colors duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)] disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none select-none";

/*
 * Visual heights follow design §9.1. Rules §3.7 requires a 44×44 touch target,
 * so sm and md extend an invisible hit area with ::before (the visible size is unchanged).
 */
const hit =
  "before:absolute before:left-0 before:right-0 before:content-[''] before:-top-[6px] before:-bottom-[6px] md:before:-top-[2px] md:before:-bottom-[2px]";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed",
  secondary: "bg-surface-2 text-text-primary border border-border hover:border-border-strong hover:bg-surface-3 active:border-border-strong",
  tertiary: "bg-transparent text-primary hover:bg-primary-subtle",
  danger: "bg-danger text-on-danger hover:opacity-90",
  icon: "bg-transparent text-text-secondary hover:bg-surface-2 aria-pressed:text-text-primary",
};

const sizes: Record<ButtonSize, string> = {
  sm: cn("h-8 px-3 text-body-sm font-medium", hit),
  md: cn("h-10 px-4 text-body font-medium", hit),
  lg: "h-12 px-6 text-body font-semibold",
  answer: "min-h-16 px-4 text-body font-semibold",
};

/** Class string for a button look, also used on <Link> elements. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const iconOnly = variant === "icon";
  return cn(base, variants[variant], iconOnly ? "h-11 w-11 p-0" : sizes[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
