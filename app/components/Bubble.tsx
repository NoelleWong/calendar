"use client";

import { useRef, useState } from "react";
import { resolveGroupColor, contrastTextColor } from "@/lib/colors";
import { formatSlotDuration } from "@/lib/counts";
import type { Bubble as BubbleType } from "@/types";

const SLOT_HEIGHT_PX = 24; // must match CalendarGrid's SLOT_HEIGHT_PX
const GAP_PX = 3; // fixed-width gap between bubbles, per CLAUDE.md decisions log
const SLOTS_PER_DAY = 48;
const HANDLE_PX = 6; // height of the invisible drag-to-resize strip at each edge

interface DragState {
  edge: "top" | "bottom";
  startY: number;
  origStart: number;
  origCount: number;
  // Mutated during the drag; read by mouseup once the listeners are torn down,
  // so the commit always sees the latest values (React state updates inside
  // the mousemove closure would otherwise be stale by the time mouseup fires).
  newStart: number;
  newCount: number;
  moved: boolean;
}

interface BubbleProps {
  bubble: BubbleType;
  onClick?: (bubble: BubbleType) => void;
  /**
   * Enables drag-to-resize on the bubble's top/bottom edges when provided.
   * Called once, on mouseup, with the final (newStartSlot, newSlotCount) —
   * not on every intermediate move. Omit for read-only views (e.g. compare).
   */
  onResize?: (bubble: BubbleType, newStartSlot: number, newSlotCount: number) => void;
}

/**
 * One project's contiguous run of slots, rendered as a rounded pill.
 * Height is proportional to slotCount (duration); the fixed-width gap is
 * subtracted from the height (not scaled), so short 30-min bubbles aren't
 * visually swallowed by the gap. Color always comes from the project's
 * group — see lib/colors.ts.
 *
 * Self-positions absolutely (top + height from startSlot/slotCount) so that,
 * when resizable, it can preview a drag by adjusting its own top/height
 * without the parent grid re-rendering on every mouse move.
 */
export function Bubble({ bubble, onClick, onResize }: BubbleProps) {
  const color = resolveGroupColor(bubble.project);
  const textColor = contrastTextColor(color);

  // Live preview shown while dragging; null when not dragging (falls back to
  // the authoritative bubble prop).
  const [preview, setPreview] = useState<{ startSlot: number; slotCount: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const startSlot = preview?.startSlot ?? bubble.startSlot;
  const slotCount = preview?.slotCount ?? bubble.slotCount;
  const heightPx = slotCount * SLOT_HEIGHT_PX - GAP_PX;
  const showLabel = slotCount >= 2; // 30-min bubbles too short for a label

  function beginResize(edge: "top" | "bottom", e: React.MouseEvent) {
    if (!onResize) return;
    const resize = onResize; // narrow once; TS can't see the outer guard from inside handleMouseUp's closure
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      edge,
      startY: e.clientY,
      origStart: bubble.startSlot,
      origCount: bubble.slotCount,
      newStart: bubble.startSlot,
      newCount: bubble.slotCount,
      moved: false,
    };
    setPreview({ startSlot: bubble.startSlot, slotCount: bubble.slotCount });
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    function handleMouseMove(ev: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaSlots = Math.round((ev.clientY - drag.startY) / SLOT_HEIGHT_PX);

      let nextStart = drag.origStart;
      let nextCount = drag.origCount;

      if (drag.edge === "bottom") {
        // End moves; start is fixed. Clamp so the bubble stays at least one
        // slot long and never runs past the end of the day.
        nextCount = Math.max(
          1,
          Math.min(SLOTS_PER_DAY - drag.origStart, drag.origCount + deltaSlots)
        );
      } else {
        // Start moves; end (origStart + origCount) is fixed. Clamp so start
        // never goes below 0 or past (end - 1 slot).
        const proposedStart = drag.origStart + deltaSlots;
        nextStart = Math.max(0, Math.min(drag.origStart + drag.origCount - 1, proposedStart));
        nextCount = drag.origStart + drag.origCount - nextStart;
      }

      drag.newStart = nextStart;
      drag.newCount = nextCount;
      drag.moved = drag.moved || nextStart !== drag.origStart || nextCount !== drag.origCount;
      setPreview({ startSlot: nextStart, slotCount: nextCount });
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const drag = dragRef.current;
      dragRef.current = null;
      setPreview(null);

      if (!drag) return;
      if (drag.moved) {
        suppressClickRef.current = true; // a mouseup far from the handle can still bubble a click
        resize(bubble, drag.newStart, drag.newCount);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onClick?.(bubble);
  }

  return (
    <div
      className="absolute left-0 right-0"
      style={{ top: `${startSlot * SLOT_HEIGHT_PX}px`, height: `${slotCount * SLOT_HEIGHT_PX}px` }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="group relative flex w-full items-center justify-center overflow-hidden rounded-bubble px-2 text-left transition-transform hover:scale-[1.02] focus-visible:scale-[1.02]"
        style={{
          height: `${heightPx}px`,
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

        {onResize && (
          <>
            <span
              onMouseDown={(e) => beginResize("top", e)}
              className="absolute inset-x-0 top-0 cursor-ns-resize opacity-0 hover:bg-black/10 group-hover:opacity-100"
              style={{ height: `${HANDLE_PX}px` }}
              aria-hidden="true"
            />
            <span
              onMouseDown={(e) => beginResize("bottom", e)}
              className="absolute inset-x-0 bottom-0 cursor-ns-resize opacity-0 hover:bg-black/10 group-hover:opacity-100"
              style={{ height: `${HANDLE_PX}px` }}
              aria-hidden="true"
            />
          </>
        )}
      </button>
    </div>
  );
}
