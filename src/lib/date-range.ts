import { addDays, isIsoDate, startOfWeek } from "@/lib/schedule";

// Date ranges for the statistics page. Dates are "YYYY-MM-DD" strings, and
// both ends of a range are inclusive.

export type RangePreset = "week" | "month" | "last-month" | "3-months" | "custom";

export type DateRange = { from: string; to: string; preset: RangePreset };

// Longest range allowed, to keep queries bounded.
const MAX_RANGE_DAYS = 731;

const pad = (n: number) => String(n).padStart(2, "0");

export function monthBounds(year: number, month: number) {
  // month is 1-12; day 0 of the next month is this month's last day.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

function parseMonth(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// Reads ?preset=, ?month=YYYY-MM or ?from=&to= into a range. Defaults to
// the current month.
export function resolveRange(
  params: Record<string, string | string[] | undefined>,
  today: string,
): DateRange {
  const [year, month] = today.split("-").map(Number);
  const preset = params.preset;

  if (preset === "week") {
    const from = startOfWeek(today);
    return { from, to: addDays(from, 6), preset };
  }
  if (preset === "last-month") {
    const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
    return { ...monthBounds(prev.y, prev.m), preset };
  }
  if (preset === "3-months") {
    const start = month <= 2 ? { y: year - 1, m: month + 10 } : { y: year, m: month - 2 };
    return {
      from: monthBounds(start.y, start.m).from,
      to: monthBounds(year, month).to,
      preset,
    };
  }

  const picked = parseMonth(params.month);
  if (picked) {
    return { ...monthBounds(picked.year, picked.month), preset: "custom" };
  }

  const { from, to } = params;
  if (isIsoDate(from) && isIsoDate(to) && from <= to && daysBetween(from, to) <= MAX_RANGE_DAYS) {
    return { from, to, preset: "custom" };
  }

  return { ...monthBounds(year, month), preset: "month" };
}

// Calendar weeks (Sunday start) that overlap the range.
export function weekStartsInRange(from: string, to: string) {
  const starts: string[] = [];
  for (let week = startOfWeek(from); week <= to; week = addDays(week, 7)) {
    starts.push(week);
  }
  return starts;
}

// Calendar months that overlap the range.
export function monthsInRange(from: string, to: string) {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}
