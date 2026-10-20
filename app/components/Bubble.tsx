"use client";

import { useEffect, useRef, useState } from "react";
import { resolveGroupColor } from "@/lib/colors";
import { formatSlotDuration } from "@/lib/counts";
import type { Bubble as BubbleType } from "@/types";

const SLOT_HEIGHT_PX = 24; // must match CalendarGrid's SLOT_HEIGHT_PX
const GAP_PX = 3; // fixed-width gap between bubbles, per CLAUDE.md decisions log
const SLOTS_PER_DAY = 48;
const HANDLE_PX = 6; // height of the invisible drag-to-resize strip at each edge (mouse)
const PILL_WIDTH_CLASS = "w-1/6"; // color bar is a narrow flush-left indicator; the label reads to its right
const MOUSE_MOVE_THRESHOLD_PX = 4; // a mouse press that travels less than this is still a click
const LONG_PRESS_MS = 350; // touch/pen: hold this long to pick a bubble up, so plain swipes still scroll
const TOUCH_SLOP_PX = 8; // finger travel allowed during the hold before it counts as a scroll
const TOUCH_EDGE_PX = 10; // touch: a hold this close to the top/bottom edge resizes instead of moving

interface DragState {
  edge: "top" | "bottom";
  startY: number;
  origStart: number;
  origCount: number;
  // Mutated during the drag; read by pointerup once the listeners are torn down,
  // so the commit always sees the latest values (React state updates inside
  // the pointermove closure would otherwise be stale by the time pointerup fires).
  newStart: number;
  newCount: number;
  moved: boolean;
}

/**
 * Touch drags must stop the page from scrolling under the finger, which
 * takes preventDefault() on touchmove. iOS Safari only honors that from a
 * non-passive listener that already existed when the touch began, so one
 * window-level listener is installed up front and gated on this flag.
 */
let touchDragActive = false;
let scrollBlockerInstalled = false;

function installScrollBlocker() {
  if (scrollBlockerInstalled) return;
  scrollBlockerInstalled = true;
  window.addEventListener(
    "touchmove",
    (ev) => {
      if (touchDragActive) ev.preventDefault();
    },
    { passive: false }
  );
}

/**
 * Follows one pointer at the window level until it lifts — or the browser
 * cancels it, e.g. because it took the gesture over as a scroll — so a drag
 * keeps tracking after the pointer leaves the bubble. Listeners are torn
 * down before onEnd runs.
 */
function trackPointer(
  pointerId: number,
  onMove: (ev: PointerEvent) => void,
  onEnd: (ev: PointerEvent, cancelled: boolean) => void
) {
  function handleMove(ev: PointerEvent) {
    if (ev.pointerId === pointerId) onMove(ev);
  }
  function handleEnd(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleEnd);
    window.removeEventListener("pointercancel", handleEnd);
    onEnd(ev, ev.type === "pointercancel");
  }
  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleEnd);
  window.addEventListener("pointercancel", handleEnd);
}

interface BubbleProps {
  bubble: BubbleType;
  /** Render invisibly but stay mounted — used for a move drag's source, see CalendarGrid. */
  concealed?: boolean;
  onClick?: (bubble: BubbleType) => void;
  /**
   * Enables drag-to-resize on the bubble's top/bottom edges when provided.
   * Called once, on pointerup, with the final (newStartSlot, newSlotCount) —
   * not on every intermediate move. Omit for read-only views (e.g. compare).
   */
  onResize?: (bubble: BubbleType, newStartSlot: number, newSlotCount: number) => void;
  /**
   * Enables drag-to-move on the bubble's body (grab and drop it at another
   * time, possibly on another day). Bubble only reports raw pointer
   * coordinates plus the pointer's offset from the bubble's own top — it has
   * no visibility into sibling day columns, so CalendarGrid (which owns all
   * of them) is what translates those into a (dayOfWeek, startSlot) drop
   * target and renders the cross-day preview. Called on every move once the
   * drag has started, and once more on commit (pointerup).
   */
  onMovePreview?: (bubble: BubbleType, clientX: number, clientY: number, grabOffsetY: number) => void;
  onMoveCommit?: (bubble: BubbleType, clientX: number, clientY: number, grabOffsetY: number) => void;
  /** The browser aborted a move drag (e.g. an interrupted touch): drop any preview, commit nothing. */
  onMoveCancel?: (bubble: BubbleType) => void;
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
 * without the parent grid re-rendering on every pointer move.
 *
 * Input: a mouse drags immediately (edge strips resize, the body moves).
 * Touch and pen press-and-hold first, so a swipe that starts on a bubble
 * still scrolls the page; the hold's position picks resize (near the top or
 * bottom edge) or move (anywhere else).
 */
export function Bubble({
  bubble,
  concealed = false,
  onClick,
  onResize,
  onMovePreview,
  onMoveCommit,
  onMoveCancel,
}: BubbleProps) {
  const color = resolveGroupColor(bubble.project);
  const canMove = Boolean(onMovePreview || onMoveCommit);
  const draggable = canMove || Boolean(onResize);

  // Live preview shown while dragging; null when not dragging (falls back to
  // the authoritative bubble prop).
  const [preview, setPreview] = useState<{ startSlot: number; slotCount: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (draggable) installScrollBlocker();
  }, [draggable]);

  const startSlot = preview?.startSlot ?? bubble.startSlot;
  const slotCount = preview?.slotCount ?? bubble.slotCount;
  const heightPx = slotCount * SLOT_HEIGHT_PX - GAP_PX;

  function lockPage(cursor: string, isTouch: boolean) {
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    touchDragActive = isTouch;
  }

  function unlockPage() {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    touchDragActive = false;
  }

  function beginResize(edge: "top" | "bottom", pointerId: number, startY: number, isTouch: boolean) {
    if (!onResize) return;
    const resize = onResize; // narrow once; TS can't see the outer guard from inside the onEnd closure

    dragRef.current = {
      edge,
      startY,
      origStart: bubble.startSlot,
      origCount: bubble.slotCount,
      newStart: bubble.startSlot,
      newCount: bubble.slotCount,
      moved: false,
    };
    setPreview({ startSlot: bubble.startSlot, slotCount: bubble.slotCount });
    lockPage("ns-resize", isTouch);

    trackPointer(
      pointerId,
      (ev) => {
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
      },
      (_ev, cancelled) => {
        unlockPage();
        const drag = dragRef.current;
        dragRef.current = null;
        setPreview(null);

        if (!drag || cancelled) return;
        if (drag.moved) {
          suppressClickRef.current = true; // a pointerup far from the handle can still bubble a click
          resize(bubble, drag.newStart, drag.newCount);
        }
      }
    );
  }

  /**
   * Grab-and-drop on the pill body. Unlike beginResize, this component never
   * previews the drop itself — startSlot/dayOfWeek changing together is a
   * cross-column concern CalendarGrid owns — so this just forwards raw
   * coordinates upward. A mouse drag only starts once movement clears a
   * small threshold (so a plain click still passes through untouched); a
   * touch drag starts at once, since the long press already said "drag".
   */
  function beginMove(
    pointerId: number,
    startX: number,
    startY: number,
    grabOffsetY: number,
    isTouch: boolean
  ) {
    let started = false;

    function start() {
      started = true;
      lockPage("grabbing", isTouch);
    }

    if (isTouch) {
      start();
      onMovePreview?.(bubble, startX, startY, grabOffsetY); // show the lifted ghost right away
    }

    trackPointer(
      pointerId,
      (ev) => {
        if (!started) {
          if (
            Math.abs(ev.clientX - startX) < MOUSE_MOVE_THRESHOLD_PX &&
            Math.abs(ev.clientY - startY) < MOUSE_MOVE_THRESHOLD_PX
          )
            return;
          start();
        }
        onMovePreview?.(bubble, ev.clientX, ev.clientY, grabOffsetY);
      },
      (ev, cancelled) => {
        if (!started) return;
        unlockPage();
        if (cancelled) {
          onMoveCancel?.(bubble);
          return;
        }
        suppressClickRef.current = true; // a pointerup far from the pill can still bubble a click
        onMoveCommit?.(bubble, ev.clientX, ev.clientY, grabOffsetY);
      }
    );
  }

  /**
   * Touch/pen: wait out a long press before starting any drag. Moving the
   * finger past a small slop first (or the browser claiming the gesture
   * for scrolling, which fires pointercancel) abandons the hold, leaving
   * the swipe to scroll as normal.
   */
  function awaitLongPress(e: React.PointerEvent<HTMLButtonElement>) {
    const { pointerId, clientX: startX, clientY: startY } = e;
    const rect = e.currentTarget.getBoundingClientRect();
    const grabOffsetY = startY - rect.top;

    function abandon() {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    }
    function handleMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > TOUCH_SLOP_PX) abandon();
    }
    function handleEnd(ev: PointerEvent) {
      if (ev.pointerId === pointerId) abandon(); // a tap: let the click through
    }

    const timer = window.setTimeout(() => {
      abandon();
      suppressClickRef.current = true; // releasing a hold is not a tap
      navigator.vibrate?.(10);

      // Edge zones shrink on short bubbles so a 30-min one still has a
      // middle to grab for moving.
      const edgeZone = Math.min(TOUCH_EDGE_PX, rect.height / 4);
      if (onResize && grabOffsetY < edgeZone) {
        beginResize("top", pointerId, startY, true);
      } else if (onResize && grabOffsetY > rect.height - edgeZone) {
        beginResize("bottom", pointerId, startY, true);
      } else if (canMove) {
        beginMove(pointerId, startX, startY, grabOffsetY, true);
      }
    }, LONG_PRESS_MS);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    suppressClickRef.current = false; // only the gesture that started here may swallow its own click
    if (!draggable) return;

    if (e.pointerType !== "mouse") {
      awaitLongPress(e);
      return;
    }
    if (e.button !== 0) return;

    const edge = (e.target as HTMLElement).closest<HTMLElement>("[data-resize-edge]")?.dataset
      .resizeEdge as "top" | "bottom" | undefined;
    if (edge) {
      e.preventDefault();
      beginResize(edge, e.pointerId, e.clientY, false);
    } else if (canMove) {
      const grabOffsetY = e.clientY - e.currentTarget.getBoundingClientRect().top;
      beginMove(e.pointerId, e.clientX, e.clientY, grabOffsetY, false);
    }
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
      className={`absolute left-0 right-0 ${concealed ? "opacity-0" : ""}`}
      style={{ top: `${startSlot * SLOT_HEIGHT_PX}px`, height: `${slotCount * SLOT_HEIGHT_PX}px` }}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        // Long-press is the touch drag gesture, so keep the OS from turning
        // it into a context menu / text-selection callout.
        onContextMenu={draggable ? (e) => e.preventDefault() : undefined}
        className={`group relative flex h-full w-full select-none items-center overflow-hidden text-left [-webkit-touch-callout:none] ${
          canMove ? "cursor-grab active:cursor-grabbing" : ""
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
                data-resize-edge="top"
                className="absolute inset-x-0 top-0 cursor-ns-resize opacity-0 hover:bg-black/10 group-hover:opacity-100"
                style={{ height: `${HANDLE_PX}px` }}
                aria-hidden="true"
              />
              <span
                data-resize-edge="bottom"
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
