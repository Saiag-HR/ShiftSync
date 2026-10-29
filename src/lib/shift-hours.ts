import type { Json } from "@/types/database";
import { SHIFTS, type ShiftType } from "@/lib/schedule";

// Shared by server and client code. Times are "HH:MM" (24-hour). A shift
// whose end is earlier than its start runs past midnight.

export type ShiftRange = { start: string; end: string };
export type ShiftHours = Record<ShiftType, ShiftRange>;

export const DEFAULT_SHIFT_HOURS: ShiftHours = {
  morning: { start: "07:00", end: "15:00" },
  evening: { start: "15:00", end: "23:00" },
  night: { start: "23:00", end: "07:00" },
};

// Must match is_valid_shift_hours() in the database.
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidRange(range: unknown): range is ShiftRange {
  if (typeof range !== "object" || range === null) return false;
  const { start, end } = range as Record<string, unknown>;
  return (
    typeof start === "string" &&
    typeof end === "string" &&
    TIME_PATTERN.test(start) &&
    TIME_PATTERN.test(end) &&
    start !== end
  );
}

export function isValidShiftHours(value: unknown): value is ShiftHours {
  if (typeof value !== "object" || value === null) return false;
  const hours = value as Record<string, unknown>;
  return SHIFTS.every((shift) => isValidRange(hours[shift.type]));
}

// Reads the stored setting, falling back to defaults for anything missing
// or malformed so the schedule always has hours to show.
export function parseShiftHours(value: Json | undefined): ShiftHours {
  const stored =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return Object.fromEntries(
    SHIFTS.map((shift) => {
      const range = stored[shift.type];
      return [
        shift.type,
        isValidRange(range)
          ? { start: range.start, end: range.end }
          : DEFAULT_SHIFT_HOURS[shift.type],
      ];
    }),
  ) as ShiftHours;
}

export function formatRange({ start, end }: ShiftRange) {
  return `${start}–${end}`;
}
