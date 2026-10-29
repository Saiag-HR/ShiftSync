"use client";

import { useState, useTransition } from "react";
import { SHIFTS, type ShiftType } from "@/lib/schedule";
import {
  formatRange,
  isValidRange,
  type ShiftHours,
} from "@/lib/shift-hours";
import { saveShiftHours } from "./actions";

type Status = { tone: "success" | "error"; text: string } | null;

export function ShiftSettings({ hours }: { hours: ShiftHours }) {
  const [saved, setSaved] = useState(hours);
  const [values, setValues] = useState(hours);
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  const isDirty = SHIFTS.some(
    ({ type }) =>
      values[type].start !== saved[type].start ||
      values[type].end !== saved[type].end,
  );

  function setTime(shift: ShiftType, field: "start" | "end", time: string) {
    setValues((prev) => ({ ...prev, [shift]: { ...prev[shift], [field]: time } }));
    setStatus(null);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveShiftHours(values);
      if (result.ok) {
        setSaved(values);
        setStatus({ tone: "success", text: "שעות המשמרות נשמרו." });
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <span className="font-semibold">הגדרות משמרות</span>
        <span className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="hidden sm:inline" dir="ltr">
            {SHIFTS.map(({ type }) => formatRange(saved[type])).join(" · ")}
          </span>
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-zinc-100 p-4 dark:border-zinc-800">
        <div className="grid gap-3 sm:grid-cols-3">
          {SHIFTS.map(({ type, label }) => {
            const range = values[type];
            const invalid = !isValidRange(range);
            const overnight = !invalid && range.end < range.start;
            return (
              <fieldset
                key={type}
                className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <legend className="px-1 text-sm font-medium">{label}</legend>
                <div className="flex items-center gap-2">
                  <TimeInput
                    label={`שעת התחלה, ${label}`}
                    value={range.start}
                    disabled={pending}
                    onChange={(time) => setTime(type, "start", time)}
                  />
                  <span aria-hidden className="text-zinc-400">
                    עד
                  </span>
                  <TimeInput
                    label={`שעת סיום, ${label}`}
                    value={range.end}
                    disabled={pending}
                    onChange={(time) => setTime(type, "end", time)}
                  />
                </div>
                {invalid ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    שעת ההתחלה והסיום חייבות להיות שונות.
                  </p>
                ) : (
                  overnight && (
                    <p className="text-xs text-zinc-500">
                      מסתיימת למחרת בבוקר
                    </p>
                  )
                )}
              </fieldset>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
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
            onClick={() => {
              setValues(saved);
              setStatus(null);
            }}
            disabled={pending || !isDirty}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ביטול שינויים
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              pending ||
              !isDirty ||
              SHIFTS.some(({ type }) => !isValidRange(values[type]))
            }
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "שומרים…" : "שמירת שעות"}
          </button>
        </div>
      </div>
    </details>
  );
}

function TimeInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (time: string) => void;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      disabled={disabled}
      required
      dir="ltr"
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
    />
  );
}
