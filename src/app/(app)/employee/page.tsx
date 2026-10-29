import type { Metadata } from "next";
import { connection } from "next/server";
import { WeekNav } from "@/components/week-nav";
import { getCurrentUser } from "@/lib/auth";
import {
  cellKey,
  formatDayMonth,
  formatWeekday,
  resolveWeekStart,
  SHIFT_LABELS,
  SHIFTS,
  startOfWeek,
  todayIso,
  weekDates,
} from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityForm } from "./availability-form";

export const metadata: Metadata = { title: "My shifts" };

const shiftOrder = SHIFTS.map((shift) => shift.type);

export default async function EmployeePage({
  searchParams,
}: PageProps<"/employee">) {
  const user = await getCurrentUser();
  const { week } = await searchParams;
  await connection();

  const today = todayIso(new Date());
  const weekStart = resolveWeekStart(week, today);
  const dates = weekDates(weekStart);
  const weekEnd = dates[dates.length - 1];

  const supabase = await createClient();
  const [availabilityResult, assignmentsResult] = await Promise.all([
    supabase
      .from("shift_availabilities")
      .select("shift_date, shift_type, is_available")
      .eq("employee_id", user.id)
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
    supabase
      .from("shift_assignments")
      .select("shift_date, shift_type")
      .eq("employee_id", user.id)
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
  ]);
  if (availabilityResult.error) throw availabilityResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  const availability: Record<string, boolean> = {};
  for (const row of availabilityResult.data) {
    availability[cellKey(row.shift_date, row.shift_type)] =
      row.is_available ?? false;
  }

  const myShifts = assignmentsResult.data.toSorted(
    (a, b) =>
      a.shift_date.localeCompare(b.shift_date) ||
      shiftOrder.indexOf(a.shift_type) - shiftOrder.indexOf(b.shift_type),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {user.fullName}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Mark the shifts you can work, and check the ones you&apos;ve been
          assigned.
        </p>
      </div>

      <WeekNav
        basePath="/employee"
        weekStart={weekStart}
        currentWeekStart={startOfWeek(today)}
      />

      <section className="space-y-3">
        <h2 className="font-semibold">My availability</h2>
        <AvailabilityForm
          key={weekStart}
          weekStart={weekStart}
          dates={dates}
          today={today}
          initial={availability}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">My shifts this week</h2>
        {myShifts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
            You haven&apos;t been assigned any shifts this week yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {myShifts.map((shift) => (
              <li
                key={cellKey(shift.shift_date, shift.shift_type)}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium">
                  {formatWeekday(shift.shift_date)}{" "}
                  {formatDayMonth(shift.shift_date)}
                </span>
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  {SHIFT_LABELS[shift.shift_type]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
