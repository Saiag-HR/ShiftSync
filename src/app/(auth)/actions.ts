"use server";

import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeUsername,
  USERNAME_PATTERN,
  USERNAME_RULES,
  usernameToAuthEmail,
} from "@/lib/username";

export type AuthFormState = {
  error?: string;
  fields?: { fullName?: string; username?: string };
};

const INVALID_CREDENTIALS = "שם המשתמש או הסיסמה שגויים.";
const USERNAME_TAKEN = "שם המשתמש הזה כבר תפוס. נסו שם אחר.";

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const fields = { username };

  if (!username || !password) {
    return { error: "יש להזין שם משתמש וסיסמה.", fields };
  }

  // Look up the account's auth email by username. This also covers users
  // who signed up with a real email before usernames existed.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("username", username)
    .maybeSingle();
  if (!profile) {
    return { error: INVALID_CREDENTIALS, fields };
  }

  const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
  const email = authUser.user?.email;
  if (!email) {
    return { error: INVALID_CREDENTIALS, fields };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: INVALID_CREDENTIALS, fields };
  }

  redirect(ROLE_HOME[profile.role ?? "employee"]);
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const fields = { fullName, username };

  if (!fullName || !username || !password) {
    return { error: "יש למלא את כל השדות.", fields };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { error: `שם משתמש לא תקין. ${USERNAME_RULES}`, fields };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return { error: USERNAME_TAKEN, fields };
  }

  // Created through the admin API so the account is confirmed immediately:
  // the generated email address can't receive a confirmation link.
  const email = usernameToAuthEmail(username);
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Read by the handle_new_user trigger to fill the profile.
    user_metadata: { username, full_name: fullName },
  });

  if (createError) {
    // The app sets no password rules; this is Supabase's own minimum.
    if (createError.code === "weak_password") {
      return {
        error: "הסיסמה קצרה מדי. Supabase דורש לפחות 6 תווים.",
        fields,
      };
    }
    // A username taken between the check above and now fails the
    // profile insert, or the generated email already exists.
    if (
      createError.code === "email_exists" ||
      createError.code === "unexpected_failure"
    ) {
      return { error: USERNAME_TAKEN, fields };
    }
    return { error: "לא הצלחנו ליצור את החשבון. נסו שוב.", fields };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return { error: "החשבון נוצר. התחברו כדי להמשיך.", fields };
  }

  redirect(ROLE_HOME.employee);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
