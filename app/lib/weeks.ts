/**
 * ISO week helpers. Weeks are identified by a weekId like "2026-W29"
 * (Monday-start ISO weeks, see CLAUDE.md). All date math is done on UTC
 * midnights so DST shifts can't knock a week boundary off by an hour.
 */

const WEEK_ID_RE = /^(\d{4})-W(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/** UTC midnight of the Monday that starts weekId, or null if malformed. */
export function weekIdToMonday(weekId: string): Date | null {
  const match = WEEK_ID_RE.exec(weekId);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  // Jan 4 is always in ISO week 1; step back to that week's Monday.
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Weekday = (new Date(jan4).getUTCDay() + 6) % 7; // 0 = Monday
  return new Date(jan4 - jan4Weekday * MS_PER_DAY + (week - 1) * MS_PER_WEEK);
}

/** The weekId containing a given calendar date (its UTC Y/M/D fields). */
export function dateToWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - weekday + 3); // the week's Thursday decides its ISO year
  const isoYear = d.getUTCFullYear();
  const week1Monday = weekIdToMonday(`${isoYear}-W01`)!;
  const week = 1 + Math.round((d.getTime() - 3 * MS_PER_DAY - week1Monday.getTime()) / MS_PER_WEEK);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * True only for a well-formed weekId that names a real week — rejects e.g.
 * "2026-W53" (2026 has 52 ISO weeks) as well as unpadded "2026-W5", since
 * rotation lookups compare weekIds as strings and rely on the padding.
 */
export function isValidWeekId(weekId: string): boolean {
  const monday = weekIdToMonday(weekId);
  return monday !== null && dateToWeekId(monday) === weekId;
}

/** The week `count` weeks after (negative: before) weekId. */
export function addWeeks(weekId: string, count: number): string {
  const monday = weekIdToMonday(weekId);
  if (!monday) throw new Error(`Invalid weekId: ${weekId}`);
  return dateToWeekId(new Date(monday.getTime() + count * MS_PER_WEEK));
}

/** Whole weeks from `from` to `to` (negative if `to` is earlier). */
export function weeksBetween(from: string, to: string): number {
  const a = weekIdToMonday(from);
  const b = weekIdToMonday(to);
  if (!a || !b) throw new Error(`Invalid weekId: ${!a ? from : to}`);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_WEEK);
}

/** The current week, by the local calendar date of whoever calls this. */
export function currentWeekId(): string {
  const now = new Date();
  return dateToWeekId(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** "2026-W44" → "26 Oct – 1 Nov 2026", for labelling a week in the UI. */
export function formatWeekRange(weekId: string): string {
  const monday = weekIdToMonday(weekId);
  if (!monday) return weekId;
  const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
  const day = (d: Date) => d.getUTCDate();
  const month = (d: Date) => d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  return `${day(monday)}${sameMonth ? "" : ` ${month(monday)}`} – ${day(sunday)} ${month(sunday)} ${sunday.getUTCFullYear()}`;
}
