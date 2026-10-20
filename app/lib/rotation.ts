import { weeksBetween } from "@/lib/weeks";

/**
 * Template rotations — see the TemplateRotation comment in
 * prisma/schema.prisma. Pure helpers, shared by the server (filling a new
 * week) and the rotation editor (previewing upcoming weeks).
 */

export interface RotationLike<T> {
  startWeekId: string;
  /** In rotation order (sorted by position). */
  entries: T[];
}

/**
 * Index into `entries` for weekId: entry 0 on the start week, entry 1 the
 * week after, wrapping round. Computed from the distance to the start week
 * rather than by stepping a "current" pointer, so any week — opened in any
 * order — always gets the same answer.
 */
export function rotationIndex(startWeekId: string, weekId: string, length: number): number {
  const offset = weeksBetween(startWeekId, weekId);
  return ((offset % length) + length) % length;
}

/**
 * The rotation in effect for weekId: the one with the latest start week on
 * or before it. Rotations with no entries are skipped, so an emptied
 * rotation falls through to the one before it.
 */
export function rotationForWeek<R extends RotationLike<unknown>>(
  rotations: R[],
  weekId: string
): R | null {
  let best: R | null = null;
  for (const rotation of rotations) {
    if (rotation.entries.length === 0 || rotation.startWeekId > weekId) continue;
    if (!best || rotation.startWeekId > best.startWeekId) best = rotation;
  }
  return best;
}

/** The rotation entry that fills weekId, or null if no rotation covers it. */
export function rotationEntryForWeek<R extends RotationLike<unknown>>(
  rotations: R[],
  weekId: string
): { rotation: R; entry: R["entries"][number] } | null {
  const rotation = rotationForWeek(rotations, weekId);
  if (!rotation) return null;
  const entry = rotation.entries[rotationIndex(rotation.startWeekId, weekId, rotation.entries.length)];
  return { rotation, entry };
}
