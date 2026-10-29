import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";

// For use in Server Components, Server Actions and Route Handlers.
// Create a new client per request; don't share it across requests.
export async function createClient() {
  // Supabase Auth reads Date.now() to check session expiry. Cookie reads
  // alone don't stop Cache Components from prerendering (partial
  // prefetching can render cookie-dependent content ahead of time), so
  // defer everything that uses this client to request time.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
