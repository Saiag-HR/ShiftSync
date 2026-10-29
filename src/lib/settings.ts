import "server-only";
import { cache } from "react";
import { parseShiftHours } from "@/lib/shift-hours";
import { createClient } from "@/lib/supabase/server";

export const AVAILABILITY_OPEN_KEY = "availability_open";
export const SHIFT_HOURS_KEY = "shift_hours";

// One query for all settings, shared by everything rendering the request.
export const getSystemSettings = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", [AVAILABILITY_OPEN_KEY, SHIFT_HOURS_KEY]);
  if (error) throw error;

  const values = new Map(data.map((row) => [row.key, row.value]));
  return {
    // A missing row counts as open, matching is_availability_open() in the
    // database, which enforces the same rule on writes.
    availabilityOpen: values.get(AVAILABILITY_OPEN_KEY) !== false,
    shiftHours: parseShiftHours(values.get(SHIFT_HOURS_KEY)),
  };
});

export async function getAvailabilityOpen() {
  return (await getSystemSettings()).availabilityOpen;
}
