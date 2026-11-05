import type { ReactNode } from "react";

/** Translucent HUD panel with a soft specular top highlight. */
export default function GlassPanel({
  title,
  eyebrow,
  children,
  className = "",
  actions,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-white/5 px-3.5 py-2.5">
          <div className="min-w-0">
            {eyebrow && <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">{eyebrow}</p>}
            {title && <h2 className="truncate text-sm font-semibold text-slate-100">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-3.5">{children}</div>
    </section>
  );
}
