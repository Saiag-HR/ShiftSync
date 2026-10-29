"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  isIsoDate,
  isShiftType,
  NIGHT_SHIFT_REQUIRED_MESSAGE,
  startOfWeek,
  todayIso,
  weekDates,
  type ShiftType,
} from "@/lib/schedule";
import { getAvailabilityOpen } from "@/lib/settings";
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
    return { ok: false, error: "שבוע לא תקין." };
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
    return { ok: false, error: "אפשר לעדכן רק משמרות עתידיות." };
  }

  // Also enforced by RLS; checked here to give a clear message.
  if (!(await getAvailabilityOpen())) {
    return { ok: false, error: "הגשת הזמינות השבועית סגורה כעת" };
  }

  const supabase = await createClient();

  // At least one night shift a week, unless an admin exempted the user.
  // A night already saved on an earlier (now past) day of the week counts.
  if (!user.exemptFromNightShift && !entries.some((e) => e.shift === "night" && e.available)) {
    const { data: pastNights, error: nightsError } = await supabase
      .from("shift_availabilities")
      .select("id")
      .eq("employee_id", user.id)
      .eq("shift_type", "night")
      .eq("is_available", true)
      .gte("shift_date", weekStart)
      .lt("shift_date", today)
      .limit(1);
    if (nightsError || pastNights.length === 0) {
      return { ok: false, error: NIGHT_SHIFT_REQUIRED_MESSAGE };
    }
  }

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
    return { ok: false, error: "לא הצלחנו לשמור את הזמינות. נסו שוב." };
  }

  refresh();
  return { ok: true };
}
