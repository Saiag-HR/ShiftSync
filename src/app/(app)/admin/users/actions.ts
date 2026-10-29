"use server";

import { refresh } from "next/cache";
import { requireRole, type UserRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult> {
  const admin = await requireRole("admin");

  if (!UUID.test(userId) || (role !== "admin" && role !== "employee")) {
    return { ok: false, error: "בקשה לא תקינה." };
  }
  // Prevents an admin from locking everyone out by demoting themselves.
  if (userId === admin.id && role !== "admin") {
    return { ok: false, error: "אי אפשר להסיר את הרשאת המנהל מעצמכם." };
  }

  // Runs as the signed-in admin, so RLS and the role guard trigger apply.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");

  if (error || data.length === 0) {
    return { ok: false, error: "לא הצלחנו לעדכן את התפקיד. נסו שוב." };
  }

  refresh();
  return { ok: true };
}

// Passwords are stored only as hashes, so they can't be shown; an admin
// sets a new one instead.
export async function resetUserPassword(
  userId: string,
  password: string,
): Promise<ActionResult> {
  await requireRole("admin");

  if (!UUID.test(userId) || typeof password !== "string" || !password) {
    return { ok: false, error: "יש להזין סיסמה חדשה." };
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(
    userId,
    { password },
  );

  if (error) {
    return {
      ok: false,
      error:
        error.code === "weak_password"
          ? "הסיסמה קצרה מדי. Supabase דורש לפחות 6 תווים."
          : "לא הצלחנו לעדכן את הסיסמה. נסו שוב.",
    };
  }

  return { ok: true };
}
