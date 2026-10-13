import type { Role, Rooftop } from "./types";
import { roleProfiles, type AccessIdentity } from "./permissions";

export type AuthUser = AccessIdentity & {
  id: string; email: string; role: Role; apiRole: string; rooftopIds: string[]; isActive: boolean;
};

const rooftops: Record<string, Rooftop> = { cranbourne_kia: "Cranbourne Kia", cranbourne_mg: "Cranbourne MG", geely_cranbourne: "Geely Cranbourne" };
const roles: Record<string, Role> = {
  group_admin: "Super Admin", super_admin: "Super Admin",
  sales_manager: "Dealership Manager", dealership_manager: "Dealership Manager", bdc: "Dealership Manager", read_only: "Dealership Manager",
  salesperson: "Sales Consultant / Staff", sales_consultant: "Sales Consultant / Staff", staff: "Sales Consultant / Staff",
  automation_admin: "Automation / System Administrator", system_admin: "Automation / System Administrator",
};

export function mapAuthProfile(data: unknown): AuthUser {
  if (!data || typeof data !== "object") throw new Error("Invalid profile response.");
  const raw = data as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.email !== "string" || typeof raw.name !== "string" || typeof raw.role !== "string" || !Array.isArray(raw.rooftopIds) || !raw.rooftopIds.every((id) => typeof id === "string")) throw new Error("Invalid profile response.");
  if (raw.isActive === false) throw new Error("Your account is inactive. Contact your administrator.");
  const role = roles[raw.role];
  if (!role) throw new Error("Your account role is not supported. Contact your administrator.");
  const permissions = raw.role === "read_only" ? ["overview", "conversations"] as const : roleProfiles[role].permissions.filter((p) => raw.role !== "bdc" || p !== "reports");
  const rooftopIds = raw.rooftopIds as string[];
  return { id: raw.id, email: raw.email, name: raw.name, role, apiRole: raw.role, rooftopIds,
    rooftops: rooftopIds.filter((id) => Object.hasOwn(rooftops, id)).map((id) => rooftops[id]),
    permissions: [...permissions], ownProspectsOnly: role === "Sales Consultant / Staff", isActive: true };
}

export function sessionDuration(expiresIn: unknown): number {
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0) return Math.min(expiresIn, 604800);
  const match = typeof expiresIn === "string" ? /^(\d+)(s|m|h|d)$/.exec(expiresIn) : null;
  if (!match) return 28800;
  return Math.max(1, Math.min(Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 1), 604800));
}
