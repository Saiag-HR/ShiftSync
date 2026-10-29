"use client";

import { useState, useTransition } from "react";
import {
  cellKey,
  formatDayMonth,
  formatWeekday,
  SHIFTS,
} from "@/lib/schedule";
import { saveAvailability, type AvailabilityEntry } from "./actions";

type Status = { tone: "success" | "error"; text: string } | null;

export function AvailabilityForm({
  weekStart,
  dates,
  today,
  initial,
}: {
  weekStart: string;
  dates: string[];
  today: string;
  // Keyed by cellKey(); missing keys mean the employee hasn't answered yet.
  initial: Record<string, boolean>;
}) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  const editableDates = dates.filter((date) => date >= today);
  const editableKeys = editableDates.flatMap((date) =>
    SHIFTS.map((shift) => cellKey(date, shift.type)),
  );
  const hasAnswered = Object.keys(saved).length > 0;
  const isDirty =
    !hasAnswered && editableKeys.length > 0
      ? true
      : editableKeys.some((key) => Boolean(values[key]) !== Boolean(saved[key]));

  function setMany(keys: string[], available: boolean) {
    setValues((prev) => {
      const next = { ...prev };
      keys.forEach((key) => (next[key] = available));
      return next;
    });
    setStatus(null);
  }

  function handleSave() {
    // Save every upcoming cell, so unchecked shifts are stored as
    // "unavailable" rather than looking unanswered to the admin.
    const entries: AvailabilityEntry[] = editableDates.flatMap((date) =>
      SHIFTS.map((shift) => ({
        date,
        shift: shift.type,
        available: Boolean(values[cellKey(date, shift.type)]),
      })),
    );

    startTransition(async () => {
      const result = await saveAvailability(weekStart, entries);
      if (result.ok) {
        const next = { ...values };
        entries.forEach((e) => (next[cellKey(e.date, e.shift)] = e.available));
        setSaved(next);
        setValues(next);
        setStatus({ tone: "success", text: "הזמינות נשמרה." });
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  }

  if (editableDates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        השבוע הזה כבר עבר, ולכן אי אפשר לשנות בו את הזמינות.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!hasAnswered && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          עדיין לא הגשתם זמינות לשבוע הזה. סמנו את המשמרות שבהן תוכלו לעבוד,
          ואז שמרו.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-24 p-3" />
              {dates.map((date) => {
                const isPast = date < today;
                const dayKeys = SHIFTS.map((s) => cellKey(date, s.type));
                const allOn = dayKeys.every((key) => values[key]);
                return (
                  <th
                    key={date}
                    scope="col"
                    className={`p-3 text-center font-medium ${isPast ? "text-zinc-400" : ""}`}
                  >
                    <span className="block">{formatWeekday(date)}</span>
                    <span className="block text-xs font-normal text-zinc-500">
                      {formatDayMonth(date)}
                    </span>
                    {!isPast && (
                      <button
                        type="button"
                        onClick={() => setMany(dayKeys, !allOn)}
                        className="mt-1 text-xs font-normal text-zinc-500 underline hover:text-zinc-900 dark:hover:text-white"
                      >
                        {allOn ? "ניקוי" : "כל היום"}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift) => (
              <tr
                key={shift.type}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <th scope="row" className="p-3 text-start font-medium">
                  {shift.label}
                </th>
                {dates.map((date) => {
                  const key = cellKey(date, shift.type);
                  const isPast = date < today;
                  const available = Boolean(values[key]);
                  return (
                    <td key={key} className="p-1.5">
                      <button
                        type="button"
                        aria-pressed={available}
                        aria-label={`${shift.label}, ${formatWeekday(date)} ${formatDayMonth(date)}`}
                        disabled={isPast || pending}
                        onClick={() => setMany([key], !available)}
                        className={`h-12 w-full rounded-lg border text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                          available
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950"
                        } ${isPast ? "opacity-50" : ""}`}
                      >
                        {available ? "זמין" : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMany(editableKeys, true)}
            disabled={pending}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            זמין כל השבוע
          </button>
          <button
            type="button"
            onClick={() => setMany(editableKeys, false)}
            disabled={pending}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ניקוי הכול
          </button>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <p
              role={status.tone === "error" ? "alert" : "status"}
              className={`text-sm ${status.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              {status.text}
            </p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !isDirty}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "שומרים…" : "שמירת זמינות"}
          </button>
        </div>
      </div>
    </div>
  );
}
