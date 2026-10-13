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
