"use client";

import { useState } from "react";
import type { ProjectGroupWithCount, ProjectWithCount } from "@/types";

interface ProjectManagerProps {
  projects: ProjectWithCount[];
  groups: ProjectGroupWithCount[];
  onCreate: (name: string, groupId: string) => Promise<void>;
  onUpdate: (projectId: string, patch: { name?: string; groupId?: string }) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
}

export function ProjectManager({
  projects,
  groups,
  onCreate,
  onUpdate,
  onDelete,
}: ProjectManagerProps) {
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState(groups[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!newName.trim() || !newGroupId) return;
    setBusy(true);
    try {
      await onCreate(newName.trim(), newGroupId);
      setNewName("");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(project: ProjectWithCount) {
    const total = project._count.calendarBlocks + project._count.templateBlocks;
    const proceed =
      total === 0 ||
      window.confirm(
        `"${project.name}" is used in ${project._count.calendarBlocks} scheduled block(s) and ${project._count.templateBlocks} template block(s). Deleting it removes those too. Continue?`
      );
    if (!proceed) return;
    await onDelete(project.id);
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-graphite">
        Projects
      </h2>

      <ul className="mb-4 flex flex-col gap-2">
        {projects.map((project) => (
          <li
            key={project.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: project.group.color }}
              />
              <input
                defaultValue={project.name}
                onBlur={(e) => {
                  const next = e.currentTarget.value.trim();
                  if (next && next !== project.name) onUpdate(project.id, { name: next });
                }}
                className="bg-transparent text-sm outline-none focus-visible:ring-1 focus-visible:ring-ink rounded px-1"
              />
              <select
                value={project.groupId}
                onChange={(e) => onUpdate(project.id, { groupId: e.target.value })}
                className="rounded border border-line bg-surface px-1 py-0.5 text-xs"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-graphite">
                {project._count.calendarBlocks} block
                {project._count.calendarBlocks === 1 ? "" : "s"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(project)}
              className="text-xs text-graphite hover:text-ink underline"
            >
              Delete
            </button>
          </li>
        ))}
        {projects.length === 0 && (
          <li className="text-sm text-graphite">No projects yet — add one below.</li>
        )}
      </ul>

      <div className="flex items-center gap-3 rounded-md border border-dashed border-line px-3 py-2">
        <select
          value={newGroupId}
          onChange={(e) => setNewGroupId(e.target.value)}
          className="rounded border border-line bg-surface px-1 py-0.5 text-xs"
          disabled={groups.length === 0}
        >
          {groups.length === 0 && <option>Create a group first</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New project name"
          disabled={groups.length === 0}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-graphite disabled:opacity-40"
        />
        <button
          type="button"
          disabled={busy || !newName.trim() || !newGroupId}
          onClick={handleCreate}
          className="rounded bg-ink px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Add project
        </button>
      </div>
    </section>
  );
}
