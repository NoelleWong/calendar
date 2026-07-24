/** Convert a 0–47 slotIndex into an "HH:MM" label (30-min increments). */
export function slotIndexToLabel(slotIndex: number): string {
  const totalMinutes = slotIndex * 30;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
