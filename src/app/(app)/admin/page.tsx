import type { Metadata } from "next";
import { SectionCard } from "@/components/section-card";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {user.fullName}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Build the schedule and manage your team.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SectionCard
          title="Shift assignments"
          description="Assign employees to morning, evening and night shifts."
        />
        <SectionCard
          title="Team availability"
          description="See when each employee can work before you build the schedule."
        />
        <SectionCard
          title="Employees"
          description="View your team and manage roles."
        />
      </div>
    </div>
  );
}
