import Link from "next/link";
import { addDays, formatWeekRange } from "@/lib/schedule";

const linkStyles =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function WeekNav({
  basePath,
  weekStart,
  currentWeekStart,
}: {
  basePath: string;
  weekStart: string;
  currentWeekStart: string;
}) {
  const href = (start: string) => `${basePath}?week=${start}`;

  return (
    <nav
      aria-label="Week"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-lg font-semibold">{formatWeekRange(weekStart)}</p>
      <div className="flex items-center gap-2">
        <Link href={href(addDays(weekStart, -7))} className={linkStyles}>
          <span aria-hidden>←</span> Previous
        </Link>
        {weekStart !== currentWeekStart && (
          <Link href={href(currentWeekStart)} className={linkStyles}>
            This week
          </Link>
        )}
        <Link href={href(addDays(weekStart, 7))} className={linkStyles}>
          Next <span aria-hidden>→</span>
        </Link>
      </div>
    </nav>
  );
}
