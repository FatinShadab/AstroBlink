/**
 * /discoveries — Discovery feed / candidate gallery.
 *
 * Placeholder. The real page will show:
 * - Grid of confirmed candidates with thumbnail tiles
 * - Filter by category, status, reliability
 * - Links to individual candidate detail views
 * - Export button (CSV / VOTable)
 *
 * See PRD §FR-5, ROADMAP P1-23.
 */
export default function DiscoveriesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-3xl font-bold">🌟 Discoveries</h1>
      <p className="text-gray-400 max-w-md text-center">
        Browse confirmed candidate objects found by the community.
      </p>
      <div className="text-gray-500">
        Candidate gallery — see PRD §FR-5
      </div>
    </div>
  );
}
