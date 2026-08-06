"use client";

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
}

/**
 * Renders one week: 7 day columns, full 24h range (per CLAUDE.md decision —
 * no business-hours filtering). Hour gridlines sit behind an absolutely
 * positioned stack of merged bubbles per day, computed fresh from raw
 * blocks via mergeWeekIntoBubbles (never persisted).
 */
export function CalendarGrid({
  weekId,
  blocks,
  onBubbleClick,
  onEmptySlotClick,
  onBubbleResize,
}: CalendarGridProps) {
  const bubblesByDay = mergeWeekIntoBubbles(blocks);

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
            const bubbles = bubblesByDay[dayOfWeek] ?? [];
            const occupiedSlots = new Set<number>();
            bubbles.forEach((b) => {
              for (let i = 0; i < b.slotCount; i++) occupiedSlots.add(b.startSlot + i);
            });

            return (
              <div key={dayOfWeek} className="w-28">
                <div className="h-6 flex items-center justify-center text-xs font-medium">
                  {label}
                </div>
                <div
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
                      from its own startSlot/slotCount) so a resize drag can
                      preview locally without this grid re-rendering per move */}
                  {bubbles.map((bubble) => (
                    <Bubble
                      key={`${bubble.projectId}-${bubble.startSlot}`}
                      bubble={bubble}
                      onClick={onBubbleClick}
                      onResize={onBubbleResize}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
