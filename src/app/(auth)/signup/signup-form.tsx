"use client";

import { useActionState } from "react";
import { FormAlert, FormField, SubmitButton } from "@/components/auth-card";
import { signUp, type AuthFormState } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signUp,
    {},
  );

  if (state.message) {
    return <FormAlert tone="success">{state.message}</FormAlert>;
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <FormField
        label="Full name"
        name="fullName"
        autoComplete="name"
        defaultValue={state.fields?.fullName}
      />
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
        autoComplete="new-password"
        minLength={8}
      />
      <SubmitButton pending={pending} pendingLabel="Creating account…">
        Sign up
      </SubmitButton>
    </form>
  );
}
