"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  isIsoDate,
  isShiftType,
  startOfWeek,
  weekDates,
  type ShiftType,
} from "@/lib/schedule";
import { AVAILABILITY_OPEN_KEY, SHIFT_HOURS_KEY } from "@/lib/settings";
import { isValidShiftHours, type ShiftHours } from "@/lib/shift-hours";
import { createClient } from "@/lib/supabase/server";

export type AssignmentChange = {
  date: string;
  shift: ShiftType;
  employeeId: string | null;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveSchedule(
  weekStart: string,
  changes: AssignmentChange[],
): Promise<SaveResult> {
  await requireRole("admin");

  if (!isIsoDate(weekStart) || startOfWeek(weekStart) !== weekStart) {
    return { ok: false, error: "שבוע לא תקין." };
  }

  const allowedDates = new Set(weekDates(weekStart));
  const valid = changes.every(
    (change) =>
      allowedDates.has(change.date) &&
      isShiftType(change.shift) &&
      (change.employeeId === null ||
        (typeof change.employeeId === "string" && UUID.test(change.employeeId))),
  );
  if (!valid || changes.length === 0) {
    return { ok: false, error: "השינויים בסידור אינם תקינים." };
  }

  // An unassigned shift is stored as a row with employee_id = null, the same
  // state the schema uses when an assigned employee's profile is deleted.
  const supabase = await createClient();
  const { error } = await supabase.from("shift_assignments").upsert(
    changes.map((change) => ({
      shift_date: change.date,
      shift_type: change.shift,
      employee_id: change.employeeId,
    })),
    { onConflict: "shift_date,shift_type" },
  );

  if (error) {
    return { ok: false, error: "לא הצלחנו לשמור את הסידור. נסו שוב." };
  }

  refresh();
  return { ok: true };
}

export async function setAvailabilityOpen(open: boolean): Promise<SaveResult> {
  await requireRole("admin");

  if (typeof open !== "boolean") {
    return { ok: false, error: "ערך לא תקין." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .update({ value: open })
    .eq("key", AVAILABILITY_OPEN_KEY)
    .select("key");

  // No row back means RLS blocked the update or the row is missing.
  if (error || data.length === 0) {
    return { ok: false, error: "לא הצלחנו לעדכן את מצב ההגשה. נסו שוב." };
  }

  refresh();
  return { ok: true };
}

export async function saveShiftHours(hours: ShiftHours): Promise<SaveResult> {
  await requireRole("admin");

  if (!isValidShiftHours(hours)) {
    return {
      ok: false,
      error: "יש להזין שעת התחלה ושעת סיום לכל משמרת, ושתי השעות חייבות להיות שונות.",
    };
  }

  // Rebuild the object so only the expected fields are stored.
  const value = {
    morning: { start: hours.morning.start, end: hours.morning.end },
    evening: { start: hours.evening.start, end: hours.evening.end },
    night: { start: hours.night.start, end: hours.night.end },
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .update({ value })
    .eq("key", SHIFT_HOURS_KEY)
    .select("key");

  if (error || data.length === 0) {
    return { ok: false, error: "לא הצלחנו לשמור את שעות המשמרות. נסו שוב." };
  }

  refresh();
  return { ok: true };
}
