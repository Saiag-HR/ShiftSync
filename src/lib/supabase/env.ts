// Public Supabase settings, safe for both server and browser code.
// NEXT_PUBLIC_ variables are inlined at build time, so they must be read
// with these literal names. NEXT_PUBLIC_SUPABASE_ANON_KEY is accepted as an
// older name for the same key.

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }
  return url;
}

export function getSupabasePublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set (Supabase Dashboard > Project Settings > API Keys).",
    );
  }
  return key;
}
