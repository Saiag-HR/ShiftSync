import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "הרשמה" };

export default function SignupPage() {
  return (
    <AuthCard
      title="יצירת חשבון"
      description="חשבונות חדשים נפתחים בהרשאת עובד. מנהל יכול לשנות את ההרשאה בהמשך."
      footer={
        <>
          כבר יש לכם חשבון?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline dark:text-white">
            התחברות
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
