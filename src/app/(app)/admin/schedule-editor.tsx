"use client";

import { useState, useTransition } from "react";
import {
  cellKey,
  formatDayMonth,
  formatWeekday,
  SHIFT_LABELS,
  SHIFTS,
  type ShiftType,
} from "@/lib/schedule";
import { saveSchedule, type AssignmentChange } from "./actions";

export type ScheduleEmployee = { id: string; fullName: string };

type Assignments = Record<string, string | null>;
type Status = { tone: "success" | "error"; text: string } | null;

const cellTones = {
  ok: "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30",
  warn: "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30",
  empty: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
};

export function ScheduleEditor({
  weekStart,
  dates,
  employees,
  initial,
  availability,
}: {
  weekStart: string;
  dates: string[];
  employees: ScheduleEmployee[];
  // Both keyed by cellKey().
  initial: Assignments;
  availability: Record<string, Record<string, boolean>>;
}) {
  const [saved, setSaved] = useState(initial);
  const [assignments, setAssignments] = useState(initial);
  const [status, setStatus] = useState<Status>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const names = new Map(employees.map((e) => [e.id, e.fullName]));
  const allKeys = dates.flatMap((date) =>
    SHIFTS.map((shift) => cellKey(date, shift.type)),
  );
  const changedKeys = allKeys.filter(
    (key) => (assignments[key] ?? null) !== (saved[key] ?? null),
  );
  const filledCount = allKeys.filter((key) => assignments[key]).length;

  function assign(key: string, employeeId: string | null) {
    setAssignments((prev) => ({ ...prev, [key]: employeeId }));
    setStatus(null);
  }

  function handleSave() {
    const changes: AssignmentChange[] = changedKeys.map((key) => {
      const [date, shift] = key.split("|") as [string, ShiftType];
      return { date, shift, employeeId: assignments[key] ?? null };
    });

    startTransition(async () => {
      const result = await saveSchedule(weekStart, changes);
      if (result.ok) {
        setSaved(assignments);
        setStatus({ tone: "success", text: "הסידור נשמר." });
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  }

  if (employees.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        עדיין אין עובדים. אחרי שעובדים יירשמו, תוכלו לשבץ אותם כאן.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex w-fit items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(event) => setShowAll(event.target.checked)}
          className="size-4 accent-zinc-900 dark:accent-white"
        />
        הצגת כל העובדים ברשימה, כולל מי שלא סימן זמינות
      </label>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-24 p-3" />
              {dates.map((date) => (
                <th key={date} scope="col" className="p-3 text-center font-medium">
                  <span className="block">{formatWeekday(date)}</span>
                  <span className="block text-xs font-normal text-zinc-500">
                    {formatDayMonth(date)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift) => (
              <tr key={shift.type} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                <th scope="row" className="p-3 text-start font-medium">
                  {shift.label}
                </th>
                {dates.map((date) => {
                  const key = cellKey(date, shift.type);
                  return (
                    <td key={key} className="p-1.5">
                      <ShiftCell
                        label={`${shift.label}, ${formatWeekday(date)} ${formatDayMonth(date)}`}
                        employees={employees}
                        names={names}
                        assignedId={assignments[key] ?? null}
                        changed={changedKeys.includes(key)}
                        availability={availability[key] ?? {}}
                        otherShiftToday={findOtherShift(
                          assignments,
                          date,
                          shift.type,
                          assignments[key] ?? null,
                        )}
                        showAll={showAll}
                        disabled={pending}
                        onChange={(employeeId) => assign(key, employeeId)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {filledCount} מתוך {allKeys.length} משמרות מאוישות
          {changedKeys.length > 0 && (
            <span className="ms-2 font-medium text-amber-700 dark:text-amber-400">
              ·{" "}
              {changedKeys.length === 1
                ? "שינוי אחד שלא נשמר"
                : `${changedKeys.length} שינויים שלא נשמרו`}
            </span>
          )}
        </p>
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
            onClick={() => {
              setAssignments(saved);
              setStatus(null);
            }}
            disabled={pending || changedKeys.length === 0}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ביטול שינויים
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || changedKeys.length === 0}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "שומרים…" : "שמירת סידור"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShiftCell({
  label,
  employees,
  names,
  assignedId,
  changed,
  availability,
  otherShiftToday,
  showAll,
  disabled,
  onChange,
}: {
  label: string;
  showAll: boolean;
  employees: ScheduleEmployee[];
  names: Map<string, string>;
  assignedId: string | null;
  changed: boolean;
  availability: Record<string, boolean>;
  otherShiftToday: ShiftType | null;
  disabled: boolean;
  onChange: (employeeId: string | null) => void;
}) {
  const available = employees.filter((e) => availability[e.id] === true);
  const noResponse = employees.filter((e) => availability[e.id] === undefined);
  const unavailable = employees.filter((e) => availability[e.id] === false);

  let note: string;
  let tone: keyof typeof cellTones;
  if (!assignedId) {
    note =
      available.length === 0
        ? "אין עובדים זמינים"
        : available.length === 1
          ? "עובד אחד זמין"
          : `${available.length} עובדים זמינים`;
    tone = "empty";
  } else if (otherShiftToday) {
    note = `משובץ גם ב${SHIFT_LABELS[otherShiftToday]}`;
    tone = "warn";
  } else if (availability[assignedId] === false) {
    note = "לא זמין";
    tone = "warn";
  } else if (availability[assignedId] === undefined) {
    note = "טרם השיב";
    tone = "warn";
  } else {
    note = "זמין";
    tone = "ok";
  }

  return (
    <div
      className={`rounded-lg border p-1.5 ${cellTones[tone]} ${changed ? "ring-2 ring-zinc-900/20 dark:ring-white/30" : ""}`}
    >
      <select
        aria-label={label}
        value={assignedId ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      >
        <option value="">לא משובץ</option>
        {assignedId && !names.has(assignedId) && (
          <option value={assignedId}>עובד לשעבר</option>
        )}
        {showAll ? (
          <>
            <EmployeeGroup label="זמינים" employees={available} />
            <EmployeeGroup label="טרם השיבו" employees={noResponse} />
            <EmployeeGroup label="לא זמינים" employees={unavailable} />
          </>
        ) : (
          <>
            {available.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
            {/* Keep an existing assignment visible even if it no longer
                matches the filter, so the select can show it. */}
            {assignedId &&
              names.has(assignedId) &&
              availability[assignedId] !== true && (
                <option value={assignedId}>
                  {names.get(assignedId)} (
                  {availability[assignedId] === false ? "לא זמין" : "טרם השיב"})
                </option>
              )}
          </>
        )}
      </select>
      <p
        className={`mt-1 px-0.5 text-xs ${tone === "warn" ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}`}
      >
        {note}
      </p>
    </div>
  );
}

function EmployeeGroup({
  label,
  employees,
}: {
  label: string;
  employees: ScheduleEmployee[];
}) {
  if (employees.length === 0) return null;
  return (
    <optgroup label={label}>
      {employees.map((employee) => (
        <option key={employee.id} value={employee.id}>
          {employee.fullName}
        </option>
      ))}
    </optgroup>
  );
}

function findOtherShift(
  assignments: Assignments,
  date: string,
  current: ShiftType,
  employeeId: string | null,
): ShiftType | null {
  if (!employeeId) return null;
  const other = SHIFTS.find(
    (shift) =>
      shift.type !== current &&
      assignments[cellKey(date, shift.type)] === employeeId,
  );
  return other?.type ?? null;
}
