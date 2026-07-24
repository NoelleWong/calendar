"use client";

import { useState } from "react";
import { ColorPicker } from "./ColorPicker";
import type { ProjectGroupWithCount } from "@/types";

interface GroupManagerProps {
  groups: ProjectGroupWithCount[];
  onCreate: (name: string, color: string) => Promise<void>;
  onUpdate: (groupId: string, patch: { name?: string; color?: string }) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
}

const DEFAULT_NEW_COLOR = "#4F46E5";

export function GroupManager({ groups, onCreate, onUpdate, onDelete }: GroupManagerProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await onCreate(newName.trim(), newColor);
      setNewName("");
      setNewColor(DEFAULT_NEW_COLOR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(group: ProjectGroupWithCount) {
    const projectCount = group._count.projects;
    const proceed =
      projectCount === 0 ||
      window.confirm(
        `"${group.name}" has ${projectCount} project${
          projectCount === 1 ? "" : "s"
        }. Deleting it also deletes those projects and all their scheduled blocks. Continue?`
      );
    if (!proceed) return;
    await onDelete(group.id);
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-graphite">
        Project groups
      </h2>

      <ul className="mb-4 flex flex-col gap-2">
        {groups.map((group) => (
          <li
            key={group.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <ColorPicker
                value={group.color}
                onChange={(color) => onUpdate(group.id, { color })}
              />
              <input
                defaultValue={group.name}
                onBlur={(e) => {
                  const next = e.currentTarget.value.trim();
                  if (next && next !== group.name) onUpdate(group.id, { name: next });
                }}
                className="bg-transparent text-sm outline-none focus-visible:ring-1 focus-visible:ring-ink rounded px-1"
              />
              <span className="text-xs text-graphite">
                {group._count.projects} project{group._count.projects === 1 ? "" : "s"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(group)}
              className="text-xs text-graphite hover:text-ink underline"
            >
              Delete
            </button>
          </li>
        ))}
        {groups.length === 0 && (
          <li className="text-sm text-graphite">No groups yet — add one below.</li>
        )}
      </ul>

      <div className="flex items-center gap-3 rounded-md border border-dashed border-line px-3 py-2">
        <ColorPicker value={newColor} onChange={setNewColor} />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New group name"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-graphite"
        />
        <button
          type="button"
          disabled={busy || !newName.trim()}
          onClick={handleCreate}
          className="rounded bg-ink px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Add group
        </button>
      </div>
    </section>
  );
}
