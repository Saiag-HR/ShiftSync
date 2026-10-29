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
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.fields?.email}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <SubmitButton pending={pending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
