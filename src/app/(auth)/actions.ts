"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
  fields?: { fullName?: string; email?: string };
};

const MIN_PASSWORD_LENGTH = 8;

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", fields: { email } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Confirm your email address first. Check your inbox for the link."
          : "Incorrect email or password.",
      fields: { email },
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(ROLE_HOME[profile?.role ?? "employee"]);
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fields = { fullName, email };

  if (!fullName || !email || !password) {
    return { error: "Fill in all fields.", fields };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      fields,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to fill profiles.full_name.
      data: { full_name: fullName },
      emailRedirectTo: `${await getOrigin()}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message, fields };
  }

  // Email confirmation is off in Supabase: the user is already signed in.
  if (data.session) {
    redirect(ROLE_HOME.employee);
  }

  // Supabase returns the same response for an already registered email,
  // so this message doesn't reveal whether an account exists.
  return {
    message: `We sent a confirmation link to ${email}. Open it to finish signing up.`,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function getOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
