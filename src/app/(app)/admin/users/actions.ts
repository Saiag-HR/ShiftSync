"use server";

import { refresh } from "next/cache";
import { requireRole, type UserRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  generateAuthEmail,
  isValidUsername,
  normalizeUsername,
  USERNAME_RULES,
  usernameKey,
} from "@/lib/username";

export type ActionResult = { ok: true } | { ok: false; error: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Long enough to be permanent; cleared again on unblock.
const BAN_DURATION = "876000h";

export type NewUser = {
  fullName: string;
  username: string;
  password: string;
  role: UserRole;
};

export async function createUser(input: NewUser): Promise<ActionResult> {
  await requireRole("admin");

  const fullName = String(input.fullName ?? "").trim();
  const username = normalizeUsername(input.username);
  const password = String(input.password ?? "");
  const role = input.role;

  if (!fullName || !username || !password) {
    return { ok: false, error: "יש למלא את כל השדות." };
  }
  if (!isValidUsername(username)) {
    return { ok: false, error: `שם משתמש לא תקין. ${USERNAME_RULES}` };
  }
  if (role !== "admin" && role !== "employee") {
    return { ok: false, error: "תפקיד לא תקין." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username_key", usernameKey(username))
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "שם המשתמש הזה כבר תפוס." };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: generateAuthEmail(),
    password,
    email_confirm: true,
    // Read by the handle_new_user trigger to fill the profile.
    user_metadata: { username, full_name: fullName },
  });
  if (error || !data.user) {
    return {
      ok: false,
      error:
        error?.code === "weak_password"
          ? "הסיסמה קצרה מדי. Supabase דורש לפחות 6 תווים."
          : error?.code === "unexpected_failure"
            ? "שם המשתמש הזה כבר תפוס."
            : "לא הצלחנו ליצור את המשתמש. נסו שוב.",
    };
  }

  // New profiles start as employees; promote if requested.
  if (role === "admin") {
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", data.user.id);
    if (roleError) {
      refresh();
      return { ok: false, error: "המשתמש נוצר כעובד, אך לא הצלחנו להגדיר אותו כמנהל." };
    }
  }

  refresh();
  return { ok: true };
}

export async function setNightShiftExempt(
  userId: string,
  exempt: boolean,
): Promise<ActionResult> {
  await requireRole("admin");

  if (!UUID.test(userId) || typeof exempt !== "boolean") {
    return { ok: false, error: "בקשה לא תקינה." };
  }

  // Runs as the signed-in admin; the guard trigger stops anyone else.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ exempt_from_night_shift: exempt })
    .eq("id", userId)
    .select("id");
  if (error || data.length === 0) {
    return { ok: false, error: "לא הצלחנו לעדכן את הפטור. נסו שוב." };
  }

  refresh();
  return { ok: true };
}

export async function setUserBlocked(
  userId: string,
  blocked: boolean,
): Promise<ActionResult> {
  const currentAdmin = await requireRole("admin");

  if (!UUID.test(userId) || typeof blocked !== "boolean") {
    return { ok: false, error: "בקשה לא תקינה." };
  }
  if (userId === currentAdmin.id) {
    return { ok: false, error: "אי אפשר לחסום את עצמכם." };
  }

  // Ban in Supabase Auth first: it stops new sign-ins and session refreshes.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(
    userId,
    { ban_duration: blocked ? BAN_DURATION : "none" },
  );
  if (banError) {
    return { ok: false, error: "לא הצלחנו לעדכן את סטטוס החסימה. נסו שוב." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_blocked: blocked })
    .eq("id", userId)
    .select("id");
  if (error || data.length === 0) {
    return { ok: false, error: "לא הצלחנו לעדכן את סטטוס החסימה. נסו שוב." };
  }

  refresh();
  return { ok: true };
}

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
