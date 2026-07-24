"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarGrid } from "@/components/CalendarGrid";
import { WeekCountsSummary } from "@/components/WeekCountsSummary";
import { countWeeks } from "@/lib/counts";
import type { CalendarBlockDTO } from "@/types";

/** /compare?weeks=2026-W29,2026-W30 */
export default function ComparePage() {
  const searchParams = useSearchParams();
  const weekIds = (searchParams.get("weeks") ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  const [blocksByWeek, setBlocksByWeek] = useState<Record<string, CalendarBlockDTO[]>>({});
  const [loading, setLoading] = useState(true);
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const syncingRef = useRef(false);

  useEffect(() => {
    if (weekIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    const qs = weekIds.map((w) => `weekId=${encodeURIComponent(w)}`).join("&");
    fetch(`/api/blocks?${qs}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const blocks: CalendarBlockDTO[] = data.blocks ?? [];
        const grouped: Record<string, CalendarBlockDTO[]> = {};
        for (const weekId of weekIds) grouped[weekId] = [];
        for (const b of blocks) grouped[b.weekId]?.push(b);
        setBlocksByWeek(grouped);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekIds.join(",")]);

  function handleScroll(sourceWeekId: string, scrollTop: number) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    scrollRefs.current.forEach((el, weekId) => {
      if (weekId !== sourceWeekId) el.scrollTop = scrollTop;
    });
    syncingRef.current = false;
  }

  if (weekIds.length === 0) {
    return (
      <main className="p-6">
        <p className="text-sm text-graphite">
          Add one or more weeks to compare, e.g.{" "}
          <code className="font-mono">/compare?weeks=2026-W29,2026-W30</code>
        </p>
      </main>
    );
  }

  const weekCounts = countWeeks(
    weekIds.map((weekId) => ({ weekId, blocks: blocksByWeek[weekId] ?? [] }))
  );

  return (
    <main className="p-6">
      <h1 className="mb-4 text-lg font-semibold">Compare weeks</h1>
      {loading ? (
        <p className="text-sm text-graphite">Loading…</p>
      ) : (
        <div className="flex items-start gap-8 overflow-x-auto">
          {weekIds.map((weekId, i) => (
            <div key={weekId} className="flex flex-col gap-3">
              <div
                ref={(el) => {
                  if (el) scrollRefs.current.set(weekId, el);
                }}
                onScroll={(e) => handleScroll(weekId, e.currentTarget.scrollTop)}
                className="max-h-[80vh] overflow-y-auto"
              >
                <CalendarGrid weekId={weekId} blocks={blocksByWeek[weekId] ?? []} />
              </div>
              <WeekCountsSummary counts={weekCounts[i]} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
