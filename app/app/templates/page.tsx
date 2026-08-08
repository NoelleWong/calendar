"use client";

import { useEffect, useState } from "react";
import { CalendarGrid } from "@/components/CalendarGrid";
import { ProjectPicker } from "@/components/ProjectPicker";
import { BubbleActionSheet } from "@/components/BubbleActionSheet";
import { resizeOps, findFreeRun } from "@/lib/bubbles";
import { formatSlotDuration } from "@/lib/counts";
import type {
  Bubble,
  ProjectDTO,
  ProjectGroupWithCount,
  ProjectWithCount,
} from "@/types";

interface TemplateSummary {
  id: string;
  name: string;
  isDefault: boolean;
  blocks: { dayOfWeek: number; slotIndex: number; project: ProjectDTO }[];
}

/** One occupied slot in the template being edited — kept in local state and
 * only sent to the server as a whole on "Save changes", since PATCH
 * /api/templates replaces a template's blocks wholesale. */
interface TemplateSlot {
  dayOfWeek: number;
  slotIndex: number;
  project: ProjectDTO;
}

function assignRange(
  slots: TemplateSlot[],
  dayOfWeek: number,
  slotIndex: number,
  slotCount: number,
  project: ProjectDTO
): TemplateSlot[] {
  const kept = slots.filter(
    (s) => !(s.dayOfWeek === dayOfWeek && s.slotIndex >= slotIndex && s.slotIndex < slotIndex + slotCount)
  );
  const added = Array.from({ length: slotCount }, (_, i) => ({
    dayOfWeek,
    slotIndex: slotIndex + i,
    project,
  }));
  return [...kept, ...added];
}

function deleteRange(
  slots: TemplateSlot[],
  dayOfWeek: number,
  slotIndex: number,
  slotCount: number
): TemplateSlot[] {
  return slots.filter(
    (s) => !(s.dayOfWeek === dayOfWeek && s.slotIndex >= slotIndex && s.slotIndex < slotIndex + slotCount)
  );
}

interface PendingAssignment {
  dayOfWeek: number;
  slotIndex: number;
  slotCount: number;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [groups, setGroups] = useState<ProjectGroupWithCount[]>([]);
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [slots, setSlots] = useState<TemplateSlot[]>([]);
  const [dirty, setDirty] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);
  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);

  async function refresh() {
    const [{ templates }, { groups }, { projects }] = await Promise.all([
      jsonFetch<{ templates: TemplateSummary[] }>("/api/templates"),
      jsonFetch<{ groups: ProjectGroupWithCount[] }>("/api/groups"),
      jsonFetch<{ projects: ProjectWithCount[] }>("/api/projects"),
    ]);
    setTemplates(templates);
    setGroups(groups);
    setProjects(projects);
  }

  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function selectTemplate(template: TemplateSummary) {
    if (dirty && !window.confirm("Discard unsaved changes to the current template?")) return;
    setSelectedTemplateId(template.id);
    setSlots(template.blocks.map((b) => ({ dayOfWeek: b.dayOfWeek, slotIndex: b.slotIndex, project: b.project })));
    setDirty(false);
  }

  async function handleCreateTemplate() {
    if (!newTemplateName.trim()) return;
    try {
      const { template } = await jsonFetch<{ template: TemplateSummary }>("/api/templates", {
        method: "POST",
        body: JSON.stringify({ name: newTemplateName.trim(), blocks: [] }),
      });
      setNewTemplateName("");
      await refresh();
      selectTemplate(template);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create template");
    }
  }

  async function handleSetDefault(templateId: string) {
    try {
      await jsonFetch("/api/templates", {
        method: "PATCH",
        body: JSON.stringify({ templateId, isDefault: true }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set default");
    }
  }

  async function handleRename(templateId: string, name: string) {
    try {
      await jsonFetch("/api/templates", {
        method: "PATCH",
        body: JSON.stringify({ templateId, name }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename template");
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    try {
      await jsonFetch("/api/templates", {
        method: "DELETE",
        body: JSON.stringify({ templateId }),
      });
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        setSlots([]);
        setDirty(false);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete template");
    }
  }

  async function handleSave() {
    if (!selectedTemplateId) return;
    try {
      await jsonFetch("/api/templates", {
        method: "PATCH",
        body: JSON.stringify({
          templateId: selectedTemplateId,
          blocks: slots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            slotIndex: s.slotIndex,
            projectId: s.project.id,
          })),
        }),
      });
      setDirty(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
    }
  }

  function handleSelectProject(projectId: string) {
    if (!pendingAssignment) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const { dayOfWeek, slotIndex, slotCount } = pendingAssignment;
    setSlots((prev) => assignRange(prev, dayOfWeek, slotIndex, slotCount, project));
    setDirty(true);
    setPendingAssignment(null);
  }

  /**
   * Drag-to-resize commit for the in-memory template editor. Same semantics
   * as the live calendar's handler (see calendar/[weekId]/page.tsx): extending
   * duplicates the project onto newly covered slots, shrinking clears the
   * given-up slots — just applied to local `slots` state instead of the API,
   * since template edits aren't sent to the server until "Save changes".
   */
  function handleResizeBubble(bubble: Bubble, newStartSlot: number, newSlotCount: number) {
    const ops = resizeOps(bubble.startSlot, bubble.slotCount, newStartSlot, newSlotCount);
    if (ops.length === 0) return;
    setSlots((prev) => {
      let next = prev;
      for (const op of ops) {
        next =
          op.type === "assign"
            ? assignRange(next, bubble.dayOfWeek, op.slotIndex, op.slotCount, bubble.project)
            : deleteRange(next, bubble.dayOfWeek, op.slotIndex, op.slotCount);
      }
      return next;
    });
    setDirty(true);
  }

  /**
   * Copies the bubble's project into the nearest free run of the same
   * length on the same day, in the local `slots` state — same placement
   * logic as the live calendar's duplicate handler.
   */
  function handleDuplicateBubble() {
    if (!selectedBubble) return;
    const bubble = selectedBubble;
    setSelectedBubble(null);
    const occupied = new Set(
      slots.filter((s) => s.dayOfWeek === bubble.dayOfWeek).map((s) => s.slotIndex)
    );
    const start = findFreeRun(occupied, bubble.slotCount, bubble.startSlot);
    if (start === null) {
      setError(
        `No free ${formatSlotDuration(bubble.slotCount)} run left on that day to duplicate into.`
      );
      return;
    }
    setSlots((prev) => assignRange(prev, bubble.dayOfWeek, start, bubble.slotCount, bubble.project));
    setDirty(true);
  }

  /**
   * Drag-to-move commit: clear the bubble's old range, then assign its
   * project onto the new range (possibly a different day) — mirrors the
   * live calendar's handler but against local `slots` state.
   */
  function handleMoveBubble(bubble: Bubble, newDayOfWeek: number, newStartSlot: number) {
    if (newDayOfWeek === bubble.dayOfWeek && newStartSlot === bubble.startSlot) return;
    setSlots((prev) => {
      const cleared = deleteRange(prev, bubble.dayOfWeek, bubble.startSlot, bubble.slotCount);
      return assignRange(cleared, newDayOfWeek, newStartSlot, bubble.slotCount, bubble.project);
    });
    setDirty(true);
  }

  function handleDeleteBubble() {
    if (!selectedBubble) return;
    const { dayOfWeek, startSlot, slotCount } = selectedBubble;
    setSlots((prev) => deleteRange(prev, dayOfWeek, startSlot, slotCount));
    setDirty(true);
    setSelectedBubble(null);
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  return (
    <main className="p-6">
      <h1 className="mb-1 text-lg font-semibold">Templates</h1>
      <p className="mb-6 text-sm text-graphite">
        Edit a template&apos;s default week, then save. New weeks are populated
        from whichever template is marked Default.
      </p>

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
        <div className="flex items-start gap-8">
          {/* Template list */}
          <div className="w-56 flex-shrink-0">
            <ul className="mb-3 flex flex-col gap-1">
              {templates.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                    t.id === selectedTemplateId ? "bg-canvas" : "hover:bg-canvas"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectTemplate(t)}
                    className="flex-1 truncate text-left"
                  >
                    {t.name}
                    {t.isDefault && (
                      <span className="ml-1.5 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Default
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="text-xs text-graphite hover:text-ink"
                    aria-label={`Delete ${t.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
              {templates.length === 0 && (
                <li className="text-sm text-graphite">No templates yet.</li>
              )}
            </ul>

            <div className="flex items-center gap-1 rounded-md border border-dashed border-line px-2 py-1.5">
              <input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTemplate()}
                placeholder="New template name"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-graphite"
              />
              <button
                type="button"
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim()}
                className="rounded bg-ink px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1">
            {!selectedTemplate ? (
              <p className="text-sm text-graphite">
                Select a template on the left to edit it, or create a new one.
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-3">
                  <input
                    defaultValue={selectedTemplate.name}
                    onBlur={(e) => {
                      const next = e.currentTarget.value.trim();
                      if (next && next !== selectedTemplate.name) {
                        handleRename(selectedTemplate.id, next);
                      }
                    }}
                    className="rounded border border-line bg-surface px-2 py-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ink"
                  />
                  {!selectedTemplate.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(selectedTemplate.id)}
                      className="rounded border border-line px-2 py-1 text-xs hover:bg-canvas"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty}
                    className="rounded bg-ink px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {dirty ? "Save changes" : "Saved"}
                  </button>
                </div>

                <CalendarGrid
                  weekId={selectedTemplate.name}
                  blocks={slots}
                  onEmptySlotClick={(dayOfWeek, slotIndex) =>
                    setPendingAssignment({ dayOfWeek, slotIndex, slotCount: 1 })
                  }
                  onBubbleClick={(bubble) => setSelectedBubble(bubble)}
                  onBubbleResize={handleResizeBubble}
                  onBubbleMove={handleMoveBubble}
                />
              </>
            )}
          </div>
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
          onDuplicate={handleDuplicateBubble}
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
