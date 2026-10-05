// UTC date-only arithmetic keeps the same cells across browser time zones.
export const dayNumber = (value: string) =>
  Date.parse(`${value}T00:00:00Z`) / 86400000;
export const dateAt = (day: number) =>
  new Date(day * 86400000).toISOString().slice(0, 10);
export function validDate(value: string) {
  const day = dayNumber(value);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(day) &&
    dateAt(day) === value
  );
}
export function monday(value: string) {
  const day = dayNumber(value);
  return dateAt(day - ((new Date(day * 86400000).getUTCDay() + 6) % 7));
}
export function calendarDays(start: string, weeks: number) {
  if (!validDate(start)) throw new Error('Tanggal kalender tidak valid');
  const count = Math.max(1, Math.min(26, Math.trunc(weeks) || 1)) * 7;
  return Array.from({ length: count }, (_, i) => dateAt(dayNumber(start) + i));
}
export function calendarGroups(days: string[], mode: 'week' | 'month') {
  const groups: { key: string; start: string; count: number }[] = [];
  for (const date of days) {
    const key = mode === 'week' ? monday(date) : date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.key === key) last.count++;
    else groups.push({ key, start: date, count: 1 });
  }
  return groups;
}
export function barPosition(
  start: string,
  finish: string,
  progress: string,
  windowStart: string,
  count: number,
) {
  const a = dayNumber(start),
    b = dayNumber(finish) + 1,
    w = dayNumber(windowStart);
  const left = Math.max(a, w),
    right = Math.min(b, w + count);
  if (right <= left) return null;
  const completedEnd =
    a + ((b - a) * Math.max(0, Math.min(100, Number(progress)))) / 100;
  return {
    left: left - w,
    width: right - left,
    completed: Math.max(0, Math.min(right, completedEnd) - left),
  };
}
