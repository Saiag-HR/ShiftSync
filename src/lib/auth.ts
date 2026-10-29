import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type UserRole = Enums<"user_role">;

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  // Exempt from offering at least one night shift a week.
  exemptFromNightShift: boolean;
};

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  employee: "/employee",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "מנהל",
  employee: "עובד",
};

// Reads the session at request time, so callers must render behind <Suspense>.
// Wrapped in React cache() so layouts and pages share one lookup per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, role, is_blocked, exempt_from_night_shift")
    .eq("id", data.claims.sub)
    .single();

  // Don't redirect to /login here: the proxy would bounce a signed-in
  // user straight back, causing a loop.
  if (error || !profile) {
    throw new Error("No profile found for the signed-in user.");
  }
  // Covers sessions that were open when the admin blocked the user.
  if (profile.is_blocked) {
    redirect("/blocked");
  }

  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name,
    role: profile.role ?? "employee",
    exemptFromNightShift: profile.exempt_from_night_shift,
  };
});

// Sends users to their own area if they open a page meant for another role.
export async function requireRole(role: UserRole): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.role !== role) {
    redirect(ROLE_HOME[user.role]);
  }
  return user;
}
