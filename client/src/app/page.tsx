import Observatory from "@/components/Observatory";

/**
 * "/" — the AstroBlink observatory HUD: coordinate resolver, multi-epoch blink
 * comparator, SPHEREx band controls, spectrophotometry drawer and annotation.
 * Query parameters (ra, dec, fov, band, mode, speed, embed, …) make views shareable.
 */
export default function HomePage() {
  return <Observatory />;
}
