"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/a11y/useReducedMotion";

/*
 * Moving planet for the scroll landing: an Earth 3D model (public/models/earth.glb).
 * The model is CC-BY-4.0: author Stéphane Agullo (sa3d), via Sketchfab. Credit is on the about page.
 * The viewer is Google's <model-viewer> (Apache-2.0), loaded from jsDelivr at a pinned version.
 * Decorative: the sections carry the content, so the viewer is hidden from assistive technology.
 * It rotates slowly; reduced motion (OS or in-app setting) turns the rotation off.
 * Without WebGL (disabled GPU, locked-down or sandboxed browsers) the viewer cannot start,
 * so the model's surface map (public/models/earth-texture.jpg, from earth.glb) spins on a
 * shaded disc instead and the script is never loaded.
 */
const MODEL_VIEWER_URL =
  "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";

/** True when the browser can create a WebGL context. The probe context is released straight away. */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// WebGL support does not change during a visit: probe once, never notify.
let webglSupport: boolean | undefined;
const getWebGLSupport = () => (webglSupport ??= hasWebGL());
const subscribeNever = () => () => {};

export default function Globe({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  // null on the server and during hydration, so both renders match; then the client answer.
  const webgl = useSyncExternalStore(subscribeNever, getWebGLSupport, () => null);

  // Add the viewer script once, in the head (a <script> rendered by React would not run).
  useEffect(() => {
    if (!webgl) return;
    if (customElements.get("model-viewer")) return;
    if (document.querySelector(`script[src="${MODEL_VIEWER_URL}"]`)) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = MODEL_VIEWER_URL;
    document.head.appendChild(script);
  }, [webgl]);

  return (
    // A solid disc behind the model, so the starfield never shows through the planet.
    <div aria-hidden="true" className={cn("relative size-[250px] animate-planet-float", className)}>
      <span aria-hidden="true" className="absolute inset-0 rounded-full bg-bg" />
      {webgl === true && (
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
      )}
      {webgl === false && (
        <>
          {/* The model's own surface map (public/models/earth-texture.jpg), scrolled to spin. */}
          <span
            className={cn(
              "absolute inset-[2.5%] rounded-full bg-[url(/models/earth-texture.jpg)] bg-[length:auto_100%] bg-repeat-x",
              !reducedMotion && "animate-earth-spin",
            )}
          />
          {/* Night side, highlight and atmosphere glow, so the flat map reads as a sphere. */}
          <span className="absolute inset-[2.5%] rounded-full bg-[radial-gradient(circle_at_35%_30%,transparent_40%,rgba(0,0,0,0.6)_100%)] shadow-[inset_-20px_-14px_36px_rgba(0,0,0,0.7),inset_6px_6px_16px_rgba(255,255,255,0.12),0_0_40px_rgba(86,180,233,0.25)]" />
        </>
      )}
    </div>
  );
}
