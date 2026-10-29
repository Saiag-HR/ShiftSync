import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/employee"];
const AUTH_PAGES = ["/login", "/signup"];

// Refreshes the auth session cookie on every matched request, and makes
// optimistic redirects based on whether the user is signed in. Role checks
// happen in the app itself (see src/lib/auth.ts); RLS is the real guard.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims():
  // it validates the JWT and triggers the token refresh.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const matches = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  if (!isSignedIn && PROTECTED_PREFIXES.some(matches)) {
    return redirectWithCookies(request, response, "/login");
  }
  if (isSignedIn && AUTH_PAGES.some(matches)) {
    return redirectWithCookies(request, response, "/dashboard");
  }

  return response;
}

// Carry over any refreshed session cookies, or the user gets signed out.
function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
