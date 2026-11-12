/*
 * Types for the <model-viewer> web component (loaded from jsDelivr, see components/ui/globe.tsx).
 * Only the attributes the landing page uses are declared. Boolean attributes are passed as "" when on.
 */
import type { HTMLAttributes } from "react";

interface ModelViewerAttributes extends HTMLAttributes<HTMLElement> {
  src: string;
  alt?: string;
  "auto-rotate"?: string;
  "rotation-per-second"?: string;
  "camera-orbit"?: string;
  "disable-zoom"?: string;
  "disable-pan"?: string;
  "interaction-prompt"?: string;
  "shadow-intensity"?: string;
  loading?: "auto" | "lazy" | "eager";
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}
