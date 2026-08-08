import { SLOTS_PER_DAY } from "@/types";
import type { Bubble, ProjectDTO } from "@/types";

/**
 * The minimal shape mergeBlocksIntoBubbles needs. Both CalendarBlockDTO
 * (which also carries id/weekId/createdFrom) and the template editor's
 * local in-memory slot state satisfy this structurally, so the same merge
 * logic drives both the live calendar and the template editor.
 */
export interface MergeableSlot {
  dayOfWeek: number;
  slotIndex: number;
  project: ProjectDTO;
}

/**
 * Merge one day's worth of atomic 30-min slots into display bubbles:
 * consecutive slots with the same projectId collapse into a single bubble
 * whose slotCount determines its rendered length.
 *
 * Never persist the result — recompute on every render. See CLAUDE.md,
 * "Rule: bubbles are a display-layer merge, never stored."
 *
 * @param blocks all slots for ONE day (any order — this sorts by slotIndex)
 */
export function mergeBlocksIntoBubbles(blocks: MergeableSlot[]): Bubble[] {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => a.slotIndex - b.slotIndex);
  const bubbles: Bubble[] = [];

  let current: Bubble | null = null;

  for (const block of sorted) {
    const isContiguous =
      current !== null &&
      current.projectId === block.project.id &&
      current.startSlot + current.slotCount === block.slotIndex;

    if (isContiguous && current) {
      current.slotCount += 1;
    } else {
      if (current) bubbles.push(current);
      current = {
        dayOfWeek: block.dayOfWeek,
        projectId: block.project.id,
        project: block.project,
        startSlot: block.slotIndex,
        slotCount: 1,
      };
    }
  }

  if (current) bubbles.push(current);

  return bubbles;
}

/**
 * Group a full week's blocks by day, then merge each day independently.
 * Bubbles never span across days even if slotIndex wraps (slot 47 of one
 * day is never contiguous with slot 0 of the next).
 */
export function mergeWeekIntoBubbles(
  blocks: MergeableSlot[]
): Record<number, Bubble[]> {
  const byDay = new Map<number, MergeableSlot[]>();

  for (const block of blocks) {
    const existing = byDay.get(block.dayOfWeek) ?? [];
    existing.push(block);
    byDay.set(block.dayOfWeek, existing);
  }

  const result: Record<number, Bubble[]> = {};
  for (const [day, dayBlocks] of byDay.entries()) {
    result[day] = mergeBlocksIntoBubbles(dayBlocks);
  }
  return result;
}

/** One contiguous range of a single day's slots, plus what to do with it. */
export interface ResizeOp {
  /** "assign" duplicates the bubble's project onto the range (extension);
   * "clear" empties the range (shrink). */
  type: "assign" | "clear";
  slotIndex: number;
  slotCount: number;
}

/**
 * Diff a bubble's old (startSlot, slotCount) against a proposed new one —
 * the result of dragging one of its edges — into the underlying per-slot
 * writes needed to realize it. Per CLAUDE.md, bubbles are never persisted
 * directly; "extending a pill" is really duplicating the project onto the
 * newly covered slots, and "shrinking" is clearing the slots given up.
 *
 * Handles either edge moving (or, in principle, both) generically by
 * comparing old/new start and end independently: at most one "assign" and
 * one "clear" op come back, one per edge that actually changed.
 */
export function resizeOps(
  oldStart: number,
  oldSlotCount: number,
  newStart: number,
  newSlotCount: number
): ResizeOp[] {
  const oldEnd = oldStart + oldSlotCount;
  const newEnd = newStart + newSlotCount;
  const ops: ResizeOp[] = [];

  if (newStart < oldStart) {
    ops.push({ type: "assign", slotIndex: newStart, slotCount: oldStart - newStart });
  } else if (newStart > oldStart) {
    ops.push({ type: "clear", slotIndex: oldStart, slotCount: newStart - oldStart });
  }

  if (newEnd > oldEnd) {
    ops.push({ type: "assign", slotIndex: oldEnd, slotCount: newEnd - oldEnd });
  } else if (newEnd < oldEnd) {
    ops.push({ type: "clear", slotIndex: newEnd, slotCount: oldEnd - newEnd });
  }

  return ops;
}

/**
 * Find the free run of `length` consecutive slots (within one day) closest
 * to `preferredStart`, for placing a duplicated bubble. `occupied` is every
 * taken slotIndex in that day — including the bubble being duplicated, so
 * the copy never lands on top of the original. Ties (equally close before
 * vs. after) prefer the run starting at or after `preferredStart`.
 *
 * Returns null if no run of that length is free anywhere in the day.
 */
export function findFreeRun(
  occupied: ReadonlySet<number>,
  length: number,
  preferredStart: number
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;

  for (let start = 0; start + length <= SLOTS_PER_DAY; start++) {
    let free = true;
    for (let i = 0; i < length; i++) {
      if (occupied.has(start + i)) {
        free = false;
        break;
      }
    }
    if (!free) continue;

    const dist = Math.abs(start - preferredStart);
    const better =
      best === null ||
      dist < bestDist ||
      (dist === bestDist && start >= preferredStart && best < preferredStart);
    if (better) {
      best = start;
      bestDist = dist;
    }
  }

  return best;
}
