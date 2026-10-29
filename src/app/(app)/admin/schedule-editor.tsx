"use client";

import { Fragment, useState, useTransition } from "react";
import {
  cellKey,
  FAIRNESS_WARNING_FROM_SHIFT,
  formatDayMonth,
  formatWeekday,
  MAX_SHIFTS_PER_WEEK,
  SHIFT_LABELS,
  SHIFTS,
  type ShiftType,
} from "@/lib/schedule";
import { formatRange, type ShiftHours } from "@/lib/shift-hours";
import { saveSchedule, type AssignmentChange } from "./actions";
import {
  buildSuggestions,
  countShifts,
  hasFairerCandidate,
  rankCandidates,
  type Assignments,
  type LastWeekend,
  type RankedCandidate,
} from "./schedule-logic";

export type ScheduleEmployee = { id: string; fullName: string };

type Status = { tone: "success" | "error"; text: string } | null;

const cellTones = {
  // Assigned to someone who said they're available, with no other candidates.
  ok: "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30",
  // Two or more employees asked for this shift: the admin should choose.
  choice: "border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40",
  // The assignment has a problem (unavailable, no response, double shift, over the cap).
  problem: "border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30",
  // Assigned to someone who worked this exact weekend shift last week.
  repeat: "border-purple-500 bg-purple-100 dark:border-purple-500 dark:bg-purple-950/40",
  empty: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
};

// Option colors only render in some browsers (e.g. Chrome and Firefox on
// desktop); the cell and the candidate list carry the same signal everywhere.
const REPEAT_OPTION = "bg-purple-100 text-purple-800";

const CAP_MESSAGE =`העובד הגיע למכסה המרבית של ${MAX_SHIFTS_PER_WEEK} משמרות השבוע`;

export function ScheduleEditor({
  weekStart,
  dates,
  today,
  employees,
  initial,
  availability,
  queues,
  lastWeekend,
  shiftHours,
}: {
  weekStart: string;
  dates: string[];
  today: string;
  employees: ScheduleEmployee[];
  shiftHours: ShiftHours;
  // All keyed by cellKey().
  initial: Assignments;
  availability: Record<string, Record<string, boolean>>;
  // Available employee ids per shift, first submitter first.
  queues: Record<string, string[]>;
  lastWeekend: LastWeekend;
}) {
  const [saved, setSaved] = useState(initial);
  const [suggestions] = useState(() =>
    buildSuggestions(dates, today, initial, queues, lastWeekend),
  );
  const [assignments, setAssignments] = useState(suggestions.assignments);
  const [suggested, setSuggested] = useState(suggestions.suggested);
  const [status, setStatus] = useState<Status>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const names = new Map(employees.map((e) => [e.id, e.fullName]));
  const counts = countShifts(assignments);
  const allKeys = dates.flatMap((date) =>
    SHIFTS.map((shift) => cellKey(date, shift.type)),
  );
  const changedKeys = allKeys.filter(
    (key) => (assignments[key] ?? null) !== (saved[key] ?? null),
  );
  const filledCount = allKeys.filter((key) => assignments[key]).length;
  const pendingSuggestions = changedKeys.filter((key) => suggested.has(key)).length;
  const overCap = employees.filter(
    (e) => (counts.get(e.id) ?? 0) > MAX_SHIFTS_PER_WEEK,
  );

  function assign(key: string, employeeId: string | null) {
    setAssignments((prev) => ({ ...prev, [key]: employeeId }));
    setSuggested((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
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
        setSuggested(new Set());
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex w-fit items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
            className="size-4 accent-zinc-900 dark:accent-white"
          />
          הצגת כל העובדים ברשימה, כולל מי שלא סימן זמינות
        </label>
        <ul className="flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <Legend tone="choice" label="כמה עובדים ביקשו – נדרשת בחירה" />
          <Legend tone="ok" label="משובץ עובד זמין" />
          <Legend tone="repeat" label="עבד במשמרת סופ״ש זו בשבוע שעבר" />
          <Legend tone="problem" label="דורש בדיקה" />
        </ul>
      </div>

      <WeeklyLoad employees={employees} counts={counts} />

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[1120px] border-collapse text-sm">
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
                  <span className="block text-xs font-normal text-zinc-500" dir="ltr">
                    {formatRange(shiftHours[shift.type])}
                  </span>
                </th>
                {dates.map((date) => {
                  const key = cellKey(date, shift.type);
                  const assignedId = assignments[key] ?? null;
                  return (
                    <td key={key} className="p-1.5">
                      <ShiftCell
                        label={`${shift.label}, ${formatWeekday(date)} ${formatDayMonth(date)}`}
                        employees={employees}
                        names={names}
                        counts={counts}
                        ranked={rankCandidates(key, queues[key] ?? [], assignments, counts, lastWeekend)}
                        lastWeekendId={lastWeekend[key] ?? null}
                        assignedId={assignedId}
                        changed={changedKeys.includes(key)}
                        suggested={suggested.has(key)}
                        availability={availability[key] ?? {}}
                        otherShiftToday={findOtherShift(assignments, date, shift.type, assignedId)}
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

      {overCap.length > 0 && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {CAP_MESSAGE}: {overCap.map((e) => e.fullName).join(", ")}. יש להוריד
          משמרות לפני השמירה.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {filledCount} מתוך {allKeys.length} משמרות מאוישות
          {changedKeys.length > 0 && (
            <span className="ms-2 font-medium text-amber-700 dark:text-amber-400">
              ·{" "}
              {changedKeys.length === 1
                ? "שינוי אחד שלא נשמר"
                : `${changedKeys.length} שינויים שלא נשמרו`}
              {pendingSuggestions > 0 &&
                ` (מתוכם ${pendingSuggestions} שיבוצים אוטומטיים)`}
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
              setSuggested(new Set());
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
            disabled={pending || changedKeys.length === 0 || overCap.length > 0}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "שומרים…" : "שמירת סידור"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: keyof typeof cellTones; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={`size-3 rounded border ${cellTones[tone]}`} />
      {label}
    </li>
  );
}

// Live shift count per employee for the week, out of the cap.
function WeeklyLoad({
  employees,
  counts,
}: {
  employees: ScheduleEmployee[];
  counts: Map<string, number>;
}) {
  return (
    <ul aria-label="משמרות לכל עובד השבוע" className="flex flex-wrap gap-2 text-xs">
      {employees.map((employee) => {
        const count = counts.get(employee.id) ?? 0;
        const tone =
          count > MAX_SHIFTS_PER_WEEK
            ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
            : count === MAX_SHIFTS_PER_WEEK
              ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
        return (
          <li key={employee.id} className={`rounded-full border px-2.5 py-1 ${tone}`}>
            <bdi>{employee.fullName}</bdi>{" "}
            <span className="font-semibold" dir="ltr">
              {count}/{MAX_SHIFTS_PER_WEEK}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ShiftCell({
  label,
  employees,
  names,
  counts,
  ranked,
  lastWeekendId,
  assignedId,
  changed,
  suggested,
  availability,
  otherShiftToday,
  showAll,
  disabled,
  onChange,
}: {
  label: string;
  employees: ScheduleEmployee[];
  names: Map<string, string>;
  counts: Map<string, number>;
  // Available employees, best choice first (fewest shifts, then FIFO).
  ranked: RankedCandidate[];
  // Who worked this exact weekend shift last week, if it's a weekend shift.
  lastWeekendId: string | null;
  assignedId: string | null;
  changed: boolean;
  suggested: boolean;
  availability: Record<string, boolean>;
  otherShiftToday: ShiftType | null;
  showAll: boolean;
  disabled: boolean;
  onChange: (employeeId: string | null) => void;
}) {
  const available = ranked.filter((c) => names.has(c.id));
  const noResponse = employees.filter((e) => availability[e.id] === undefined);
  const unavailable = employees.filter((e) => availability[e.id] === false);
  const assignedCount = assignedId ? (counts.get(assignedId) ?? 0) : 0;
  const fairnessWarning = hasFairerCandidate(
    ranked,
    assignedId,
    FAIRNESS_WARNING_FROM_SHIFT,
  );

  // Shift count after this cell: the person in it already counts it.
  const countIfAssigned = (id: string) =>
    (counts.get(id) ?? 0) + (id === assignedId ? 0 : 1);
  // Options show the name only; order carries the priority and capped
  // employees are disabled (greyed out) rather than labeled.
  const isCapped = (id: string) =>
    id !== assignedId && (counts.get(id) ?? 0) >= MAX_SHIFTS_PER_WEEK;
  const optionLabel = (id: string) => names.get(id) ?? "";

  let note: string;
  let tone: keyof typeof cellTones;
  if (!assignedId) {
    note =
      available.length === 0
        ? "אין עובדים זמינים"
        : available.length === 1
          ? "עובד אחד זמין"
          : `${available.length} עובדים זמינים`;
    tone = available.length >= 2 ? "choice" : "empty";
  } else if (assignedCount > MAX_SHIFTS_PER_WEEK) {
    note = CAP_MESSAGE;
    tone = "problem";
  } else if (otherShiftToday) {
    note = `משובץ גם ב${SHIFT_LABELS[otherShiftToday]}`;
    tone = "problem";
  } else if (availability[assignedId] === false) {
    note = "לא זמין";
    tone = "problem";
  } else if (availability[assignedId] === undefined) {
    note = "טרם השיב";
    tone = "problem";
  } else if (assignedId === lastWeekendId) {
    note = "עבד במשמרת זו בסופ״ש שעבר";
    tone = "repeat";
  } else if (available.length >= 2) {
    note = `${available.length} עובדים ביקשו`;
    tone = "choice";
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
            {available.length > 0 && (
              <optgroup label="זמינים (לפי עדיפות)">
                {available.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={isCapped(c.id)}
                    className={c.repeatWeekend ? REPEAT_OPTION : undefined}
                  >
                    {optionLabel(c.id)}
                  </option>
                ))}
              </optgroup>
            )}
            <EmployeeGroup label="טרם השיבו" employees={noResponse} optionLabel={optionLabel} isCapped={isCapped} />
            <EmployeeGroup label="לא זמינים" employees={unavailable} optionLabel={optionLabel} isCapped={isCapped} />
          </>
        ) : (
          <>
            {available.map((c) => (
              <option
                key={c.id}
                value={c.id}
                disabled={isCapped(c.id)}
                className={c.repeatWeekend ? REPEAT_OPTION : undefined}
              >
                {optionLabel(c.id)}
              </option>
            ))}
            {/* Keep an existing assignment visible even if it no longer
                matches the filter, so the select can show it. Its status
                is shown in the note below the select. */}
            {assignedId &&
              names.has(assignedId) &&
              availability[assignedId] !== true && (
                <option value={assignedId}>{optionLabel(assignedId)}</option>
              )}
          </>
        )}
      </select>

      <p
        className={`mt-1 px-0.5 text-xs ${
          tone === "problem"
            ? "text-rose-700 dark:text-rose-400"
            : tone === "repeat"
              ? "font-medium text-purple-800 dark:text-purple-300"
              : tone === "choice"
              ? "font-medium text-amber-800 dark:text-amber-300"
              : "text-zinc-500"
        }`}
      >
        {note}
        {suggested && " · שיבוץ אוטומטי"}
      </p>

      {fairnessWarning && (
        <p
          className="mt-1 flex items-start gap-1 rounded bg-amber-100 px-1.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-200"
          title={`זו המשמרת ה-${countIfAssigned(assignedId!)} של העובד השבוע, ויש מועמד זמין עם פחות משמרות`}
        >
          <span aria-hidden>⚠</span>
          עדיפות לעובדים עם פחות משמרות
        </p>
      )}

      {available.length >= 2 && (
        <p
          className="mt-1 rounded bg-white/70 px-1.5 py-1 text-xs leading-5 text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
          title="סדר העדיפות: פחות משמרות השבוע קודם, ובשוויון – מי שהגיש ראשון"
        >
          {available.map((c, index) => (
            <Fragment key={c.id}>
              {index > 0 && <span className="text-zinc-400"> | </span>}
              <span
                className={[
                  c.id === assignedId ? "font-semibold text-amber-900 dark:text-amber-200" : "",
                  isCapped(c.id) ? "text-zinc-400 line-through" : "",
                  c.repeatWeekend
                    ? "rounded bg-purple-100 px-1 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                    : "",
                ].join(" ")}
                title={c.repeatWeekend ? "עבד במשמרת זו בסופ״ש שעבר" : undefined}
              >
                {index + 1}. <bdi>{names.get(c.id)}</bdi> ({counts.get(c.id) ?? 0})
              </span>
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}

function EmployeeGroup({
  label,
  employees,
  optionLabel,
  isCapped,
}: {
  label: string;
  employees: ScheduleEmployee[];
  optionLabel: (id: string) => string;
  isCapped: (id: string) => boolean;
}) {
  if (employees.length === 0) return null;
  return (
    <optgroup label={label}>
      {employees.map((employee) => (
        <option key={employee.id} value={employee.id} disabled={isCapped(employee.id)}>
          {optionLabel(employee.id)}
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
