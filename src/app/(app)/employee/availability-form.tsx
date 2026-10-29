"use client";

import { useState, useTransition } from "react";
import {
  cellKey,
  formatDayMonth,
  formatWeekday,
  NIGHT_SHIFT_REQUIRED_MESSAGE,
  SHIFTS,
} from "@/lib/schedule";
import { formatRange, type ShiftHours } from "@/lib/shift-hours";
import { saveAvailability, type AvailabilityEntry } from "./actions";

type Status = { tone: "success" | "error"; text: string } | null;

export function AvailabilityForm({
  weekStart,
  dates,
  today,
  initial,
  open,
  shiftHours,
  nightExempt,
}: {
  weekStart: string;
  dates: string[];
  today: string;
  // Whether an admin has opened availability submission.
  open: boolean;
  shiftHours: ShiftHours;
  // Exempt from offering at least one night shift a week.
  nightExempt: boolean;
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
  const selectedCount = editableKeys.filter((key) => values[key]).length;
  // Any night this week counts, including one already saved on a past day.
  const hasNight = dates.some((date) => values[cellKey(date, "night")]);
  const nightMissing = !nightExempt && !hasNight;
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
    if (nightMissing) {
      setStatus({ tone: "error", text: NIGHT_SHIFT_REQUIRED_MESSAGE });
      return;
    }
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
        setStatus({ tone: "success", text: "הזמינות הוגשה." });
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

  const locked = !open;

  return (
    <div className="space-y-4">
      {locked && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <span aria-hidden>🔒</span>
          הגשת הזמינות השבועית סגורה כעת
        </p>
      )}
      {open && !hasAnswered && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          עדיין לא הגשתם זמינות לשבוע הזה. סמנו את המשמרות שבהן תוכלו לעבוד,
          ואז הגישו.
        </p>
      )}
      {open && !nightExempt && (
        <p
          className={`flex items-center gap-2 text-sm ${hasNight ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          <span aria-hidden>{hasNight ? "✓" : "🌙"}</span>
          {hasNight
            ? "נבחרה משמרת לילה – אפשר להגיש"
            : "יש לבחור לפחות משמרת לילה אחת בשבוע"}
        </p>
      )}

      {!locked && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setMany(editableKeys, true)}
            disabled={pending}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            זמין כל השבוע
          </button>
          <button
            type="button"
            onClick={() => setMany(editableKeys, false)}
            disabled={pending}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ניקוי הכול
          </button>
        </div>
      )}

      {/* One card per day: a single column on phones, a grid on wider screens. */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {dates.map((date) => {
          const isPast = date < today;
          const dayKeys = SHIFTS.map((s) => cellKey(date, s.type));
          const allOn = dayKeys.every((key) => values[key]);
          const canEdit = !isPast && !locked;
          return (
            <li
              key={date}
              className={`rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 ${isPast ? "opacity-60" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold">
                  {formatWeekday(date)}{" "}
                  <span className="font-normal text-zinc-500">{formatDayMonth(date)}</span>
                  {date === today && (
                    <span className="ms-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      היום
                    </span>
                  )}
                </p>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setMany(dayKeys, !allOn)}
                    disabled={pending}
                    className="min-h-9 rounded-md px-2 text-xs font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    {allOn ? "ניקוי" : "כל היום"}
                  </button>
                ) : (
                  isPast && <span className="text-xs text-zinc-500">עבר</span>
                )}
              </div>
              <div className="grid gap-2">
                {SHIFTS.map((shift) => {
                  const key = cellKey(date, shift.type);
                  const available = Boolean(values[key]);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={available}
                      aria-label={`${shift.label}, ${formatWeekday(date)} ${formatDayMonth(date)}`}
                      disabled={!canEdit || pending}
                      onClick={() => setMany([key], !available)}
                      className={`flex min-h-14 w-full items-center justify-between gap-2 rounded-xl border px-3 text-start transition-colors disabled:cursor-not-allowed ${
                        available
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                      } ${locked ? "opacity-60" : ""}`}
                    >
                      <span>
                        <span className="block text-sm font-medium">{shift.label}</span>
                        <span className="block text-xs opacity-80" dir="ltr">
                          {formatRange(shiftHours[shift.type])}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                          available
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        {available && "✓"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pinned to the bottom on phones so saving is always within reach. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none dark:border-zinc-800 dark:bg-zinc-900/95 sm:dark:bg-transparent">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {selectedCount === 0
              ? "לא סומנו משמרות"
              : selectedCount === 1
                ? "סומנה משמרת אחת"
                : `סומנו ${selectedCount} משמרות`}
          </p>
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
            disabled={pending || !isDirty || locked}
            className="min-h-12 w-full rounded-xl bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-sm dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "מגישים…" : locked ? "ההגשה סגורה" : "הגש זמינות"}
          </button>
        </div>
      </div>
    </div>
  );
}
