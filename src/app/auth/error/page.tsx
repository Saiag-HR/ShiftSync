import Link from "next/link";
import { AuthCard } from "@/components/auth-card";

export default function AuthErrorPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <AuthCard
        title="Link expired or invalid"
        description="This confirmation link can't be used anymore. Sign in, or sign up again to get a new link."
      >
        <Link
          href="/login"
          className="block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Back to sign in
        </Link>
      </AuthCard>
    </main>
  );
}
