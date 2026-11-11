import { cn } from "@/lib/utils/cn";

/** Design §7.1 containers: wide 1440 (viewer pages), default 1200, read 720 (long text). */
const widths = {
  wide: "max-w-[1440px]",
  default: "max-w-[1200px]",
  read: "max-w-[720px]",
} as const;

export function Container({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof widths }) {
  return (
    <div
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[variant], className)}
      {...props}
    />
  );
}
