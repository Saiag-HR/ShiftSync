"use client";

import { useState, useTransition } from "react";
import type { UserRole } from "@/lib/auth";
import { USERNAME_RULES } from "@/lib/username";
import { createUser } from "./actions";

const inputStyles =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

const EMPTY = { fullName: "", username: "", password: "", role: "employee" as UserRole };

export function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof typeof EMPTY>(field: K, value: (typeof EMPTY)[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function submit() {
    startTransition(async () => {
      const result = await createUser(values);
      if (result.ok) {
        setCreated(values.username);
        setValues(EMPTY);
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setCreated(null);
          }}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + יצירת משתמש
        </button>
        {created && (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            המשתמש <bdi>{created}</bdi> נוצר. מסרו לו את שם המשתמש והסיסמה.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="font-semibold">יצירת משתמש חדש</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          שם מלא
          <input
            required
            value={values.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            autoComplete="off"
            className={inputStyles}
          />
        </label>
        <label className="block text-sm font-medium">
          שם משתמש
          <input
            required
            value={values.username}
            onChange={(e) => update("username", e.target.value)}
            autoComplete="off"
            className={inputStyles}
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">{USERNAME_RULES}</span>
        </label>
        <label className="block text-sm font-medium">
          סיסמה
          <input
            required
            type="text"
            dir="ltr"
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            autoComplete="off"
            className={inputStyles}
          />
        </label>
        <label className="block text-sm font-medium">
          תפקיד
          <select
            value={values.role}
            onChange={(e) => update("role", e.target.value as UserRole)}
            className={inputStyles}
          >
            <option value="employee">עובד</option>
            <option value="admin">מנהל</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValues(EMPTY);
            setError(null);
          }}
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "יוצרים…" : "יצירת משתמש"}
        </button>
      </div>
    </form>
  );
}
