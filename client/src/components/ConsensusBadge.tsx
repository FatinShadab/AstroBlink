/**
 * ConsensusBadge — live crowd-consensus status for a subject or candidate.
 * See PRD §FR-3 (Consensus Pipeline), §FR-4.4 (Badges).
 */

const STYLES: Record<string, { cls: string; label: string }> = {
  new: { cls: "border-slate-500/40 bg-slate-500/15 text-slate-200", label: "New" },
  under_review: { cls: "border-amber-400/40 bg-amber-500/15 text-amber-200", label: "Under review" },
  confirmed: { cls: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200", label: "Confirmed" },
  rejected: { cls: "border-rose-400/40 bg-rose-500/15 text-rose-200", label: "Rejected" },
};

export default function ConsensusBadge({
  status = "new",
  count = 0,
  reliability,
}: {
  status?: string;
  count?: number;
  reliability?: number;
}) {
  const style = STYLES[status] ?? STYLES.new;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.cls}`}
      title="Crowd consensus"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {style.label}
      <span className="font-mono tabular-nums opacity-80">
        · {count} {count === 1 ? "vote" : "votes"}
        {reliability !== undefined ? ` · ${Math.round(reliability * 100)}%` : ""}
      </span>
    </span>
  );
}
