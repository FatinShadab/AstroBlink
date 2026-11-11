"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Dialog,
  DialogContent,
  DialogTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Radix";
import { Button } from "@/components/ui/Button";
import { Chip, Input } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  Badge,
  Banner,
  Card,
  EmptyState,
  KpiTile,
  ProgressBar,
  Skeleton,
} from "@/components/ui/Surfaces";
import { useToast } from "@/components/ui/Toast";
import { Container } from "@/components/layout/Container";
import { useT } from "@/lib/i18n/LangProvider";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`dev-${title}`} className="flex flex-col gap-4">
      <h2 id={`dev-${title}`} className="font-display text-h2 font-semibold text-text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Every primitive in every state (PROMPT Phase 1). Temporary; delete before demo. */
export function DevUi() {
  const { t } = useT();
  const toast = useToast();
  const [segment, setSegment] = useState<"blink" | "side" | "merge">("blink");
  const [speed, setSpeed] = useState("1");
  const [chipOn, setChipOn] = useState(true);

  return (
    <Container className="flex flex-col gap-16 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-semibold text-text-primary">{t("dev.title")}</h1>
        <p className="text-body-lg text-text-secondary">{t("dev.description")}</p>
      </header>

      <Section title={t("dev.buttons")}>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Primary lg</Button>
          <Button>Primary md</Button>
          <Button size="sm">Primary sm</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="icon" aria-label="Icon example">
            <span aria-hidden="true">★</span>
          </Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="grid max-w-[960px] grid-cols-2 gap-3 md:grid-cols-4">
          <Button variant="secondary" size="answer">
            {t("dev.answerMoved")}
          </Button>
          <Button variant="secondary" size="answer">
            {t("dev.answerNoChange")}
          </Button>
          <Button variant="secondary" size="answer">
            {t("dev.answerNotSure")}
          </Button>
          <Button variant="secondary" size="answer">
            {t("dev.answerGlitch")}
          </Button>
        </div>
      </Section>

      <Section title={t("dev.inputs")}>
        <div className="grid max-w-[720px] gap-4">
          <Input aria-label="Coordinates" placeholder="08h55m10.8s −07d14m42s" mono />
          <Input aria-label="Invalid example" defaultValue="bad input" invalid mono />
          <div className="flex flex-wrap gap-2">
            <Chip selected={chipOn} onClick={() => setChipOn((v) => !v)}>
              {t("dev.chipSelected")}
            </Chip>
            <Chip selected={!chipOn} onClick={() => setChipOn((v) => !v)}>
              {t("dev.chipIdle")}
            </Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">{t("common.simulatedSky")}</Badge>
            <Badge tone="accent">{t("common.demoData")}</Badge>
            <Badge tone="success">{t("dev.badgeBeginner")}</Badge>
            <Badge tone="warning">{t("dev.badgeIntermediate")}</Badge>
            <Badge tone="primary">{t("dev.badgeAdvanced")}</Badge>
          </div>
        </div>
      </Section>

      <Section title={t("dev.segmented")}>
        <div className="flex flex-col gap-3">
          <SegmentedControl<"blink" | "side" | "merge">
            label="View mode"
            value={segment}
            onChange={setSegment}
            options={[
              { value: "blink", label: "Blink" },
              { value: "side", label: "Side by side" },
              { value: "merge", label: "Merge" },
            ]}
          />
          <SegmentedControl<string>
            label="Speed"
            value={speed}
            onChange={setSpeed}
            options={[
              { value: "0.5", label: "0.5×" },
              { value: "1", label: "1×" },
              { value: "2", label: "2×" },
            ]}
          />
        </div>
      </Section>

      <Section title={t("dev.cards")}>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KpiTile label={t("dev.kpiLabel")} value="12" delta="+3 this week" />
          <KpiTile label={t("dev.kpiLabel")} value="1,204" />
        </div>
        <Card className="max-w-[560px]">
          <h3 className="text-h3 font-medium text-text-primary">{t("dev.sampleCardTitle")}</h3>
          <p className="mt-2 text-body-sm text-text-secondary">{t("dev.sampleCardBody")}</p>
        </Card>
      </Section>

      <Section title={t("dev.progress")}>
        <div className="max-w-[560px]">
          <ProgressBar label={t("dev.progressLabel")} value={3} max={10} valueLabel="30%" />
        </div>
        <Skeleton className="h-24 max-w-[560px]" />
      </Section>

      <Section title={t("dev.tabs")}>
        <Tabs defaultValue="image">
          <TabsList aria-label="Advanced tools">
            <TabsTrigger value="image">{t("dev.tabImage")}</TabsTrigger>
            <TabsTrigger value="compare">{t("dev.tabCompare")}</TabsTrigger>
            <TabsTrigger value="flags">{t("dev.tabFlags")}</TabsTrigger>
          </TabsList>
          <TabsContent value="image">{t("dev.tabPanelImage")}</TabsContent>
          <TabsContent value="compare">{t("dev.tabPanelCompare")}</TabsContent>
          <TabsContent value="flags">{t("dev.tabPanelFlags")}</TabsContent>
        </Tabs>
      </Section>

      <Section title={t("dev.accordion")}>
        <Accordion type="single" collapsible className="max-w-[720px]">
          <AccordionItem value="visit">
            <AccordionTrigger>{t("dev.accordionTitle")}</AccordionTrigger>
            <AccordionContent>{t("dev.accordionBody")}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title={t("dev.dialog")}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">{t("dev.openDialog")}</Button>
          </DialogTrigger>
          <DialogContent title={t("dev.dialog")} closeLabel={t("common.close")}>
            <p className="text-body text-text-secondary">{t("dev.toastBody")}</p>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title={t("dev.toast")}>
        <div>
          <Button
            variant="secondary"
            onClick={() => toast({ title: t("dev.showToast"), description: t("dev.toastBody") })}
          >
            {t("dev.showToast")}
          </Button>
        </div>
      </Section>

      <Section title={t("dev.tooltip")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="icon" aria-label="Asinh stretch help">
              <span aria-hidden="true">?</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Asinh: shows faint and bright objects at the same time.</TooltipContent>
        </Tooltip>
      </Section>

      <Section title={t("dev.banner")}>
        <div className="flex flex-col gap-3">
          <Banner tone="warning" icon="⚠">
            {t("dev.bannerWarning")}
          </Banner>
          <Banner
            tone="danger"
            icon="✕"
            action={
              <Button variant="secondary" size="sm">
                {t("common.tryAgain")}
              </Button>
            }
          >
            {t("dev.bannerError")}
          </Banner>
          <Banner tone="info" icon="ⓘ">
            {t("dev.bannerInfo")}
          </Banner>
          <Card>
            <EmptyState title={t("state.emptyTitle")} body={t("dev.emptyBody")} />
          </Card>
        </div>
      </Section>
    </Container>
  );
}
