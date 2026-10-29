import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UserRow, type UserRowData } from "./user-row";

export const metadata: Metadata = { title: "ניהול משתמשים" };

export default async function UsersPage() {
  const currentUser = await getCurrentUser();

  // RLS lets admins read every profile.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, role, created_at")
    .order("role")
    .order("full_name");
  if (error) throw error;

  const users: UserRowData[] = data.map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    username: profile.username,
    role: profile.role ?? "employee",
    createdAt: profile.created_at ?? "",
    isSelf: profile.id === currentUser.id,
  }));
  const adminCount = users.filter((user) => user.role === "admin").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ניהול משתמשים</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {users.length} משתמשים רשומים, מתוכם {adminCount} מנהלים. כאן אפשר
          לשנות תפקיד ולאפס סיסמה למשתמש שלא מצליח להתחבר.
        </p>
      </div>

      <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </ul>
    </div>
  );
}
