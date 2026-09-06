"use client";

import { useRef, useState } from "react";
import { resolveGroupColor } from "@/lib/colors";
import { formatSlotDuration } from "@/lib/counts";
import type { Bubble as BubbleType } from "@/types";

const SLOT_HEIGHT_PX = 24; // must match CalendarGrid's SLOT_HEIGHT_PX
const GAP_PX = 3; // fixed-width gap between bubbles, per CLAUDE.md decisions log
const SLOTS_PER_DAY = 48;
const HANDLE_PX = 6; // height of the invisible drag-to-resize strip at each edge
const PILL_WIDTH_CLASS = "w-1/6"; // color bar is a narrow flush-left indicator; the label reads to its right

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
  /**
   * Enables drag-to-move on the bubble's body (grab and drop it at another
   * time, possibly on another day). Bubble only reports raw pointer
   * coordinates plus the cursor's offset from the bubble's own top — it has
   * no visibility into sibling day columns, so CalendarGrid (which owns all
   * of them) is what translates those into a (dayOfWeek, startSlot) drop
   * target and renders the cross-day preview. Called on every move once a
   * small threshold is crossed, and once more on commit (mouseup).
   */
  onMovePreview?: (bubble: BubbleType, clientX: number, clientY: number, grabOffsetY: number) => void;
  onMoveCommit?: (bubble: BubbleType, clientX: number, clientY: number, grabOffsetY: number) => void;
}

/**
 * One project's contiguous run of slots. Rendered as a narrow rounded color
 * bar flush against the left edge of the day column (indicating the
 * project's group — see lib/colors.ts) with the project name reading to its
 * right, rather than a full-width pill with the label crammed inside.
 * Height is proportional to slotCount (duration); the fixed-width gap is
 * subtracted from the height (not scaled), so short 30-min bubbles aren't
 * visually swallowed by the gap.
 *
 * Self-positions absolutely (top + height from startSlot/slotCount) so that,
 * when resizable, it can preview a drag by adjusting its own top/height
 * without the parent grid re-rendering on every mouse move.
 */
export function Bubble({ bubble, onClick, onResize, onMovePreview, onMoveCommit }: BubbleProps) {
  const color = resolveGroupColor(bubble.project);

  // Live preview shown while dragging; null when not dragging (falls back to
  // the authoritative bubble prop).
  const [preview, setPreview] = useState<{ startSlot: number; slotCount: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const startSlot = preview?.startSlot ?? bubble.startSlot;
  const slotCount = preview?.slotCount ?? bubble.slotCount;
  const heightPx = slotCount * SLOT_HEIGHT_PX - GAP_PX;

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

  /**
   * Grab-and-drop on the pill body. Unlike beginResize, this component never
   * previews the drop itself — startSlot/dayOfWeek changing together is a
   * cross-column concern CalendarGrid owns — so this just forwards raw
   * coordinates upward once movement clears a small threshold (so a plain
   * click still passes through untouched).
   */
  function handleBodyMouseDown(e: React.MouseEvent<HTMLButtonElement>) {
    if (!onMovePreview && !onMoveCommit) return;
    const grabOffsetY = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    function handleMouseMove(ev: MouseEvent) {
      if (!moved) {
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        moved = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      onMovePreview?.(bubble, ev.clientX, ev.clientY, grabOffsetY);
    }

    function handleMouseUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (moved) {
        suppressClickRef.current = true; // a mouseup far from the pill can still bubble a click
        onMoveCommit?.(bubble, ev.clientX, ev.clientY, grabOffsetY);
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
        onMouseDown={handleBodyMouseDown}
        className={`group relative flex h-full w-full items-center overflow-hidden text-left ${
          onMovePreview || onMoveCommit ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        title={`${bubble.project.name} — ${formatSlotDuration(bubble.slotCount)}`}
      >
        {/* narrow color bar — the actual "pill" — flush left, full height */}
        <span
          className={`relative block h-full shrink-0 rounded-bubble transition-transform group-hover:scale-[1.05] ${PILL_WIDTH_CLASS}`}
          style={{ height: `${heightPx}px`, backgroundColor: color }}
        >
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
        </span>

        {/* project name reads to the right of the color bar, tinted to match it */}
        <span
          className="ml-1.5 min-w-0 flex-1 truncate text-xs font-medium leading-tight"
          style={{ color }}
        >
          {bubble.project.name}
        </span>
      </button>
    </div>
  );
}
