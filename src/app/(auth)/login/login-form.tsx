"use client";

import { useActionState } from "react";
import { FormAlert, FormField, SubmitButton } from "@/components/auth-card";
import { signIn, type AuthFormState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <FormField
        label="שם משתמש"
        name="username"
        autoComplete="username"
        defaultValue={state.fields?.username}
        ltr
      />
      <FormField
        label="סיסמה"
        name="password"
        type="password"
        autoComplete="current-password"
        ltr
      />
      <SubmitButton pending={pending} pendingLabel="מתחברים…">
        התחברות
      </SubmitButton>
    </form>
  );
}
