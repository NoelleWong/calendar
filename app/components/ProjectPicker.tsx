"use client";

import { useEffect, useState } from "react";
import type { ProjectGroupWithCount, ProjectWithCount } from "@/types";

interface ProjectPickerProps {
  open: boolean;
  groups: ProjectGroupWithCount[];
  projects: ProjectWithCount[];
  onSelect: (projectId: string) => void;
  onClose: () => void;
}

/**
 * Two-step picker: pick a ProjectGroup (by color/name) first, then pick a
 * Project within that group. Resets to step 1 every time it opens so the
 * next slot assignment always starts from the group choice, per spec.
 */
export function ProjectPicker({ open, groups, projects, onSelect, onClose }: ProjectPickerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedGroupId(null);
  }, [open]);

  if (!open) return null;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;
  const projectsInGroup = selectedGroup
    ? projects.filter((p) => p.groupId === selectedGroup.id)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={selectedGroup ? `Choose project in ${selectedGroup.name}` : "Choose project group"}
        onClick={(e) => e.stopPropagation()}
        className="w-72 rounded-lg border border-line bg-surface p-4 shadow-lg"
      >
        {!selectedGroup ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Choose a group</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-graphite hover:text-ink"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {groups.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
                  >
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.name}
                  </button>
                </li>
              ))}
              {groups.length === 0 && (
                <li className="px-2 py-1.5 text-sm text-graphite">
                  No groups yet — create one on the Projects page first.
                </li>
              )}
            </ul>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedGroupId(null)}
                className="flex items-center gap-1 text-xs text-graphite hover:text-ink"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-graphite hover:text-ink"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedGroup.color }}
              />
              <h2 className="text-sm font-semibold">{selectedGroup.name}</h2>
            </div>
            <ul className="flex flex-col gap-1">
              {projectsInGroup.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(project.id)}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
                  >
                    {project.name}
                  </button>
                </li>
              ))}
              {projectsInGroup.length === 0 && (
                <li className="px-2 py-1.5 text-sm text-graphite">
                  No projects in this group yet — add one on the Projects page.
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
