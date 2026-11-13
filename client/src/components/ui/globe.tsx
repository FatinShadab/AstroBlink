"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/a11y/useReducedMotion";

/*
 * Moving planet for the scroll landing: an Earth 3D model (public/models/earth.glb).
 * The model is CC-BY-4.0: author Stéphane Agullo (sa3d), via Sketchfab. Credit is on the about page.
 * The file is a slimmed copy of the original (shared buffers, 16-bit indices and normals) so it stays
 * under the 25 MB per-file limit of Cloudflare Pages; the picture is the same.
 * The viewer is Google's <model-viewer> (Apache-2.0), loaded from jsDelivr at a pinned version.
 * Decorative: the sections carry the content, so the viewer is hidden from assistive technology.
 * It rotates slowly; reduced motion (OS or in-app setting) turns the rotation off.
 */
const MODEL_VIEWER_URL =
  "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";

export default function Globe({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();

  // Add the viewer script once, in the head (a <script> rendered by React would not run).
  useEffect(() => {
    if (customElements.get("model-viewer")) return;
    if (document.querySelector(`script[src="${MODEL_VIEWER_URL}"]`)) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = MODEL_VIEWER_URL;
    document.head.appendChild(script);
  }, []);

  return (
    // A solid disc behind the model, so the starfield never shows through the planet.
    <div aria-hidden="true" className={cn("relative size-[250px] animate-planet-float", className)}>
      <span aria-hidden="true" className="absolute inset-0 rounded-full bg-bg" />
      <model-viewer
        src="/models/earth.glb"
        loading="eager"
        {...(reducedMotion ? {} : { "auto-rotate": "", "rotation-per-second": "6deg" })}
        camera-orbit="0deg 75deg 105%"
        disable-zoom=""
        disable-pan=""
        interaction-prompt="none"
        shadow-intensity="0"
        className="relative size-full bg-transparent"
      />
    </div>
  );
}
