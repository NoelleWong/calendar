import type { CalendarBlockDTO, WeekCounts } from "@/types";

/**
 * Count blocks (30-min slots) by project and by group for a single week's
 * worth of blocks. Deliberately operates on raw CalendarBlock rows, NOT on
 * merged bubbles — a count reflects actual time spent, and must stay
 * correct regardless of how bubbles happen to render. See CLAUDE.md.
 */
export function countWeek(weekId: string, blocks: CalendarBlockDTO[]): WeekCounts {
  const byProjectMap = new Map<
    string,
    { project: CalendarBlockDTO["project"]; slotCount: number }
  >();
  const byGroupMap = new Map<
    string,
    { group: CalendarBlockDTO["project"]["group"]; slotCount: number }
  >();

  for (const block of blocks) {
    const project = block.project;
    const group = project.group;

    const projectEntry = byProjectMap.get(project.id);
    if (projectEntry) {
      projectEntry.slotCount += 1;
    } else {
      byProjectMap.set(project.id, { project, slotCount: 1 });
    }

    const groupEntry = byGroupMap.get(group.id);
    if (groupEntry) {
      groupEntry.slotCount += 1;
    } else {
      byGroupMap.set(group.id, { group, slotCount: 1 });
    }
  }

  return {
    weekId,
    byProject: [...byProjectMap.values()].sort(
      (a, b) => b.slotCount - a.slotCount
    ),
    byGroup: [...byGroupMap.values()].sort((a, b) => b.slotCount - a.slotCount),
  };
}

/** Convenience: turn a slot count into a "Xh Ym" label (30-min slots). */
export function formatSlotDuration(slotCount: number): string {
  const totalMinutes = slotCount * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Count multiple weeks at once, for the comparison view. */
export function countWeeks(
  weekBlocks: { weekId: string; blocks: CalendarBlockDTO[] }[]
): WeekCounts[] {
  return weekBlocks.map(({ weekId, blocks }) => countWeek(weekId, blocks));
}
