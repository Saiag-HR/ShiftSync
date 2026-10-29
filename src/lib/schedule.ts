import type { Enums } from "@/types/database";

// Shared by server and client code. Dates are plain "YYYY-MM-DD" strings
// (matching Postgres DATE) and all arithmetic is done in UTC, so results
// never shift with the server's or browser's local time zone.

export type ShiftType = Enums<"shift_type">;

export const SHIFTS: { type: ShiftType; label: string }[] = [
  { type: "morning", label: "Morning" },
  { type: "evening", label: "Evening" },
  { type: "night", label: "Night" },
];

export const SHIFT_LABELS = Object.fromEntries(
  SHIFTS.map((shift) => [shift.type, shift.label]),
) as Record<ShiftType, string>;

// Time zone used to decide what "today" is, and the first day of the week
// (0 = Sunday, 1 = Monday).
export const APP_TIME_ZONE = "Asia/Jerusalem";
export const WEEK_STARTS_ON = 0;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isShiftType(value: unknown): value is ShiftType {
  return SHIFTS.some((shift) => shift.type === value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromIsoDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number) {
  const date = fromIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function startOfWeek(iso: string) {
  const day = fromIsoDate(iso).getUTCDay();
  return addDays(iso, -((day - WEEK_STARTS_ON + 7) % 7));
}

export function weekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function todayIso(now: Date) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Week shown for a ?week= search param: the week containing that date,
// or the current week if the param is missing or invalid.
export function resolveWeekStart(param: string | string[] | undefined, today: string) {
  return isIsoDate(param) ? startOfWeek(param) : startOfWeek(today);
}

export function cellKey(date: string, shift: ShiftType) {
  return `${date}|${shift}`;
}

const weekdayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "UTC",
});
const dayMonthFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayMonthYearFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatWeekday(iso: string) {
  return weekdayFormat.format(fromIsoDate(iso));
}

export function formatDayMonth(iso: string) {
  return dayMonthFormat.format(fromIsoDate(iso));
}

export function formatWeekRange(weekStart: string) {
  const end = addDays(weekStart, 6);
  return `${dayMonthFormat.format(fromIsoDate(weekStart))} – ${dayMonthYearFormat.format(fromIsoDate(end))}`;
}
