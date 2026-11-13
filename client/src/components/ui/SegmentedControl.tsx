"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Shown but not selectable (for features in a later phase). */
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Design §9.4: radiogroup, arrow keys move (and select) between segments.
 * Segments are 36px high with a 44px hit area added via ::before.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  /** Move to the next enabled option in a direction, wrapping around. */
  function move(from: number, delta: number) {
    for (let step = 1; step <= options.length; step++) {
      const next = (from + delta * step + options.length * step) % options.length;
      if (!options[next].disabled) {
        onChange(options[next].value);
        refs.current[next]?.focus();
        return;
      }
    }
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(index, -1);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      id={groupId}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            className={cn(
              "relative h-11 shrink-0 rounded-[var(--radius-sm)] px-4 text-body font-medium",
              selected
                ? "glass text-text-primary shadow-[inset_0_-2px_0_var(--primary)]!"
                : "text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary",
              option.disabled && "cursor-not-allowed opacity-40 hover:text-text-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
