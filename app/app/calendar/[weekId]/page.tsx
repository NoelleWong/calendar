"use client";

import { useEffect, useState } from "react";
import { CalendarGrid } from "@/components/CalendarGrid";
import { WeekCountsSummary } from "@/components/WeekCountsSummary";
import { ProjectPicker } from "@/components/ProjectPicker";
import { BubbleActionSheet } from "@/components/BubbleActionSheet";
import { countWeek } from "@/lib/counts";
import { resizeOps } from "@/lib/bubbles";
import type {
  Bubble,
  CalendarBlockDTO,
  ProjectGroupWithCount,
  ProjectWithCount,
} from "@/types";

/** A pending "assign these slots to a project" request, feeding the ProjectPicker. */
interface PendingAssignment {
  dayOfWeek: number;
  slotIndex: number;
  slotCount: number;
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
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);
  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);
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
    if (!pendingAssignment) return;
    const { dayOfWeek, slotIndex, slotCount } = pendingAssignment;
    setPendingAssignment(null); // close immediately, optimistic
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId, dayOfWeek, slotIndex, slotCount, projectId }),
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

  /**
   * Drag-to-resize commit. "Extending" a pill duplicates its project onto
   * the newly covered slots (POST upsert — same overwrite semantics as
   * whole-bubble reassignment); "shrinking" clears the given-up slots
   * (DELETE). resizeOps diffs old vs. new range into those per-edge writes.
   */
  async function handleResizeBubble(bubble: Bubble, newStartSlot: number, newSlotCount: number) {
    const { dayOfWeek, startSlot, slotCount, projectId } = bubble;
    const ops = resizeOps(startSlot, slotCount, newStartSlot, newSlotCount);
    if (ops.length === 0) return;
    try {
      for (const op of ops) {
        const res =
          op.type === "assign"
            ? await fetch("/api/blocks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  weekId,
                  dayOfWeek,
                  slotIndex: op.slotIndex,
                  slotCount: op.slotCount,
                  projectId,
                }),
              })
            : await fetch("/api/blocks", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  weekId,
                  dayOfWeek,
                  slotIndex: op.slotIndex,
                  slotCount: op.slotCount,
                }),
              });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to resize block");
        }
      }
      await refreshBlocks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resize block");
    }
  }

  async function handleDeleteBubble() {
    if (!selectedBubble) return;
    const { dayOfWeek, startSlot, slotCount } = selectedBubble;
    setSelectedBubble(null); // close immediately, optimistic
    try {
      const res = await fetch("/api/blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId, dayOfWeek, slotIndex: startSlot, slotCount }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete block");
      }
      await refreshBlocks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete block");
    }
  }

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
              setPendingAssignment({ dayOfWeek, slotIndex, slotCount: 1 })
            }
            onBubbleClick={(bubble) => setSelectedBubble(bubble)}
            onBubbleResize={handleResizeBubble}
          />
          <WeekCountsSummary counts={countWeek(weekId, blocks)} />
        </div>
      )}

      {selectedBubble && (
        <BubbleActionSheet
          bubble={selectedBubble}
          onChangeWholeProject={() => {
            setPendingAssignment({
              dayOfWeek: selectedBubble.dayOfWeek,
              slotIndex: selectedBubble.startSlot,
              slotCount: selectedBubble.slotCount,
            });
            setSelectedBubble(null);
          }}
          onSplit={({ splitAt, slotCount }) => {
            setPendingAssignment({
              dayOfWeek: selectedBubble.dayOfWeek,
              slotIndex: splitAt,
              slotCount,
            });
            setSelectedBubble(null);
          }}
          onDelete={handleDeleteBubble}
          onClose={() => setSelectedBubble(null)}
        />
      )}

      <ProjectPicker
        open={pendingAssignment !== null}
        groups={groups}
        projects={projects}
        onSelect={handleSelectProject}
        onClose={() => setPendingAssignment(null)}
      />
    </main>
  );
}

