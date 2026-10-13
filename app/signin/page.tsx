import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in | Booran Motor Group" };

export default function SignInPage() {
  return <AuthForm mode="signin" />;
}
