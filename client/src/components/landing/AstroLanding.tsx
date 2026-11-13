"use client";

import ScrollGlobe, { type ScrollSection } from "@/components/ui/landing-page";
import { PROJECTS } from "@/data/projects";
import { useT } from "@/lib/i18n/LangProvider";
import { HeroSearch } from "./HeroSearch";

const HOW_STEPS = [
  { title: "landing.how.1.title", body: "landing.how.1.body" },
  { title: "landing.how.2.title", body: "landing.how.2.body" },
  { title: "landing.how.3.title", body: "landing.how.3.body" },
] as const;

/**
 * The AstroBlink landing page in the scroll-globe design. Five sections, one per globe position.
 * All copy comes from the dictionaries (rules §4.4).
 */
export function AstroLanding() {
  const { t } = useT();
  const tryHref = "/explore?preset=barnard";

  const sections: ScrollSection[] = [
    {
      id: "hero",
      badge: t("landing.nav.hero"),
      title: t("landing.title"),
      description: t("landing.subtitle"),
      align: "left",
      search: <HeroSearch />,
      actions: [
        { label: t("landing.try"), variant: "primary", href: tryHref },
        { label: t("landing.join"), variant: "secondary", href: "/projects" },
      ],
    },
    {
      id: "how",
      badge: t("landing.nav.how"),
      title: t("landing.how.title"),
      description: t("landing.how.intro"),
      align: "center",
      features: HOW_STEPS.map((step) => ({ title: t(step.title), description: t(step.body) })),
    },
    {
      id: "projects",
      badge: t("landing.nav.projects"),
      title: t("landing.projects.title"),
      description: t("landing.projects.intro"),
      align: "left",
      features: PROJECTS.slice(0, 3).map((p) => ({
        title: t(p.titleKey),
        description: t(p.descriptionKey),
      })),
      actions: [{ label: t("landing.projects.all"), variant: "secondary", href: "/projects" }],
    },
    {
      id: "spherex",
      badge: t("landing.nav.spherex"),
      title: t("landing.spherex.title"),
      description: t("landing.spherex.body"),
      align: "center",
      actions: [{ label: t("landing.spherex.link"), variant: "secondary", href: "/about" }],
    },
    {
      id: "start",
      badge: t("landing.nav.start"),
      title: t("landing.cta.title"),
      description: t("landing.free"),
      align: "center",
      actions: [{ label: t("landing.try"), variant: "primary", href: tryHref }],
    },
  ];

  return (
    <ScrollGlobe
      sections={sections}
      labels={{
        interactive: t("landing.scroll.interactive"),
        scrollToExplore: t("landing.scroll.explore"),
        goTo: t("landing.scroll.goTo"),
        sectionFallback: t("landing.scroll.section"),
        progress: t("landing.scroll.progress"),
      }}
      // One position per section, always beside the text so the planet never sits behind words.
      globeConfig={{
        positions: [
          { top: "50%", left: "88%", scale: 1 },
          { top: "86%", left: "90%", scale: 0.8 },
          { top: "84%", left: "92%", scale: 0.9 },
          { top: "50%", left: "8%", scale: 1.3 },
          { top: "50%", left: "88%", scale: 1.2 },
        ],
      }}
    />
  );
}
