import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <p className="mb-8 text-sm font-semibold tracking-wide text-zinc-500">
        סידור עבודה
      </p>
      {children}
    </main>
  );
}
