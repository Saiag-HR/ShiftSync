import "server-only";
import { createClient } from "@/lib/supabase/server";

export const AVAILABILITY_OPEN_KEY = "availability_open";

// A missing row counts as open, matching is_availability_open() in the
// database, which enforces the same rule on writes.
export async function getAvailabilityOpen() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", AVAILABILITY_OPEN_KEY)
    .maybeSingle();
  if (error) throw error;
  return data?.value !== false;
}
