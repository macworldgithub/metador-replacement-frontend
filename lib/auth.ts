export type AuthMode = "signin" | "signup" | "forgot";

export type AuthValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  rooftop: string;
};

export type AuthErrors = Partial<Record<keyof AuthValues | "form", string>>;

export function validateAuth(mode: AuthMode, values: AuthValues): AuthErrors {
  const errors: AuthErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid work email address.";
  if (mode !== "forgot" && !values.password) errors.password = "Enter your password.";
  if (mode === "signup") {
    if (values.name.trim().length < 2) errors.name = "Enter your full name.";
    if (values.password.length < 12 || !/[a-z]/.test(values.password) || !/[A-Z]/.test(values.password) || !/\d/.test(values.password)) errors.password = "Use at least 12 characters, including uppercase, lowercase and a number.";
    if (!values.confirmPassword || values.password !== values.confirmPassword) errors.confirmPassword = "Passwords must match.";
    if (!["Cranbourne Kia", "Cranbourne MG", "Geely Cranbourne"].includes(values.rooftop)) errors.rooftop = "Select your dealership.";
  }
  return errors;
}

/** Replace this preview adapter with backend authentication endpoints.
 * No credentials are saved and no email is sent by the frontend.
 */
export async function submitAuthPreview(mode: AuthMode): Promise<{ preview: true; mode: AuthMode }> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  return { preview: true, mode };
}
import type { AuthUser } from "./auth-profile";


export class AuthApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = "AuthApiError"; }
}

async function authRequest(path: string, init: RequestInit = {}): Promise<{ user: AuthUser }> {
  let response: Response;
  try { response = await fetch(`/api/auth/${path}`, { ...init, credentials: "same-origin", cache: "no-store" }); }
  catch { throw new AuthApiError("Cannot reach the authentication service. Please try again.", 503); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AuthApiError(typeof data.message === "string" ? data.message : "Unable to complete your request.", response.status);
  return data;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { user } = await authRequest("login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
  return user;
}

export async function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  const { user } = await authRequest("me", { signal });
  return user;
}

export async function logout(): Promise<void> {
  await authRequest("logout", { method: "POST" });
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  let response: Response;
  try {
    response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ email: email.trim() }),
    });
  } catch {
    throw new AuthApiError("Cannot reach the authentication service. Please try again.", 503);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthApiError(typeof data.message === "string" ? data.message : "Unable to request password reset.", response.status);
  }
  return data;
}

export async function verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new AuthApiError("Cannot reach the authentication service. Please try again.", 503);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthApiError(typeof data.message === "string" ? data.message : "Invalid or expired reset token.", response.status);
  }
  return data;
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  let response: Response;
  try {
    response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ token, newPassword }),
    });
  } catch {
    throw new AuthApiError("Cannot reach the authentication service. Please try again.", 503);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthApiError(typeof data.message === "string" ? data.message : "Unable to reset password.", response.status);
  }
  return data;
}

