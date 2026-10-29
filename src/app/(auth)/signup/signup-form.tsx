"use client";

import { useActionState } from "react";
import { FormAlert, FormField, SubmitButton } from "@/components/auth-card";
import { USERNAME_RULES } from "@/lib/username";
import { signUp, type AuthFormState } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signUp,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <FormField
        label="שם מלא"
        name="fullName"
        autoComplete="name"
        defaultValue={state.fields?.fullName}
      />
      <FormField
        label="שם משתמש"
        name="username"
        autoComplete="username"
        defaultValue={state.fields?.username}
        hint={USERNAME_RULES}
        ltr
      />
      <FormField
        label="סיסמה"
        name="password"
        type="password"
        autoComplete="new-password"
        ltr
      />
      <SubmitButton pending={pending} pendingLabel="יוצרים חשבון…">
        הרשמה
      </SubmitButton>
    </form>
  );
}
