import Link from "next/link";

const STEPS = [
  {
    title: "Open a picture",
    body: "A picture is one sky field seen across four epochs, roughly six months apart.",
  },
  {
    title: "Blink the epochs",
    body: "Press play or step through the epochs. Stars stay put; anything that moves or changes brightness stands out.",
  },
  {
    title: "Use difference imaging",
    body: "Switch to Difference to subtract the first epoch. Stationary stars cancel to grey, while movers become bright/dark pairs.",
  },
  {
    title: "Check the mask",
    body: "Turn on the contamination mask. Cosmic rays, saturated stars and hot pixels can look like real objects.",
  },
  {
    title: "Tag what you see",
    body: "Enable tag mode, click the source, choose a category and submit. Your tag counts toward the project.",
  },
];

export default function TutorialPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Tutorial</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">How to blink a sky field</h1>
        <p className="mt-2 text-sm text-slate-400">Five steps from opening a picture to submitting your first tag.</p>
      </header>

      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <span className="font-mono text-sm text-amber-300">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="text-sm font-medium text-slate-100">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link href="/projects" className="w-fit rounded-xl bg-cyan-500/25 px-4 py-2 text-sm font-semibold text-cyan-50 ring-1 ring-cyan-400/50 hover:bg-cyan-500/35">
        Start with a project
      </Link>
    </div>
  );
}
