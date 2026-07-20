"use client";

import { resolveGroupColor, contrastTextColor } from "@/lib/colors";
import { formatSlotDuration } from "@/lib/counts";
import type { Bubble as BubbleType } from "@/types";

const SLOT_HEIGHT_PX = 24; // must match tailwind `spacing.slot` (1.5rem)
const GAP_PX = 3; // fixed-width gap between bubbles, per CLAUDE.md decisions log

interface BubbleProps {
  bubble: BubbleType;
  onClick?: (bubble: BubbleType) => void;
}

/**
 * One project's contiguous run of slots, rendered as a rounded pill.
 * Height is proportional to slotCount (duration); the fixed-width gap is
 * subtracted from the height (not scaled), so short 30-min bubbles aren't
 * visually swallowed by the gap. Color always comes from the project's
 * group — see lib/colors.ts.
 */
export function Bubble({ bubble, onClick }: BubbleProps) {
  const color = resolveGroupColor(bubble.project);
  const textColor = contrastTextColor(color);
  const heightPx = bubble.slotCount * SLOT_HEIGHT_PX - GAP_PX;
  const showLabel = bubble.slotCount >= 2; // 30-min bubbles too short for a label

  return (
    <button
      type="button"
      onClick={() => onClick?.(bubble)}
      className="w-full rounded-bubble flex items-center justify-center overflow-hidden px-2 text-left transition-transform hover:scale-[1.02] focus-visible:scale-[1.02]"
      style={{
        height: `${heightPx}px`,
        marginBottom: `${GAP_PX}px`,
        backgroundColor: color,
        color: textColor,
      }}
      title={`${bubble.project.name} — ${formatSlotDuration(bubble.slotCount)}`}
    >
      {showLabel && (
        <span className="truncate text-xs font-medium leading-tight">
          {bubble.project.name}
        </span>
      )}
    </button>
  );
}
