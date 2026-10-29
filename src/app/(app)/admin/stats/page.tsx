import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  daysBetween,
  monthsInRange,
  resolveRange,
  weekStartsInRange,
  type RangePreset,
} from "@/lib/date-range";
import { addDays, SHIFTS, startOfWeek, todayIso } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "סטטיסטיקות ונתונים" };

const PRESETS: { value: Exclude<RangePreset, "custom">; label: string }[] = [
  { value: "week", label: "השבוע" },
  { value: "month", label: "החודש" },
  { value: "last-month", label: "החודש הקודם" },
  { value: "3-months", label: "3 חודשים אחרונים" },
];

const decimal = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("he-IL", { style: "percent", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

type EmployeeStats = {
  id: string;
  fullName: string;
  isBlocked: boolean;
  total: number;
  nights: number;
  perWeek: number;
  perMonth: number;
  submittedWeeks: number;
  reliability: number | null;
};

export default async function StatsPage({ searchParams }: PageProps<"/admin/stats">) {
  const params = await searchParams;
  await connection();
  const today = todayIso(new Date());
  const range = resolveRange(params, today);

  const supabase = await createClient();
  const [statsResult, profilesResult] = await Promise.all([
    supabase.rpc("shift_stats", { p_from: range.from, p_to: range.to }),
    supabase
      .from("profiles")
      .select("id, full_name, is_blocked")
      .eq("role", "employee")
      .order("full_name"),
  ]);
  if (statsResult.error) throw statsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const weeks = weekStartsInRange(range.from, range.to);
  const months = monthsInRange(range.from, range.to);
  // Availability can be requested up to next week; later weeks aren't due yet.
  const lastRequestedWeek = addDays(startOfWeek(today), 7);
  const requestedWeeks = weeks.filter((week) => week <= lastRequestedWeek).length;

  const byId = new Map(statsResult.data.map((row) => [row.employee_id, row]));
  const employees: EmployeeStats[] = profilesResult.data
    .map((profile) => {
      const row = byId.get(profile.id);
      const total = row?.total_shifts ?? 0;
      const submittedWeeks = row?.submitted_weeks ?? 0;
      return {
        id: profile.id,
        fullName: profile.full_name,
        isBlocked: profile.is_blocked,
        total,
        nights: row?.night_shifts ?? 0,
        perWeek: total / weeks.length,
        perMonth: total / months,
        submittedWeeks: Math.min(submittedWeeks, requestedWeeks),
        reliability: requestedWeeks > 0 ? Math.min(submittedWeeks / requestedWeeks, 1) : null,
      };
    })
    // Hide blocked employees who have nothing in this range.
    .filter((e) => !e.isBlocked || e.total > 0 || e.submittedWeeks > 0)
    .sort((a, b) => b.total - a.total || a.fullName.localeCompare(b.fullName, "he"));

  const slots = (daysBetween(range.from, range.to) + 1) * SHIFTS.length;
  const assigned = employees.reduce((sum, e) => sum + e.total, 0);
  const nights = employees.reduce((sum, e) => sum + e.nights, 0);
  const activeCount = employees.length;
  const reliabilities = employees
    .map((e) => e.reliability)
    .filter((r): r is number => r !== null);
  const avgReliability = reliabilities.length
    ? reliabilities.reduce((sum, r) => sum + r, 0) / reliabilities.length
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">סטטיסטיקות ונתונים</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatDate(range.from)} – {formatDate(range.to)} · {weeks.length}{" "}
          {weeks.length === 1 ? "שבוע" : "שבועות"}
        </p>
      </div>

      <RangeFilters range={range} />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="משמרות משובצות"
          value={`${assigned} / ${slots}`}
          detail={slots ? `${percent.format(assigned / slots)} מהמשמרות אוישו` : undefined}
        />
        <StatTile label="משמרות לילה" value={String(nights)} />
        <StatTile
          label="ממוצע לעובד בשבוע"
          value={activeCount ? decimal.format(assigned / activeCount / weeks.length) : "—"}
          detail={`${activeCount} עובדים`}
        />
        <StatTile
          label="אמינות הגשת זמינות"
          value={avgReliability === null ? "—" : percent.format(avgReliability)}
          detail={
            requestedWeeks
              ? `ממוצע, מתוך ${requestedWeeks} ${requestedWeeks === 1 ? "שבוע" : "שבועות"} שנדרשו`
              : "אין שבועות שנדרשה בהם הגשה"
          }
        />
      </dl>

      {employees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
          אין עובדים להצגה בטווח הזה.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">נתונים לפי עובד</caption>
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th scope="col" className="p-3 text-start font-medium">עובד</th>
                <th scope="col" className="p-3 text-end font-medium">משמרות</th>
                <th scope="col" className="p-3 text-end font-medium">משמרות לילה</th>
                <th scope="col" className="p-3 text-end font-medium">ממוצע לשבוע</th>
                <th scope="col" className="p-3 text-end font-medium">ממוצע לחודש</th>
                <th scope="col" className="p-3 text-end font-medium">הגשת זמינות</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <th scope="row" className="p-3 text-start font-medium">
                    {e.fullName}
                    {e.isBlocked && <span className="ms-2 text-xs font-normal text-zinc-500">(חסום)</span>}
                  </th>
                  <td className="p-3 text-end">{e.total}</td>
                  <td className="p-3 text-end">{e.nights}</td>
                  <td className="p-3 text-end">{decimal.format(e.perWeek)}</td>
                  <td className="p-3 text-end">{decimal.format(e.perMonth)}</td>
                  <td className="p-3 text-end">
                    {e.reliability === null ? (
                      "—"
                    ) : (
                      <>
                        {percent.format(e.reliability)}{" "}
                        <span className="text-xs text-zinc-500">
                          ({e.submittedWeeks}/{requestedWeeks})
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        &quot;הגשת זמינות&quot; – בכמה מהשבועות בטווח העובד הגיש זמינות, מתוך השבועות שבהם
        נדרשה הגשה (עד השבוע הבא). ממוצע לחודש מחושב לפי {months}{" "}
        {months === 1 ? "חודש" : "חודשים"} בטווח.
      </p>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      {/* Values are numbers ("12 / 63"); keep them left-to-right in the RTL page. */}
      <dd className="mt-1 text-2xl font-semibold tabular-nums">
        <span dir="ltr">{value}</span>
      </dd>
      {detail && <dd className="mt-1 text-xs text-zinc-500">{detail}</dd>}
    </div>
  );
}

const fieldStyles =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const buttonStyles =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

// Plain GET forms and links, so filtering works without client JavaScript.
function RangeFilters({ range }: { range: { from: string; to: string; preset: RangePreset } }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <nav aria-label="טווחים מהירים" className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = range.preset === preset.value;
          return (
            <Link
              key={preset.value}
              href={`/admin/stats?preset=${preset.value}`}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
                  : buttonStyles
              }
            >
              {preset.label}
            </Link>
          );
        })}
      </nav>

      <form action="/admin/stats" className="flex items-end gap-2">
        <label className="text-xs text-zinc-500">
          חודש
          <input type="month" name="month" defaultValue={range.from.slice(0, 7)} className={`mt-1 block ${fieldStyles}`} />
        </label>
        <button type="submit" className={buttonStyles}>הצגה</button>
      </form>

      <form action="/admin/stats" className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-500">
          מתאריך
          <input type="date" name="from" defaultValue={range.from} required className={`mt-1 block ${fieldStyles}`} />
        </label>
        <label className="text-xs text-zinc-500">
          עד תאריך
          <input type="date" name="to" defaultValue={range.to} required className={`mt-1 block ${fieldStyles}`} />
        </label>
        <button type="submit" className={buttonStyles}>הצגה</button>
      </form>
    </div>
  );
}
