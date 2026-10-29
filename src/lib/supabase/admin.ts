import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseUrl } from "./env";

export class MissingSecretKeyError extends Error {
  constructor() {
    super(
      "SUPABASE_SECRET_KEY is not set. Add it to .env.local and to the Vercel project's environment variables (Supabase Dashboard > Project Settings > API Keys).",
    );
  }
}

// Bypasses RLS and can manage auth users. Server-only: never import this
// from a Client Component, and never expose SUPABASE_SECRET_KEY to the browser.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new MissingSecretKeyError();
  }

  return createClient<Database>(getSupabaseUrl(), secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
