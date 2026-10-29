"use client";

import { signOut } from "../(auth)/actions";

// Shown when a signed-in page fails to load, e.g. a missing profile.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold">משהו השתבש</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        לא הצלחנו לטעון את הדף. נסו שוב, ואם הבעיה חוזרת התנתקו והתחברו מחדש.
      </p>
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          נסו שוב
        </button>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            התנתקות
          </button>
        </form>
      </div>
    </div>
  );
}
