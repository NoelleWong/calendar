"use client";

import { useEffect, useState } from "react";
import { CalendarGrid } from "@/components/CalendarGrid";
import { WeekCountsSummary } from "@/components/WeekCountsSummary";
import { countWeek } from "@/lib/counts";
import type { CalendarBlockDTO } from "@/types";

export default function CalendarWeekPage({
  params,
}: {
  params: { weekId: string };
}) {
  const { weekId } = params;
  const [blocks, setBlocks] = useState<CalendarBlockDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/blocks?weekId=${encodeURIComponent(weekId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBlocks(data.blocks ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekId]);

  // TODO: wire onEmptySlotClick to a project picker (modal/popover) that
  // POSTs to /api/blocks with { weekId, dayOfWeek, slotIndex, projectId }.
  // TODO: wire onBubbleClick to an edit/split/delete affordance for that
  // project's run of slots.

  return (
    <main className="p-6">
      <h1 className="mb-4 text-lg font-semibold">Week {weekId}</h1>
      {loading ? (
        <p className="text-sm text-graphite">Loading…</p>
      ) : (
        <div className="flex items-start gap-6">
          <CalendarGrid weekId={weekId} blocks={blocks} />
          <WeekCountsSummary counts={countWeek(weekId, blocks)} />
        </div>
      )}
    </main>
  );
}
