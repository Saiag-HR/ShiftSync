import type { ReactNode } from "react";
import { Suspense } from "react";
import { requireRole, type UserRole } from "@/lib/auth";

// Renders children only for the given role; other users are redirected
// to their own area. Data access is still enforced by RLS.
export function RoleGate({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RoleCheck role={role}>{children}</RoleCheck>
    </Suspense>
  );
}

async function RoleCheck({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  await requireRole(role);
  return children;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}
