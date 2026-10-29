import type { Metadata } from "next";
import { SectionCard } from "@/components/section-card";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "My shifts" };

export default async function EmployeePage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {user.fullName}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Submit your availability and check your upcoming shifts.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard
          title="My availability"
          description="Mark which morning, evening and night shifts you can work."
        />
        <SectionCard
          title="My schedule"
          description="See the shifts you've been assigned."
        />
      </div>
    </div>
  );
}
