import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password | Booran Motor Group" };

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <section className="auth-main" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </section>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
