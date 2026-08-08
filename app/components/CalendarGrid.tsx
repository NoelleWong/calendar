"use client";

import { useRef, useState } from "react";
import { mergeWeekIntoBubbles, type MergeableSlot } from "@/lib/bubbles";
import type { Bubble as BubbleType } from "@/types";
import { Bubble } from "./Bubble";

const SLOT_HEIGHT_PX = 24; // keep in sync with Bubble.tsx SLOT_HEIGHT_PX
const SLOTS_PER_DAY = 48;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarGridProps {
  weekId: string;
  blocks: MergeableSlot[];
  onBubbleClick?: (bubble: BubbleType) => void;
  onEmptySlotClick?: (dayOfWeek: number, slotIndex: number) => void;
  /** Enables drag-to-resize on every bubble's edges; omit for read-only grids (e.g. compare). */
  onBubbleResize?: (bubble: BubbleType, newStartSlot: number, newSlotCount: number) => void;
  /** Enables drag-to-move (grab the body, drop on any day/time); omit for read-only grids. */
  onBubbleMove?: (bubble: BubbleType, newDayOfWeek: number, newStartSlot: number) => void;
}

/**
 * Renders one week: 7 day columns, full 24h range (per CLAUDE.md decision —
 * no business-hours filtering). Hour gridlines sit behind an absolutely
 * positioned stack of merged bubbles per day, computed fresh from raw
 * blocks via mergeWeekIntoBubbles (never persisted).
 *
 * Owns the cross-day move-drag: Bubble only reports raw mouse coordinates
 * (it can't see sibling day columns), so this component hit-tests those
 * against each day box's rect to find the (dayOfWeek, startSlot) drop
 * target, tracks it as `moveDrag` for a live ghost preview, and hides the
 * original bubble at its source slot for the duration of the drag.
 */
export function CalendarGrid({
  weekId,
  blocks,
  onBubbleClick,
  onEmptySlotClick,
  onBubbleResize,
  onBubbleMove,
}: CalendarGridProps) {
  const bubblesByDay = mergeWeekIntoBubbles(blocks);
  const dayBoxRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [moveDrag, setMoveDrag] = useState<{
    bubble: BubbleType;
    day: number;
    startSlot: number;
  } | null>(null);

  function computeDropTarget(bubble: BubbleType, clientX: number, clientY: number, grabOffsetY: number) {
    let day = bubble.dayOfWeek;
    let bestDist = Infinity;
    dayBoxRefs.current.forEach((el, candidateDay) => {
      const rect = el.getBoundingClientRect();
      const mid = (rect.left + rect.right) / 2;
      const dist = Math.abs(clientX - mid);
      if (dist < bestDist) {
        bestDist = dist;
        day = candidateDay;
      }
    });

    let startSlot = bubble.startSlot;
    const dayEl = dayBoxRefs.current.get(day);
    if (dayEl) {
      const rect = dayEl.getBoundingClientRect();
      const topPx = clientY - grabOffsetY - rect.top;
      const rawSlot = Math.round(topPx / SLOT_HEIGHT_PX);
      startSlot = Math.max(0, Math.min(SLOTS_PER_DAY - bubble.slotCount, rawSlot));
    }

    return { day, startSlot };
  }

  function handleMovePreview(bubble: BubbleType, clientX: number, clientY: number, grabOffsetY: number) {
    const { day, startSlot } = computeDropTarget(bubble, clientX, clientY, grabOffsetY);
    setMoveDrag({ bubble, day, startSlot });
  }

  function handleMoveCommit(bubble: BubbleType, clientX: number, clientY: number, grabOffsetY: number) {
    const { day, startSlot } = computeDropTarget(bubble, clientX, clientY, grabOffsetY);
    setMoveDrag(null);
    if (day !== bubble.dayOfWeek || startSlot !== bubble.startSlot) {
      onBubbleMove?.(bubble, day, startSlot);
    }
  }

  return (
    <div className="inline-block">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-xs text-graphite">{weekId}</span>
      </div>

      <div className="flex">
        {/* Hour rail */}
        <div className="flex flex-col pr-2">
          <div className="h-6" /> {/* spacer to align with day header row */}
          {Array.from({ length: 24 }).map((_, hour) => (
            <div
              key={hour}
              className="font-mono text-[10px] text-graphite text-right"
              style={{ height: `${SLOT_HEIGHT_PX * 2}px` }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex gap-1">
          {DAY_LABELS.map((label, dayOfWeek) => {
            const allBubbles = bubblesByDay[dayOfWeek] ?? [];
            const occupiedSlots = new Set<number>();
            allBubbles.forEach((b) => {
              for (let i = 0; i < b.slotCount; i++) occupiedSlots.add(b.startSlot + i);
            });

            // While the bubble being dragged originated on this day, hide it
            // at its old spot — the ghost below (rendered on whichever day
            // is the current drop target) stands in for it until the drag
            // commits and `blocks`/`slots` catches up.
            const bubbles =
              moveDrag && moveDrag.bubble.dayOfWeek === dayOfWeek
                ? allBubbles.filter(
                    (b) =>
                      !(b.startSlot === moveDrag.bubble.startSlot && b.projectId === moveDrag.bubble.projectId)
                  )
                : allBubbles;

            return (
              <div key={dayOfWeek} className="w-28">
                <div className="h-6 flex items-center justify-center text-xs font-medium">
                  {label}
                </div>
                <div
                  ref={(el) => {
                    if (el) dayBoxRefs.current.set(dayOfWeek, el);
                    else dayBoxRefs.current.delete(dayOfWeek);
                  }}
                  className="relative rounded-md border border-line bg-surface"
                  style={{ height: `${SLOTS_PER_DAY * SLOT_HEIGHT_PX}px` }}
                >
                  {/* hour gridlines */}
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-line"
                      style={{ top: `${hour * SLOT_HEIGHT_PX * 2}px` }}
                    />
                  ))}

                  {/* empty-slot click targets, skipped where a bubble sits */}
                  {Array.from({ length: SLOTS_PER_DAY }).map((_, slotIndex) =>
                    occupiedSlots.has(slotIndex) ? null : (
                      <button
                        key={slotIndex}
                        type="button"
                        onClick={() => onEmptySlotClick?.(dayOfWeek, slotIndex)}
                        className="absolute left-0 right-0 hover:bg-line/40"
                        style={{
                          top: `${slotIndex * SLOT_HEIGHT_PX}px`,
                          height: `${SLOT_HEIGHT_PX}px`,
                        }}
                        aria-label={`Add block, ${label} slot ${slotIndex}`}
                      />
                    )
                  )}

                  {/* bubbles — each one self-positions (absolute top/height
                      from its own startSlot/slotCount) so a resize or move
                      drag can preview locally without this grid re-rendering
                      per mouse move */}
                  {bubbles.map((bubble) => (
                    <Bubble
                      key={`${bubble.projectId}-${bubble.startSlot}`}
                      bubble={bubble}
                      onClick={onBubbleClick}
                      onResize={onBubbleResize}
                      onMovePreview={onBubbleMove ? handleMovePreview : undefined}
                      onMoveCommit={onBubbleMove ? handleMoveCommit : undefined}
                    />
                  ))}

                  {/* live drop-target ghost while a move drag is in flight */}
                  {moveDrag && moveDrag.day === dayOfWeek && (
                    <div className="pointer-events-none opacity-60">
                      <Bubble bubble={{ ...moveDrag.bubble, startSlot: moveDrag.startSlot }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
