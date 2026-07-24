"use client";

import { useState } from "react";
import { slotIndexToLabel } from "@/lib/time";
import { formatSlotDuration } from "@/lib/counts";
import type { Bubble } from "@/types";

export interface SplitResult {
  /** The slot index where the reassigned portion begins. */
  splitAt: number;
  /** How many slots (from splitAt to the bubble's end) are being reassigned. */
  slotCount: number;
}

interface BubbleActionSheetProps {
  bubble: Bubble;
  onChangeWholeProject: () => void;
  onSplit: (result: SplitResult) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Menu shown when a bubble is clicked. Three actions:
 * - Change project: reassign the whole bubble's range to a different project.
 * - Split: pick an internal boundary; the portion from that boundary to the
 *   bubble's end gets reassigned to a different project, which naturally
 *   splits the bubble into two (or three, if splitting a middle chunk off)
 *   once bubbles are re-merged on render.
 * - Delete: clear the whole range.
 *
 * This component only decides *what* to change — the parent page owns the
 * ProjectPicker and the actual API calls, so both "change whole project"
 * and "split" funnel into the same picker flow with different target ranges.
 */
export function BubbleActionSheet({
  bubble,
  onChangeWholeProject,
  onSplit,
  onDelete,
  onClose,
}: BubbleActionSheetProps) {
  const [mode, setMode] = useState<"menu" | "choose-split-point" | "confirm-delete">("menu");

  const startLabel = slotIndexToLabel(bubble.startSlot);
  const endLabel = slotIndexToLabel(bubble.startSlot + bubble.slotCount);

  // Internal boundaries only — splitting "at the very start" or "very end"
  // isn't a split, it's a whole-bubble reassignment (already covered by the
  // Change project action), so those two endpoints are excluded.
  const splitPoints = Array.from({ length: bubble.slotCount - 1 }, (_, i) => bubble.startSlot + i + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-72 rounded-lg border border-line bg-surface p-4 shadow-lg"
      >
        {mode === "menu" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{bubble.project.name}</h2>
                <p className="font-mono text-xs text-graphite">
                  {startLabel}–{endLabel} · {formatSlotDuration(bubble.slotCount)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-graphite hover:text-ink"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onChangeWholeProject}
                className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
              >
                Change project
              </button>
              {bubble.slotCount >= 2 && (
                <button
                  type="button"
                  onClick={() => setMode("choose-split-point")}
                  className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
                >
                  Split…
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("confirm-delete")}
                className="rounded-md px-2 py-1.5 text-left text-sm text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </>
        )}

        {mode === "choose-split-point" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode("menu")}
                className="flex items-center gap-1 text-xs text-graphite hover:text-ink"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-graphite hover:text-ink"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
            <p className="mb-2 text-xs text-graphite">
              Choose where the new project starts. Everything from that time
              to {endLabel} will be reassigned.
            </p>
            <ul className="flex flex-col gap-1">
              {splitPoints.map((slotIndex) => (
                <li key={slotIndex}>
                  <button
                    type="button"
                    onClick={() =>
                      onSplit({
                        splitAt: slotIndex,
                        slotCount: bubble.startSlot + bubble.slotCount - slotIndex,
                      })
                    }
                    className="w-full rounded-md px-2 py-1.5 text-left font-mono text-sm hover:bg-canvas"
                  >
                    {slotIndexToLabel(slotIndex)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {mode === "confirm-delete" && (
          <>
            <p className="mb-4 text-sm">
              Delete {bubble.project.name} from {startLabel} to {endLabel}? This
              clears {formatSlotDuration(bubble.slotCount)} of scheduled time.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode("menu")}
                className="rounded px-2 py-1 text-xs text-graphite hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
