"use client";

import { formatSlotDuration } from "@/lib/counts";
import type { WeekCounts } from "@/types";

/**
 * Renders one week's aggregate counts (by project, and rolled up by group).
 * Purely presentational — the aggregation itself happens in lib/counts.ts
 * against raw CalendarBlock rows, independent of bubble rendering.
 */
export function WeekCountsSummary({ counts }: { counts: WeekCounts }) {
  return (
    <div className="w-56 rounded-md border border-line bg-surface p-3 text-sm">
      <div className="mb-1 font-mono text-xs text-graphite">{counts.weekId}</div>

      <div className="mb-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-graphite">
          By group
        </div>
        {counts.byGroup.length === 0 && (
          <div className="text-xs text-graphite">No blocks yet</div>
        )}
        {counts.byGroup.map(({ group, slotCount }) => (
          <div key={group.id} className="flex items-center justify-between py-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              {group.name}
            </span>
            <span className="font-mono text-xs text-graphite">
              {formatSlotDuration(slotCount)}
            </span>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-graphite">
          By project
        </div>
        {counts.byProject.map(({ project, slotCount }) => (
          <div key={project.id} className="flex items-center justify-between py-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: project.group.color }}
              />
              {project.name}
            </span>
            <span className="font-mono text-xs text-graphite">
              {formatSlotDuration(slotCount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
