import type { Metadata } from "next";
import { connection } from "next/server";
import { SettingsListener } from "@/components/settings-listener";
import { WeekNav } from "@/components/week-nav";
import { getCurrentUser } from "@/lib/auth";
import { getSystemSettings } from "@/lib/settings";
import {
  addDays,
  cellKey,
  isWeekend,
  resolveWeekStart,
  SHIFTS,
  startOfWeek,
  todayIso,
  weekDates,
} from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityToggle } from "./availability-toggle";
import { ScheduleEditor, type ScheduleEmployee } from "./schedule-editor";
import type { LastWeekend } from "./schedule-logic";
import { ShiftSettings } from "./shift-settings";

export const metadata: Metadata = { title: "שיבוץ עובדים" };

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await getCurrentUser();
  const { week } = await searchParams;
  await connection();

  const today = todayIso(new Date());
  const weekStart = resolveWeekStart(week, today);
  const dates = weekDates(weekStart);
  const weekEnd = dates[dates.length - 1];

  const supabase = await createClient();
  const [settings, employeesResult, assignmentsResult, availabilityResult, lastWeekResult] =
    await Promise.all([
      getSystemSettings(),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "employee")
        .eq("is_blocked", false)
        .order("full_name"),
      supabase
        .from("shift_assignments")
        .select("shift_date, shift_type, employee_id")
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd),
      supabase
        .from("shift_availabilities")
        .select("employee_id, shift_date, shift_type, is_available, submitted_at")
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("submitted_at"),
      // Last week's assignments, for the weekend repeat rule.
      supabase
        .from("shift_assignments")
        .select("shift_date, shift_type, employee_id")
        .gte("shift_date", addDays(weekStart, -7))
        .lt("shift_date", weekStart)
        .not("employee_id", "is", null),
    ]);
  if (lastWeekResult.error) throw lastWeekResult.error;
  if (employeesResult.error) throw employeesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (availabilityResult.error) throw availabilityResult.error;

  const employees: ScheduleEmployee[] = employeesResult.data.map((p) => ({
    id: p.id,
    fullName: p.full_name,
  }));

  const assignments: Record<string, string | null> = {};
  for (const row of assignmentsResult.data) {
    assignments[cellKey(row.shift_date, row.shift_type)] = row.employee_id;
  }

  const availability: Record<string, Record<string, boolean>> = {};
  const availableCount = new Map<string, number>();
  const responded = new Set<string>();
  for (const row of availabilityResult.data) {
    if (!row.employee_id) continue;
    const key = cellKey(row.shift_date, row.shift_type);
    const isAvailable = row.is_available ?? false;
    (availability[key] ??= {})[row.employee_id] = isAvailable;
    responded.add(row.employee_id);
    if (isAvailable) {
      availableCount.set(
        row.employee_id,
        (availableCount.get(row.employee_id) ?? 0) + 1,
      );
    }
  }

  // Per shift: available employees in submission order (first come, first
  // served). Rows submitted at the same moment, such as those from before
  // submission times were recorded, are ordered by name.
  const names = new Map(employees.map((e) => [e.id, e.fullName]));
  const queues: Record<string, string[]> = {};
  const queueRows = availabilityResult.data
    .filter((row) => row.is_available && row.employee_id && names.has(row.employee_id))
    .toSorted(
      (a, b) =>
        a.submitted_at.localeCompare(b.submitted_at) ||
        names.get(a.employee_id!)!.localeCompare(names.get(b.employee_id!)!, "he"),
    );
  for (const row of queueRows) {
    (queues[cellKey(row.shift_date, row.shift_type)] ??= []).push(row.employee_id!);
  }

  // This week's Friday/Saturday shifts → who worked the same shift a week ago.
  const lastWeekend: LastWeekend = {};
  for (const row of lastWeekResult.data) {
    if (row.employee_id && isWeekend(row.shift_date)) {
      lastWeekend[cellKey(addDays(row.shift_date, 7), row.shift_type)] = row.employee_id;
    }
  }

  const respondedCount = employees.filter((e) => responded.has(e.id)).length;
  const totalShifts = dates.length * SHIFTS.length;

  return (
    <div className="space-y-8">
      <SettingsListener />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            שלום, {user.fullName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            משמרות פנויות מקבלות אוטומטית את העובד הזמין שהגיש ראשון. בדקו את
            ההצעות, שנו לפי הצורך ושמרו.
          </p>
        </div>
        <AvailabilityToggle open={settings.availabilityOpen} />
      </div>

      <ShiftSettings hours={settings.shiftHours} />

      <WeekNav
        basePath="/admin"
        weekStart={weekStart}
        currentWeekStart={startOfWeek(today)}
      />

      <section className="space-y-3">
        <h2 className="font-semibold">שיבוץ עובדים</h2>
        <ScheduleEditor
          key={weekStart}
          weekStart={weekStart}
          dates={dates}
          employees={employees}
          initial={assignments}
          availability={availability}
          queues={queues}
          lastWeekend={lastWeekend}
          today={today}
          shiftHours={settings.shiftHours}
        />
      </section>

      {employees.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">זמינות הצוות</h2>
            <p className="text-sm text-zinc-500">
              {respondedCount} מתוך {employees.length} השיבו
            </p>
          </div>
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {employees.map((employee) => (
              <li
                key={employee.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium">{employee.fullName}</span>
                {responded.has(employee.id) ? (
                  <span className="text-zinc-600 dark:text-zinc-400">
                    זמין ל-{availableCount.get(employee.id) ?? 0} מתוך{" "}
                    {totalShifts} משמרות
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    טרם השיב
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
