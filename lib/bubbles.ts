import type { Bubble, CalendarBlockDTO } from "@/types";

/**
 * Merge one day's worth of atomic 30-min CalendarBlocks into display
 * bubbles: consecutive slots with the same projectId collapse into a single
 * bubble whose slotCount determines its rendered length.
 *
 * Never persist the result — recompute on every render. See CLAUDE.md,
 * "Rule: bubbles are a display-layer merge, never stored."
 *
 * @param blocks all blocks for ONE day (any order — this sorts by slotIndex)
 */
export function mergeBlocksIntoBubbles(blocks: CalendarBlockDTO[]): Bubble[] {
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
  blocks: CalendarBlockDTO[]
): Record<number, Bubble[]> {
  const byDay = new Map<number, CalendarBlockDTO[]>();

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
