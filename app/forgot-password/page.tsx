import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Forgot password | Booran Motor Group" };

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" />;
}
