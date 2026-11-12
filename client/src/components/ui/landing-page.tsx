"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Globe from "@/components/ui/globe";
import { cn } from "@/lib/utils";

/** One full-height section of the scroll landing. */
export interface ScrollSection {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  description: string;
  align?: "left" | "center" | "right";
  features?: { title: string; description: string }[];
  actions?: {
    label: string;
    variant: "primary" | "secondary";
    href?: string;
    onClick?: () => void;
  }[];
}

export interface GlobePosition {
  top: string;
  left: string;
  scale: number;
}

/** Every user-visible string the component adds itself. Pass translated values (rules §4.4). */
export interface ScrollLabels {
  interactive: string;
  scrollToExplore: string;
  /** Contains {name}, e.g. "Go to {name}". */
  goTo: string;
  /** Contains {n}, e.g. "Section {n}". */
  sectionFallback: string;
  progress: string;
}

export interface ScrollGlobeProps {
  sections: ScrollSection[];
  labels: ScrollLabels;
  globeConfig?: { positions: GlobePosition[] };
  className?: string;
}

const DEFAULT_POSITIONS: GlobePosition[] = [
  { top: "50%", left: "75%", scale: 1.4 }, // hero: right side, balanced
  { top: "25%", left: "50%", scale: 0.9 }, // second section: top, subtle
  { top: "15%", left: "90%", scale: 2 }, // third section: right, medium
  { top: "50%", left: "50%", scale: 1.8 }, // fourth section: centre backdrop
];

const parsePercent = (value: string): number => parseFloat(value.replace("%", ""));

const fill = (template: string, value: string | number) =>
  template.replace("{name}", String(value)).replace("{n}", String(value));

/** Scroll-linked globe with section navigation. Scroll state is read in rAF callbacks, not in effect bodies. */
export default function ScrollGlobe({
  sections,
  labels,
  globeConfig = { positions: DEFAULT_POSITIONS },
  className,
}: ScrollGlobeProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const frame = useRef<number | null>(null);

  const positions = useMemo(
    () =>
      globeConfig.positions.map((p) => ({
        top: parsePercent(p.top),
        left: parsePercent(p.left),
        scale: p.scale,
      })),
    [globeConfig.positions],
  );
  const current = positions[Math.min(activeSection, positions.length - 1)] ?? {
    top: 50,
    left: 50,
    scale: 1,
  };
  const onLastSection = activeSection === positions.length - 1;

  useEffect(() => {
    const update = () => {
      frame.current = null;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0);

      const center = window.innerHeight / 2;
      let closest = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      sectionRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index;
        }
      });
      setActiveSection(closest);
    };
    const schedule = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const initial = requestAnimationFrame(update);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(initial);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [sections.length]);

  function scrollToSection(index: number) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sectionRefs.current[index]?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  }

  return (
    <div
      className={cn("relative w-full overflow-x-hidden bg-background text-foreground", className)}
    >
      {/* Progress bar: decorative, the sections carry the content */}
      <div aria-hidden="true" className="fixed top-0 left-0 z-50 h-0.5 w-full bg-border">
        <div
          className="h-full origin-left bg-linear-to-r from-primary via-primary-pressed to-primary-subtle transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${scrollProgress})` }}
        />
      </div>

      {/* Section navigation (desktop) */}
      <nav
        aria-label={labels.progress}
        className="fixed top-1/2 right-4 z-40 hidden -translate-y-1/2 sm:flex lg:right-8"
      >
        <ul className="flex flex-col gap-4 lg:gap-6">
          {sections.map((section, index) => {
            const name = section.badge ?? fill(labels.sectionFallback, index + 1);
            return (
              <li key={section.id} className="group relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1/2 right-6 -translate-y-1/2 rounded-md border border-border bg-surface-1 px-3 py-1 text-caption font-medium whitespace-nowrap text-text-primary",
                    activeSection === index ? "animate-fade-out-label" : "opacity-0",
                  )}
                >
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => scrollToSection(index)}
                  aria-label={fill(labels.goTo, name)}
                  aria-current={activeSection === index ? "true" : undefined}
                  className={cn(
                    "relative size-3 rounded-full border-2 transition-all duration-300 hover:scale-125",
                    activeSection === index
                      ? "border-primary bg-primary"
                      : "border-text-muted bg-transparent hover:border-primary",
                  )}
                />
              </li>
            );
          })}
        </ul>
      </nav>

      {/* The globe: fixed behind the text, moves between positions as sections change */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed z-10 transition-[transform,opacity] duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform",
          onLastSection ? "opacity-40" : "opacity-80",
          "max-md:opacity-30", // on small screens the planet sits behind text, so it is fainter
        )}
        style={{
          transform: `translate3d(${current.left}vw, ${current.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${current.scale}, ${current.scale}, 1)`,
        }}
      >
        <div className="scale-75 sm:scale-90 lg:scale-100">
          <Globe />
        </div>
      </div>

      {sections.map((section, index) => {
        const Heading = index === 0 ? "h1" : "h2";
        return (
          <section
            key={section.id}
            id={section.id}
            ref={(el) => {
              sectionRefs.current[index] = el;
            }}
            className={cn(
              "relative z-20 flex min-h-screen w-full flex-col justify-center overflow-hidden px-4 py-12 sm:px-6 sm:py-16 md:px-8 lg:px-12 lg:py-20",
              section.align === "center" && "items-center text-center",
              section.align === "right" && "items-end text-right",
              (!section.align || section.align === "left") && "items-start text-left",
            )}
          >
            <div className="w-full max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl">
              <Heading
                className={cn(
                  "mb-6 leading-[1.1] font-bold tracking-tight sm:mb-8",
                  index === 0
                    ? "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
                    : "text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
                )}
              >
                <span className="block text-text-primary">{section.title}</span>
                {section.subtitle && (
                  <span className="block text-[0.6em] font-medium tracking-wider text-text-secondary">
                    {section.subtitle}
                  </span>
                )}
              </Heading>

              <div
                className={cn(
                  "mb-8 text-base leading-relaxed font-light text-text-secondary sm:mb-10 sm:text-lg lg:text-xl",
                  section.align === "center" && "mx-auto text-center",
                )}
              >
                <p className="mb-3 sm:mb-4">{section.description}</p>
                {index === 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-muted sm:mt-6 sm:gap-4 sm:text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-1.5 animate-pulse rounded-full bg-primary"
                      />
                      {labels.interactive}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-1.5 animate-pulse rounded-full bg-primary"
                      />
                      {labels.scrollToExplore}
                    </span>
                  </div>
                )}
              </div>

              {section.features && (
                <ul className="mb-8 grid gap-3 sm:mb-10 sm:gap-4">
                  {section.features.map((feature) => (
                    <li
                      key={feature.title}
                      className="rounded-[var(--radius-md)] border border-border bg-card p-4 transition-colors duration-300 hover:border-primary/30 sm:p-5 lg:p-6"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <span
                          aria-hidden="true"
                          className="mt-2 size-2 shrink-0 rounded-full bg-primary/60"
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <h3 className="text-base font-semibold text-card-foreground sm:text-lg">
                            {feature.title}
                          </h3>
                          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {section.actions && (
                <div
                  className={cn(
                    "flex flex-col flex-wrap gap-3 sm:flex-row sm:gap-4",
                    section.align === "center" && "justify-center",
                    section.align === "right" && "justify-end",
                    (!section.align || section.align === "left") && "justify-start",
                  )}
                >
                  {section.actions.map((action) => {
                    const className = cn(
                      "inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-sm)] px-6 text-sm font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:text-base",
                      action.variant === "primary"
                        ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                        : "border border-border-strong bg-surface-2 text-foreground hover:bg-surface-3",
                    );
                    return action.href ? (
                      <Link key={action.label} href={action.href} className={className}>
                        {action.label}
                      </Link>
                    ) : (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className={className}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
