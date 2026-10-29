"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setAvailabilityOpen } from "./actions";

// Saves immediately on click; employees' pages update live.
export function AvailabilityToggle({ open }: { open: boolean }) {
  const [optimisticOpen, setOptimisticOpen] = useOptimistic(open);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !optimisticOpen;
    setError(null);
    startTransition(async () => {
      setOptimisticOpen(next);
      const result = await setAvailabilityOpen(next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          optimisticOpen
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        }`}
      >
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${optimisticOpen ? "bg-emerald-500" : "bg-zinc-500"}`}
        />
        {optimisticOpen ? "הגשת הזמינות פתוחה" : "הגשת הזמינות סגורה"}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-70 ${
          optimisticOpen
            ? "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        {optimisticOpen ? "סגור הגשת זמינות" : "פתח הגשת זמינות"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
