"use client";

import { useEffect, useState } from "react";
import type { TemplateRef, WeekTemplateInfo } from "@/types";

interface WeekTemplateBarProps {
  info: WeekTemplateInfo | null;
  templates: TemplateRef[];
  /** Whether the week currently has any blocks — applying replaces them, so confirm first. */
  hasBlocks: boolean;
  onApply: (templateId: string) => Promise<void>;
}

/**
 * Shows which template this week was filled from (and what its rotation
 * schedules, if that's different), and lets the user apply any template to
 * this week alone. Applying replaces the week's blocks with a fresh copy of
 * the template; the template itself never changes.
 */
export function WeekTemplateBar({ info, templates, hasBlocks, onApply }: WeekTemplateBarProps) {
  const applied = info?.appliedTemplate ?? null;
  const scheduled = info?.scheduled ?? null;
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);

  // Preselect what the rotation says this week should be, so "it drifted
  // from the rotation" is a one-tap fix.
  useEffect(() => {
    setSelectedId(scheduled?.template.id ?? applied?.id ?? templates[0]?.id ?? "");
  }, [scheduled?.template.id, applied?.id, templates]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  async function handleApply() {
    if (!selected) return;
    if (
      hasBlocks &&
      !window.confirm(
        `Replace this week's blocks with "${selected.name}"? Any changes you've made to this week will be lost. The template itself won't change.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await onApply(selected.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-3 py-2 text-sm">
      <div className="min-w-0 flex-1 basis-60">
        {applied ? (
          <p>
            Filled from <span className="font-medium">{applied.name}</span>
            {scheduled?.template.id === applied.id && scheduled.rotation && (
              <span className="text-graphite"> · rotation &ldquo;{scheduled.rotation.name}&rdquo;</span>
            )}
          </p>
        ) : (
          <p className="text-graphite">Not filled from a template</p>
        )}
        {scheduled && scheduled.template.id !== applied?.id && (
          <p className="text-xs text-graphite">
            {scheduled.rotation ? (
              <>Rotation &ldquo;{scheduled.rotation.name}&rdquo; schedules </>
            ) : (
              <>Your default template is </>
            )}
            <span className="font-medium text-ink">{scheduled.template.name}</span>
            {scheduled.rotation && " for this week"}
          </p>
        )}
      </div>

      {templates.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Template to apply to this week"
            className="min-w-0 max-w-[12rem] rounded border border-line bg-surface px-1 py-1 text-base sm:text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy || !selected}
            className="shrink-0 rounded bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {selected && selected.id === applied?.id ? "Reset to template" : "Apply to this week"}
          </button>
        </div>
      )}
    </div>
  );
}
