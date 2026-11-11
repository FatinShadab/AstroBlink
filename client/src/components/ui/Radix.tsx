"use client";

/*
 * Thin styled wrappers over Radix primitives (architecture §2: shadcn/ui on Radix).
 * Radix handles focus, keyboard and ARIA; these only apply design tokens.
 */
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ---------- Tabs (design §9.9: 44 high, 2px primary underline) ---------- */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border [mask-image:linear-gradient(to_right,black_90%,transparent)] md:[mask-image:none]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative h-11 shrink-0 px-3 text-body-sm font-medium text-text-secondary hover:text-text-primary data-[state=active]:text-text-primary data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary data-[state=active]:after:content-['']",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn("pt-4", className)} {...props} />;
}

/* ---------- Accordion (design §9.9: 56 high header, chevron rotates) ---------- */

export const Accordion = AccordionPrimitive.Root;
export const AccordionItem = ({ className, ...props }: AccordionPrimitive.AccordionItemProps) => (
  <AccordionPrimitive.Item className={cn("border-b border-border", className)} {...props} />
);

export function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex h-14 flex-1 items-center justify-between gap-3 text-left font-sans text-h4 font-medium text-text-primary",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-text-secondary transition-transform duration-[250ms] group-data-[state=open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  ...props
}: AccordionPrimitive.AccordionContentProps) {
  return (
    <AccordionPrimitive.Content
      className={cn("pb-4 text-body-sm text-text-secondary", className)}
      {...props}
    />
  );
}

/* ---------- Dialog (design §9.10: max 560, radius-lg, scrim, Esc closes) ---------- */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  closeLabel,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  closeLabel: string;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay-scrim" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-32px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface-1 p-6 shadow-[0_12px_32px_rgba(0,0,0,0.45)] focus:outline-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="font-display text-h3 font-medium text-text-primary">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-body-sm text-text-secondary">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="relative grid size-11 shrink-0 place-items-center rounded-[var(--radius-sm)] text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ---------- Tooltip (design §9.10: surface-3, caption, 400ms delay) ---------- */

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={6}
        className="z-50 max-w-60 rounded-[var(--radius-md)] bg-surface-3 px-3 py-2 text-caption text-text-primary shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
