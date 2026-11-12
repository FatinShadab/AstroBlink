import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The project's text sizes (text-body, text-caption, …) are custom tokens. Without this, the merge
 * reads `text-body` as a colour and drops a text colour such as `text-on-primary` placed before it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["display", "h1", "h2", "h3", "h4", "body-lg", "body", "body-sm", "caption", "mono"],
        },
      ],
    },
  },
});

/** Merge conditional class names; later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
