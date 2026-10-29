import Link from "next/link";
import { addDays, formatWeekRange } from "@/lib/schedule";

// Touch-sized (44px) on phones, compact from sm up.
const linkStyles =
  "flex min-h-11 items-center justify-center gap-1 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 sm:min-h-0 sm:py-1.5 dark:border-zinc-700 dark:hover:bg-zinc-800";

// Arrows point the RTL way: earlier weeks are to the right.
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
  const isCurrent = weekStart === currentWeekStart;

  return (
    <nav
      aria-label="ניווט בין שבועות"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-lg font-semibold">{formatWeekRange(weekStart)}</p>
      <div className={`grid w-full gap-2 sm:flex sm:w-auto ${isCurrent ? "grid-cols-2" : "grid-cols-3"}`}>
        <Link href={href(addDays(weekStart, -7))} className={linkStyles}>
          <span aria-hidden>→</span> הקודם
        </Link>
        {!isCurrent && (
          <Link href={href(currentWeekStart)} className={linkStyles}>
            השבוע
          </Link>
        )}
        <Link href={href(addDays(weekStart, 7))} className={linkStyles}>
          הבא <span aria-hidden>←</span>
        </Link>
      </div>
    </nav>
  );
}
