import Image from "next/image";
import { cn } from "@/lib/utils";

/** AstroBlink logo (public/brand/astroblink-logo.png): the A, the blue orbit, the star and the wordmark. */
const RATIO = 705 / 445;

export function Logo({
  height = 36,
  className,
  alt = "AstroBlink",
}: {
  height?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src="/brand/astroblink-logo.png"
      alt={alt}
      width={Math.round(height * RATIO)}
      height={height}
      className={cn("h-auto w-auto shrink-0", className)}
      style={{ height, width: "auto" }}
      priority
    />
  );
}
