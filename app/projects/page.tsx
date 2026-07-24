"use client";

import { useEffect, useState } from "react";
import { GroupManager } from "@/components/GroupManager";
import { ProjectManager } from "@/components/ProjectManager";
import type { ProjectGroupWithCount, ProjectWithCount } from "@/types";

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

export default function ProjectsPage() {
  const [groups, setGroups] = useState<ProjectGroupWithCount[]>([]);
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [{ groups }, { projects }] = await Promise.all([
      jsonFetch<{ groups: ProjectGroupWithCount[] }>("/api/groups"),
      jsonFetch<{ projects: ProjectWithCount[] }>("/api/projects"),
    ]);
    setGroups(groups);
    setProjects(projects);
  }

  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function withErrorHandling(fn: () => Promise<unknown>) {
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-lg font-semibold">Projects &amp; groups</h1>
      <p className="mb-6 text-sm text-graphite">
        Groups set bubble color. Projects belong to a group and are what you
        actually schedule onto the calendar.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-graphite">Loading…</p>
      ) : (
        <div className="flex flex-col gap-8">
          <GroupManager
            groups={groups}
            onCreate={(name, color) =>
              withErrorHandling(() =>
                jsonFetch("/api/groups", { method: "POST", body: JSON.stringify({ name, color }) })
              )
            }
            onUpdate={(groupId, patch) =>
              withErrorHandling(() =>
                jsonFetch("/api/groups", {
                  method: "PATCH",
                  body: JSON.stringify({ groupId, ...patch }),
                })
              )
            }
            onDelete={(groupId) =>
              withErrorHandling(() =>
                jsonFetch("/api/groups", { method: "DELETE", body: JSON.stringify({ groupId }) })
              )
            }
          />

          <ProjectManager
            projects={projects}
            groups={groups}
            onCreate={(name, groupId) =>
              withErrorHandling(() =>
                jsonFetch("/api/projects", {
                  method: "POST",
                  body: JSON.stringify({ name, groupId }),
                })
              )
            }
            onUpdate={(projectId, patch) =>
              withErrorHandling(() =>
                jsonFetch("/api/projects", {
                  method: "PATCH",
                  body: JSON.stringify({ projectId, ...patch }),
                })
              )
            }
            onDelete={(projectId) =>
              withErrorHandling(() =>
                jsonFetch("/api/projects", {
                  method: "DELETE",
                  body: JSON.stringify({ projectId }),
                })
              )
            }
          />
        </div>
      )}
    </main>
  );
}
