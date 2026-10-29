import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-12 text-center dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold tracking-tight">הדף לא נמצא</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        ייתכן שהקישור שגוי או שהדף הוסר.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        חזרה לדף הבית
      </Link>
    </main>
  );
}
