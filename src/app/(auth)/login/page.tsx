import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "התחברות" };

export default function LoginPage() {
  return (
    <AuthCard
      title="התחברות"
      description="ברוכים השבים! התחברו כדי לראות את המשמרות שלכם."
      footer={
        <>
          אין לכם חשבון?{" "}
          <Link href="/signup" className="font-medium text-zinc-900 underline dark:text-white">
            הרשמה
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
