import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create an account | Booran Motor Group" };

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}
