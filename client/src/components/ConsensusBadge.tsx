/**
 * ConsensusBadge — Displays consensus status for a candidate.
 *
 * Shows classification count, consensus reliability, and status icon.
 * See PRD §FR-3 (Consensus Pipeline), §FR-4.4 (Badges).
 */
export default function ConsensusBadge({
  status = "new",
  count = 0,
}: {
  status?: string;
  count?: number;
}) {
  const colors: Record<string, string> = {
    new: "bg-gray-600",
    under_review: "bg-amber-600",
    confirmed: "bg-green-600",
    rejected: "bg-red-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${colors[status] || colors.new}`}
    >
      {status} ({count})
    </span>
  );
}
