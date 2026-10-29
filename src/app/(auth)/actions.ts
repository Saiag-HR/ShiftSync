"use server";

import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/auth";
import { createAdminClient, MissingSecretKeyError } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  generateAuthEmail,
  isValidUsername,
  normalizeUsername,
  USERNAME_RULES,
  usernameKey,
} from "@/lib/username";

export type AuthFormState = {
  error?: string;
  fields?: { fullName?: string; username?: string };
};

const INVALID_CREDENTIALS = "שם המשתמש או הסיסמה שגויים.";
const USERNAME_TAKEN = "שם המשתמש הזה כבר תפוס. נסו שם אחר.";
const BLOCKED = 'החשבון נחסם ע"י המנהל';
const SERVER_MISCONFIGURED =
  "המערכת אינה מוגדרת כראוי (חסר מפתח שרת). פנו למנהל המערכת.";

function adminClientOrNull() {
  try {
    return createAdminClient();
  } catch (error) {
    if (error instanceof MissingSecretKeyError) {
      console.error(error.message);
      return null;
    }
    throw error;
  }
}

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

  const admin = adminClientOrNull();
  if (!admin) return { error: SERVER_MISCONFIGURED, fields };

  // Find the account by username (case-insensitive), then sign in with its
  // auth email. This also covers older accounts with a real email.
  const { data: profile, error: lookupError } = await admin
    .from("profiles")
    .select("id, role, is_blocked")
    .eq("username_key", usernameKey(username))
    .maybeSingle();
  if (lookupError) {
    console.error("Sign-in lookup failed:", lookupError.message);
    return { error: "לא הצלחנו להתחבר כרגע. נסו שוב בעוד רגע.", fields };
  }
  if (!profile) {
    return { error: INVALID_CREDENTIALS, fields };
  }

  const { data: authUser, error: authUserError } =
    await admin.auth.admin.getUserById(profile.id);
  const email = authUser.user?.email;
  if (authUserError || !email) {
    console.error(
      `Sign-in: auth account ${profile.id} can't be loaded:`,
      authUserError?.message ?? "no email",
    );
    return { error: "החשבון הזה פגום. פנו למנהל המערכת.", fields };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Supabase Auth checks the password before the ban, so "blocked" is only
  // shown to someone who knows the password, not to anyone probing names.
  if (error?.code === "user_banned") {
    return { error: BLOCKED, fields };
  }
  if (error) {
    return { error: INVALID_CREDENTIALS, fields };
  }
  // Fallback if the profile is blocked but the Auth ban didn't apply.
  if (profile.is_blocked) {
    await supabase.auth.signOut();
    return { error: BLOCKED, fields };
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
  if (!isValidUsername(username)) {
    return { error: `שם משתמש לא תקין. ${USERNAME_RULES}`, fields };
  }

  const admin = adminClientOrNull();
  if (!admin) return { error: SERVER_MISCONFIGURED, fields };

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username_key", usernameKey(username))
    .maybeSingle();
  if (existing) {
    return { error: USERNAME_TAKEN, fields };
  }

  // Created through the admin API so the account is confirmed immediately:
  // the generated email address can't receive a confirmation link.
  const email = generateAuthEmail();
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
    // The profile insert fails if the username was taken in the meantime.
    console.error("Sign-up failed:", createError.code, createError.message);
    return {
      error:
        createError.code === "unexpected_failure"
          ? USERNAME_TAKEN
          : "לא הצלחנו ליצור את החשבון. נסו שוב.",
      fields,
    };
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
