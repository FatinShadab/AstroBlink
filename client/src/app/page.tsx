import Link from "next/link";

/**
 * Landing page — "/" route.
 *
 * Placeholder. The real page will have:
 * - Hero with SPHEREx imagery
 * - "Start Classifying" CTA
 * - Stats counter (classifications, candidates)
 * - How-it-works section
 *
 * See PRD §FR-1 (Subject Display & Blink Comparison).
 */
export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h1 className="text-5xl font-bold tracking-tight">
        🔭 AstroBlink
      </h1>
      <p className="text-xl text-gray-400 max-w-xl text-center">
        Help discover the next Pluto. Blink-compare multi-epoch SPHEREx images
        to find moving objects, brown dwarfs, and candidate planets.
      </p>
      <div className="flex gap-4">
        <Link
          href="/classify"
          className="px-6 py-3 bg-astro-accent text-white rounded-lg font-medium hover:opacity-90 transition"
        >
          Start Classifying
        </Link>
        <Link
          href="/tutorial"
          className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg font-medium hover:bg-astro-surface transition"
        >
          Tutorial
        </Link>
      </div>
      <Link
        href="/discoveries"
        className="text-astro-accent underline underline-offset-4 hover:opacity-80"
      >
        View Discoveries →
      </Link>
    </div>
  );
}
