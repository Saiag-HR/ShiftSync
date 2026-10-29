import type { Metadata } from "next";
import { connection } from "next/server";
import { WeekNav } from "@/components/week-nav";
import { getCurrentUser } from "@/lib/auth";
import {
  cellKey,
  resolveWeekStart,
  SHIFTS,
  startOfWeek,
  todayIso,
  weekDates,
} from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { ScheduleEditor, type ScheduleEmployee } from "./schedule-editor";

export const metadata: Metadata = { title: "Schedule" };

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await getCurrentUser();
  const { week } = await searchParams;
  await connection();

  const today = todayIso(new Date());
  const weekStart = resolveWeekStart(week, today);
  const dates = weekDates(weekStart);
  const weekEnd = dates[dates.length - 1];

  const supabase = await createClient();
  const [employeesResult, assignmentsResult, availabilityResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "employee")
        .order("full_name"),
      supabase
        .from("shift_assignments")
        .select("shift_date, shift_type, employee_id")
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd),
      supabase
        .from("shift_availabilities")
        .select("employee_id, shift_date, shift_type, is_available")
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd),
    ]);
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

  const respondedCount = employees.filter((e) => responded.has(e.id)).length;
  const totalShifts = dates.length * SHIFTS.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {user.fullName}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pick an employee for each shift. Employees who said they&apos;re
          available are listed first.
        </p>
      </div>

      <WeekNav
        basePath="/admin"
        weekStart={weekStart}
        currentWeekStart={startOfWeek(today)}
      />

      <section className="space-y-3">
        <h2 className="font-semibold">Schedule</h2>
        <ScheduleEditor
          key={weekStart}
          weekStart={weekStart}
          dates={dates}
          employees={employees}
          initial={assignments}
          availability={availability}
        />
      </section>

      {employees.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Team availability</h2>
            <p className="text-sm text-zinc-500">
              {respondedCount} of {employees.length} responded
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
                    Available for {availableCount.get(employee.id) ?? 0} of{" "}
                    {totalShifts} shifts
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    No response
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
