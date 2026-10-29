"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "שיבוץ עובדים" },
  { href: "/admin/users", label: "ניהול משתמשים" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ניווט מנהל"
      className="mb-8 flex gap-1 border-b border-zinc-200 dark:border-zinc-800"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
