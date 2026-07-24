"use client";

import { useEffect, useState } from "react";
import { CalendarGrid } from "@/components/CalendarGrid";
import { WeekCountsSummary } from "@/components/WeekCountsSummary";
import { ProjectPicker } from "@/components/ProjectPicker";
import { countWeek } from "@/lib/counts";
import type { CalendarBlockDTO, ProjectGroupWithCount, ProjectWithCount } from "@/types";

interface PendingSlot {
  dayOfWeek: number;
  slotIndex: number;
}

export default function CalendarWeekPage({
  params,
}: {
  params: { weekId: string };
}) {
  const { weekId } = params;
  const [blocks, setBlocks] = useState<CalendarBlockDTO[]>([]);
  const [groups, setGroups] = useState<ProjectGroupWithCount[]>([]);
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshBlocks() {
    const res = await fetch(`/api/blocks?weekId=${encodeURIComponent(weekId)}`);
    const data = await res.json();
    setBlocks(data.blocks ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/blocks?weekId=${encodeURIComponent(weekId)}`).then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ])
      .then(([blocksData, groupsData, projectsData]) => {
        if (cancelled) return;
        setBlocks(blocksData.blocks ?? []);
        setGroups(groupsData.groups ?? []);
        setProjects(projectsData.projects ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekId]);

  async function handleSelectProject(projectId: string) {
    if (!pendingSlot) return;
    const { dayOfWeek, slotIndex } = pendingSlot;
    setPendingSlot(null); // close immediately, optimistic
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId, dayOfWeek, slotIndex, projectId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to assign project");
      }
      await refreshBlocks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign project");
    }
  }

  // TODO: wire onBubbleClick to an edit/split/delete affordance for that
  // project's run of slots.

  return (
    <main className="p-6">
      <h1 className="mb-4 text-lg font-semibold">Week {weekId}</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-graphite">Loading…</p>
      ) : (
        <div className="flex items-start gap-6">
          <CalendarGrid
            weekId={weekId}
            blocks={blocks}
            onEmptySlotClick={(dayOfWeek, slotIndex) =>
              setPendingSlot({ dayOfWeek, slotIndex })
            }
          />
          <WeekCountsSummary counts={countWeek(weekId, blocks)} />
        </div>
      )}

      <ProjectPicker
        open={pendingSlot !== null}
        groups={groups}
        projects={projects}
        onSelect={handleSelectProject}
        onClose={() => setPendingSlot(null)}
      />
    </main>
  );
}

