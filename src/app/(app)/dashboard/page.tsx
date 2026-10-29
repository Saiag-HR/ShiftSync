import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/role-gate";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";

// Entry point after sign-in: sends each user to their role's area.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RoleRedirect />
    </Suspense>
  );
}

async function RoleRedirect(): Promise<ReactNode> {
  const user = await getCurrentUser();
  redirect(ROLE_HOME[user.role]);
}
