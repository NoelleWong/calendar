// Shared domain types. Keep these in sync with prisma/schema.prisma.

export type CreatedFrom = "TEMPLATE" | "MANUAL";

export interface ProjectGroupDTO {
  id: string;
  name: string;
  color: string; // hex
}

export interface ProjectDTO {
  id: string;
  name: string;
  groupId: string;
  group: ProjectGroupDTO;
}

// Raw atomic storage unit (matches CalendarBlock row shape, joined with project).
export interface CalendarBlockDTO {
  id: string;
  weekId: string;
  dayOfWeek: number; // 0 (Mon) – 6 (Sun)
  slotIndex: number; // 0–47
  createdFrom: CreatedFrom;
  project: ProjectDTO;
}

export interface TemplateBlockDTO {
  id: string;
  dayOfWeek: number;
  slotIndex: number;
  project: ProjectDTO;
}

// Computed, never persisted — see CLAUDE.md "bubbles are a display-layer
// merge, never stored." One Bubble = one run of consecutive same-project
// slots on the same day.
export interface Bubble {
  dayOfWeek: number;
  projectId: string;
  project: ProjectDTO;
  startSlot: number;
  slotCount: number;
}

// Result of lib/counts.ts aggregation, per week.
export interface WeekCounts {
  weekId: string;
  byProject: { project: ProjectDTO; slotCount: number }[];
  byGroup: { group: ProjectGroupDTO; slotCount: number }[];
}

// Variants returned by /api/groups and /api/projects, which include usage
// counts so the management UI can warn before a destructive delete.
export interface ProjectGroupWithCount extends ProjectGroupDTO {
  _count: { projects: number };
}

export interface ProjectWithCount extends ProjectDTO {
  _count: { calendarBlocks: number; templateBlocks: number };
}

export const SLOTS_PER_DAY = 48; // 24h * 2 (30-min slots)
export const DAYS_PER_WEEK = 7;
