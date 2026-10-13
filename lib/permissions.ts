import type { Prospect, Role, Rooftop } from "./types";

export const roleNames: Role[] = ["Super Admin", "Dealership Manager", "Sales Consultant / Staff", "Automation / System Administrator"];

export type Permission = "overview" | "conversations" | "sendSms" | "controlConversationJourney" | "reassign" | "journeys" | "templates" | "reports" | "compliance" | "users" | "settings" | "automation";

const allPermissions: Permission[] = ["overview", "conversations", "sendSms", "controlConversationJourney", "reassign", "journeys", "templates", "reports", "compliance", "users", "settings", "automation"];
const allRooftops: Rooftop[] = ["Cranbourne Kia", "Cranbourne MG", "Geely Cranbourne"];

export const roleProfiles: Record<Role, { shortLabel: string; name: string; rooftops: Rooftop[]; description: string; permissions: Permission[] }> = {
  "Super Admin": { shortLabel: "SUPER ADMIN", name: "Sarah Mitchell", rooftops: allRooftops, description: "Full system access, users, permissions, dealerships and integrations.", permissions: allPermissions },
  "Dealership Manager": { shortLabel: "MANAGER", name: "Alex Morgan", rooftops: ["Cranbourne Kia"], description: "Team oversight, customer conversations and journey performance at assigned dealerships.", permissions: ["overview", "conversations", "sendSms", "controlConversationJourney", "reassign", "reports"] },
  "Sales Consultant / Staff": { shortLabel: "STAFF", name: "Mia Harris", rooftops: ["Cranbourne Kia"], description: "Own and unassigned prospects, customer SMS, notes, outcomes and human takeover.", permissions: ["overview", "conversations", "sendSms", "controlConversationJourney"] },
  "Automation / System Administrator": { shortLabel: "AUTOMATION", name: "Priya Shah", rooftops: allRooftops, description: "Journey rules, message schedules, triggers, failures and execution history.", permissions: ["overview", "conversations", "controlConversationJourney", "journeys", "templates", "reports", "automation"] },
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return roleProfiles[role].permissions.includes(permission);
}

export function canViewProspect(role: Role, prospect: Prospect): boolean {
  const profile = roleProfiles[role];
  return profile.rooftops.includes(prospect.rooftop) && (role !== "Sales Consultant / Staff" || prospect.owner === profile.name || prospect.owner === "Unassigned");
}

const pagePermissions: Record<string, Permission> = {
  overview: "overview", conversations: "conversations", prospects: "conversations", journeys: "journeys", templates: "templates", reports: "reports", suppression: "compliance", team: "users", settings: "settings", automation: "automation",
};

export function canAccessPage(role: Role, page: string): boolean {
  const permission = pagePermissions[page];
  return !!permission && hasPermission(role, permission);
}
