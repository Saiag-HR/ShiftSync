import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of the sign-up confirmation email. Supports both the default
// template (?code=..., PKCE) and a custom one using {{ .TokenHash }}.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let succeeded = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    succeeded = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    succeeded = !error;
  }

  const destination = request.nextUrl.clone();
  destination.pathname = succeeded ? "/dashboard" : "/auth/error";
  destination.search = "";
  return NextResponse.redirect(destination);
}
