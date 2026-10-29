import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

// The header frame is static; only the user menu waits for the session.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            סידור עבודה
          </Link>
          <Suspense
            fallback={
              <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            }
          >
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-end sm:block">
        <p className="text-sm font-medium">{user.fullName}</p>
        <p className="text-xs text-zinc-500">
          <bdi>{user.username}</bdi>
        </p>
      </div>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          user.role === "admin"
            ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
            : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        }`}
      >
        {ROLE_LABELS[user.role]}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          התנתקות
        </button>
      </form>
    </div>
  );
}
