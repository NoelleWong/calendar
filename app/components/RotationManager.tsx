"use client";

import { useEffect, useState } from "react";
import { rotationForWeek, rotationIndex } from "@/lib/rotation";
import { addWeeks, currentWeekId, formatWeekRange, isValidWeekId } from "@/lib/weeks";
import type { RotationDTO, TemplateRef } from "@/types";

const PREVIEW_WEEKS = 4;

interface RotationDraft {
  name: string;
  startWeekId: string;
  templateIds: string[];
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

/**
 * Lists and edits template rotations (see TemplateRotation in
 * prisma/schema.prisma). `templates` is the Templates page's list; rotations
 * are refetched whenever it changes, since renaming or deleting a template
 * changes what its rotations show.
 */
export function RotationManager({ templates }: { templates: TemplateRef[] }) {
  const [rotations, setRotations] = useState<RotationDTO[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const { rotations } = await jsonFetch<{ rotations: RotationDTO[] }>("/api/rotations");
    setRotations(rotations);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [templates]);

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn();
      await refresh();
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    }
  }

  const thisWeek = currentWeekId();
  const active = rotationForWeek(rotations, thisWeek);
  const sortedStarts = rotations.map((r) => r.startWeekId).sort();

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-graphite">Rotations</h2>
      <p className="mb-3 text-sm text-graphite">
        A rotation fills new weeks with its templates in turn — the first on its start week, the next
        the week after, then back to the first. The rotation that started most recently is the one in
        use; to switch to a new set, add a rotation that starts on the week you switch. Weeks you&apos;ve
        already opened keep what they have (use &ldquo;Apply to this week&rdquo; on the calendar to
        change one).
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rotations.map((rotation) => (
          <RotationEditor
            key={`${rotation.id}:${rotation.updatedAt}`}
            initial={{
              name: rotation.name,
              startWeekId: rotation.startWeekId,
              templateIds: rotation.entries.map((e) => e.templateId),
            }}
            templates={templates}
            isActive={active?.id === rotation.id}
            endsBefore={sortedStarts.find((w) => w > rotation.startWeekId) ?? null}
            onSave={(draft) =>
              run(() =>
                jsonFetch("/api/rotations", {
                  method: "PATCH",
                  body: JSON.stringify({ rotationId: rotation.id, ...draft }),
                })
              )
            }
            onDelete={() => {
              if (!window.confirm(`Delete rotation "${rotation.name}"? Weeks already filled from it keep their blocks.`)) return;
              run(() =>
                jsonFetch("/api/rotations", {
                  method: "DELETE",
                  body: JSON.stringify({ rotationId: rotation.id }),
                })
              );
            }}
          />
        ))}

        {rotations.length === 0 && !creating && (
          <p className="text-sm text-graphite">No rotations yet — new weeks use the Default template.</p>
        )}

        {creating ? (
          <RotationEditor
            initial={{ name: "", startWeekId: thisWeek, templateIds: [] }}
            templates={templates}
            isActive={false}
            endsBefore={null}
            isNew
            onSave={async (draft) => {
              const ok = await run(() =>
                jsonFetch("/api/rotations", { method: "POST", body: JSON.stringify(draft) })
              );
              if (ok) setCreating(false);
              return ok;
            }}
            onDelete={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={templates.length === 0}
            className="self-start rounded border border-dashed border-line px-3 py-2 text-sm text-graphite hover:text-ink disabled:opacity-40"
          >
            + New rotation
          </button>
        )}
      </div>
    </section>
  );
}

interface RotationEditorProps {
  initial: RotationDraft;
  templates: TemplateRef[];
  isActive: boolean;
  /** Start week of the next rotation after this one, which takes over from that week. */
  endsBefore: string | null;
  isNew?: boolean;
  onSave: (draft: RotationDraft) => Promise<boolean>;
  /** Delete for a saved rotation; cancel for a new one. */
  onDelete: () => void;
}

function RotationEditor({ initial, templates, isActive, endsBefore, isNew = false, onSave, onDelete }: RotationEditorProps) {
  const [name, setName] = useState(initial.name);
  const [startWeekId, setStartWeekId] = useState(initial.startWeekId);
  const [templateIds, setTemplateIds] = useState(initial.templateIds);
  const [busy, setBusy] = useState(false);

  const dirty =
    isNew ||
    name !== initial.name ||
    startWeekId !== initial.startWeekId ||
    templateIds.join(",") !== initial.templateIds.join(",");
  const startValid = isValidWeekId(startWeekId);
  const canSave = dirty && name.trim() !== "" && startValid && templateIds.length > 0 && !busy;
  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? "(deleted template)";

  function move(index: number, delta: -1 | 1) {
    setTemplateIds((ids) => {
      const next = [...ids];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }

  async function handleSave() {
    setBusy(true);
    try {
      await onSave({ name: name.trim(), startWeekId, templateIds });
    } finally {
      setBusy(false);
    }
  }

  // Which template each of the next few weeks gets from this rotation,
  // stopping where a later rotation takes over.
  const preview: { weekId: string; templateId: string }[] = [];
  if (startValid && templateIds.length > 0) {
    const thisWeek = currentWeekId();
    let week = startWeekId > thisWeek ? startWeekId : thisWeek;
    while (preview.length < PREVIEW_WEEKS && (!endsBefore || week < endsBefore)) {
      preview.push({ weekId: week, templateId: templateIds[rotationIndex(startWeekId, week, templateIds.length)] });
      week = addWeeks(week, 1);
    }
  }

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rotation name"
          aria-label="Rotation name"
          className="min-w-0 flex-1 rounded px-1 text-base font-medium outline-none focus-visible:ring-1 focus-visible:ring-ink sm:text-sm"
        />
        {isActive && (
          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-white">In use this week</span>
        )}
      </div>

      <label className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-graphite">
        Starts week
        {/* type="week" gives a week picker where supported (Chrome, Edge, Android);
            elsewhere it's a text box taking the same "2026-W44" format. */}
        <input
          type="week"
          value={startWeekId}
          onChange={(e) => setStartWeekId(e.target.value)}
          placeholder="2026-W44"
          className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-base text-ink sm:text-sm"
        />
        <span className="text-xs">
          {startValid ? formatWeekRange(startWeekId) : "Use the format 2026-W44"}
          {endsBefore && ` · until ${endsBefore}`}
        </span>
      </label>

      <ol className="mt-3 flex flex-col gap-1">
        {templateIds.map((id, i) => (
          <li key={i} className="flex items-center gap-1 rounded-md bg-canvas px-2 py-1 text-sm">
            <span className="w-5 shrink-0 font-mono text-xs text-graphite">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="p-1.5 text-xs text-graphite hover:text-ink disabled:opacity-30"
              aria-label={`Move ${nameOf(id)} earlier`}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === templateIds.length - 1}
              className="p-1.5 text-xs text-graphite hover:text-ink disabled:opacity-30"
              aria-label={`Move ${nameOf(id)} later`}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => setTemplateIds((ids) => ids.filter((_, j) => j !== i))}
              className="p-1.5 text-xs text-graphite hover:text-ink"
              aria-label={`Remove ${nameOf(id)}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
      <select
        value=""
        onChange={(e) => e.target.value && setTemplateIds((ids) => [...ids, e.target.value])}
        aria-label="Add a template to this rotation"
        className="mt-1 rounded border border-dashed border-line bg-surface px-1 py-1 text-base text-graphite sm:text-sm"
      >
        <option value="">+ Add template…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {preview.length > 0 && (
        <p className="mt-3 text-xs text-graphite">
          {preview.map((p, i) => (
            <span key={p.weekId}>
              {i > 0 && " · "}
              <span className="whitespace-nowrap">
                <span className="font-mono">{p.weekId}</span> {nameOf(p.templateId)}
              </span>
            </span>
          ))}
          {(!endsBefore || addWeeks(preview[preview.length - 1].weekId, 1) < endsBefore) && " · …"}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="mr-auto px-1 py-1.5 text-xs text-graphite underline hover:text-ink"
        >
          {isNew ? "Cancel" : "Delete"}
        </button>
        {!isNew && dirty && (
          <button
            type="button"
            onClick={() => {
              setName(initial.name);
              setStartWeekId(initial.startWeekId);
              setTemplateIds(initial.templateIds);
            }}
            className="px-2 py-1.5 text-xs text-graphite hover:text-ink"
          >
            Discard changes
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="rounded bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {isNew ? "Create rotation" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>
    </div>
  );
}
