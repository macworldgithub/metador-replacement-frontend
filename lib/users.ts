export const userRoles = [
  { value: "group_admin", label: "Super Admin" },
  { value: "sales_manager", label: "Dealership Manager" },
  { value: "salesperson", label: "Sales Consultant / Staff" },
  { value: "bdc", label: "BDC" },
  { value: "read_only", label: "Read only" },
] as const;
export const userRooftops = [
  { value: "cranbourne_kia", label: "Cranbourne Kia" },
  { value: "cranbourne_mg", label: "Cranbourne MG" },
  { value: "geely_cranbourne", label: "Geely Cranbourne" },
] as const;
export type UserApiRole = typeof userRoles[number]["value"];
export type PortalUser = { id: string; name: string; email: string; role: string; rooftopIds: string[]; isActive: boolean; createdAt: string; updatedAt: string };
export type CreateUserInput = { name: string; email: string; password: string; role: UserApiRole; rooftopIds: string[] };

export function roleLabel(role: string): string { return userRoles.find((item) => item.value === role)?.label ?? role; }
export function rooftopLabel(id: string): string { return userRooftops.find((item) => item.value === id)?.label ?? id; }

export function sanitizeUser(value: unknown): PortalUser {
  if (!value || typeof value !== "object") throw new Error("Invalid user response.");
  const raw = value as Record<string, unknown>;
  const id = raw.id ?? raw._id;
  if (typeof id !== "string" || typeof raw.name !== "string" || typeof raw.email !== "string" || typeof raw.role !== "string" || typeof raw.isActive !== "boolean" || !Array.isArray(raw.rooftopIds) || !raw.rooftopIds.every((r) => typeof r === "string")) throw new Error("Invalid user response.");
  return { id, name: raw.name, email: raw.email, role: raw.role, rooftopIds: raw.rooftopIds, isActive: raw.isActive, createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "", updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "" };
}

export function validateUserInput(action: "create" | "role" | "rooftops" | "password", body: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (action === "create") {
    if (typeof body.name !== "string" || !body.name.trim()) errors.name = "Enter the user’s full name.";
    if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) errors.email = "Enter a valid email address.";
  }
  if (action === "create" || action === "password") {
    const key = action === "create" ? "password" : "newPassword";
    if (typeof body[key] !== "string" || body[key].length < 8) errors[key] = "Use at least 8 characters.";
  }
  if ((action === "create" || action === "role") && !userRoles.some((r) => r.value === body.role)) errors.role = "Choose a supported role.";
  if ((action === "create" || action === "rooftops") && (!Array.isArray(body.rooftopIds) || !body.rooftopIds.every((id) => userRooftops.some((r) => r.value === id)))) errors.rooftopIds = "Choose valid rooftop assignments.";
  return errors;
}

export class UsersApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}

export async function usersRequest<T>(path = "", init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/users${path}`, { ...init, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", ...init.headers } }); }
  catch { throw new UsersApiError("Cannot reach user management. Please try again.", 503); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("booran:session-refresh"));
    throw new UsersApiError(data.message ?? "Unable to complete your request.", response.status, data.fields ?? {});
  }
  return data as T;
}
