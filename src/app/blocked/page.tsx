import type { Metadata } from "next";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: "החשבון נחסם" };

// Where a signed-in user lands if an admin blocks them mid-session.
export default function BlockedPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-12 text-center dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold tracking-tight">
        החשבון נחסם ע&quot;י המנהל
      </h1>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
        אין לך גישה למערכת כרגע. לבירור, פנו למנהל.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          התנתקות
        </button>
      </form>
    </main>
  );
}
