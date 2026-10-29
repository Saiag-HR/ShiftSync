"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  isIsoDate,
  isShiftType,
  startOfWeek,
  todayIso,
  weekDates,
  type ShiftType,
} from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

export type AvailabilityEntry = {
  date: string;
  shift: ShiftType;
  available: boolean;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveAvailability(
  weekStart: string,
  entries: AvailabilityEntry[],
): Promise<SaveResult> {
  const user = await getCurrentUser();

  if (!isIsoDate(weekStart) || startOfWeek(weekStart) !== weekStart) {
    return { ok: false, error: "Invalid week." };
  }

  const allowedDates = new Set(weekDates(weekStart));
  const today = todayIso(new Date());

  const valid = entries.every(
    (entry) =>
      allowedDates.has(entry.date) &&
      entry.date >= today &&
      isShiftType(entry.shift) &&
      typeof entry.available === "boolean",
  );
  if (!valid || entries.length === 0) {
    return { ok: false, error: "You can only update upcoming shifts." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shift_availabilities").upsert(
    entries.map((entry) => ({
      employee_id: user.id,
      shift_date: entry.date,
      shift_type: entry.shift,
      is_available: entry.available,
    })),
    { onConflict: "employee_id,shift_date,shift_type" },
  );

  if (error) {
    return { ok: false, error: "Couldn't save your availability. Try again." };
  }

  refresh();
  return { ok: true };
}
