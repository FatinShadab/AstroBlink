import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg" | "answer";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none select-none";

/*
 * Glass look (globals.css `.glass`). Rules §3.7 requires a 44×44 touch target;
 * md and up are tall enough, sm extends an invisible hit area with ::before.
 */
const hit =
  "before:absolute before:left-0 before:right-0 before:content-[''] before:-top-[2px] before:-bottom-[2px]";

const variants: Record<ButtonVariant, string> = {
  primary: "glass glass-primary text-on-primary",
  secondary: "glass text-text-primary",
  tertiary:
    "bg-transparent text-primary transition-colors duration-150 hover:bg-white/[0.07] active:bg-white/[0.12]",
  danger: "glass glass-danger text-on-danger",
  icon: "glass text-text-secondary hover:text-text-primary aria-pressed:text-text-primary",
};

const sizes: Record<ButtonSize, string> = {
  sm: cn("h-10 px-4 text-body-sm font-semibold", hit),
  md: "h-12 px-6 text-body font-semibold",
  lg: "h-14 px-8 text-body-lg font-semibold",
  answer: "min-h-[4.5rem] px-6 text-body-lg font-semibold",
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
  return cn(base, variants[variant], iconOnly ? "h-12 w-12 p-0" : sizes[size], className);
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
