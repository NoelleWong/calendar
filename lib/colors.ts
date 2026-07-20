import type { ProjectDTO } from "@/types";

/**
 * A project's bubble color always comes from its group — never stored
 * directly on Project or CalendarBlock. See CLAUDE.md,
 * "Rule: a block's color is always derived through its Project -> ProjectGroup."
 */
export function resolveGroupColor(project: ProjectDTO): string {
  return project.group.color;
}

/**
 * Given a hex color, decide whether bubble text/labels should render dark
 * or light for contrast. Simple relative-luminance check.
 */
export function contrastTextColor(hex: string): "#1B1D1B" | "#FFFFFF" {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1B1D1B" : "#FFFFFF";
}
