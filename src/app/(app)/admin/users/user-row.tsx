"use client";

import { useState, useTransition } from "react";
import type { UserRole } from "@/lib/auth";
import {
  resetUserPassword,
  setNightShiftExempt,
  setUserBlocked,
  setUserRole,
} from "./actions";

type Status = { tone: "success" | "error"; text: string } | null;

export type UserRowData = {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  createdAt: string;
  isBlocked: boolean;
  nightExempt: boolean;
  isSelf: boolean;
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "employee", label: "עובד" },
  { value: "admin", label: "מנהל" },
];

export function UserRow({ user }: { user: UserRowData }) {
  const [password, setPassword] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [pending, startTransition] = useTransition();

  function changeRole(role: UserRole) {
    setStatus(null);
    startTransition(async () => {
      const result = await setUserRole(user.id, role);
      setStatus(
        result.ok
          ? { tone: "success", text: "התפקיד עודכן." }
          : { tone: "error", text: result.error },
      );
    });
  }

  function toggleNightExempt(exempt: boolean) {
    setStatus(null);
    startTransition(async () => {
      const result = await setNightShiftExempt(user.id, exempt);
      setStatus(
        result.ok
          ? { tone: "success", text: exempt ? "הוגדר פטור ממשמרת לילה." : "הפטור בוטל." }
          : { tone: "error", text: result.error },
      );
    });
  }

  function toggleBlocked() {
    const blocking = !user.isBlocked;
    if (blocking && !window.confirm(`לחסום את ${user.fullName}? המשתמש לא יוכל להתחבר.`)) {
      return;
    }
    setStatus(null);
    startTransition(async () => {
      const result = await setUserBlocked(user.id, blocking);
      setStatus(
        result.ok
          ? { tone: "success", text: blocking ? "המשתמש נחסם." : "החסימה בוטלה." }
          : { tone: "error", text: result.error },
      );
    });
  }

  function savePassword() {
    setStatus(null);
    startTransition(async () => {
      const result = await resetUserPassword(user.id, password);
      if (result.ok) {
        setPassword("");
        setShowReset(false);
        setStatus({ tone: "success", text: "הסיסמה עודכנה." });
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <li className={`space-y-3 px-4 py-4 ${user.isBlocked ? "bg-zinc-50 dark:bg-zinc-950/50" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className={user.isBlocked ? "text-zinc-500" : ""}>{user.fullName}</span>
            {user.isSelf && (
              <span className="text-xs font-normal text-zinc-500">(את/ה)</span>
            )}
            {user.isBlocked && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                🔒 חסום
              </span>
            )}
          </p>
          <p className="text-sm text-zinc-500">
            שם משתמש: <bdi className="font-medium text-zinc-700 dark:text-zinc-300">{user.username}</bdi>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`תפקיד של ${user.fullName}`}
            value={user.role}
            disabled={pending || user.isSelf}
            onChange={(event) => changeRole(event.target.value as UserRole)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setShowReset((open) => !open);
              setStatus(null);
            }}
            disabled={pending}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            איפוס סיסמה
          </button>
          {!user.isSelf && (
            <button
              type="button"
              onClick={toggleBlocked}
              disabled={pending}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                user.isBlocked
                  ? "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  : "border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
              }`}
            >
              {user.isBlocked ? "ביטול חסימה" : "חסימה"}
            </button>
          )}
        </div>
      </div>

      {user.role === "employee" && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            role="switch"
            checked={user.nightExempt}
            disabled={pending}
            onChange={(event) => toggleNightExempt(event.target.checked)}
            className="size-4 accent-zinc-900 dark:accent-white"
          />
          פטור מחובת משמרת לילה
        </label>
      )}

      {showReset && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            savePassword();
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            aria-label={`סיסמה חדשה עבור ${user.fullName}`}
            placeholder="סיסמה חדשה"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            dir="ltr"
            required
            className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={pending || !password}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {pending ? "שומרים…" : "שמירת סיסמה"}
          </button>
          <p className="w-full text-xs text-zinc-500">
            מסרו את הסיסמה החדשה למשתמש. מסיבות אבטחה אי אפשר לצפות בסיסמה
            הקיימת.
          </p>
        </form>
      )}

      {status && (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={`text-sm ${status.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
        >
          {status.text}
        </p>
      )}
    </li>
  );
}
