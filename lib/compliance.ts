export const suppressionSources = [
  { value: "manual_admin", label: "Manual admin" },
  { value: "keyword_opt_out", label: "Opt-out keyword" },
  { value: "crm_flag", label: "CRM flag" },
] as const;
export type SuppressionSource = typeof suppressionSources[number]["value"];
export type Suppression = { mobile: string; reason: string; source: SuppressionSource; createdAt: string; updatedAt?: string };
export type ComplianceAudit = { generatedAt: string; complianceStandard: string; totalSuppressedNumbers: number; suppressions: Suppression[] };
export type RemovalResult = { success: boolean | Record<string, never>; mobile: string };

export function normalizeMobile(value: string): string | null {
  const cleaned = value.trim().replace(/[\s\-().]/g, "");
  const national = cleaned.startsWith("+61") ? `0${cleaned.slice(3)}` : cleaned.startsWith("61") && cleaned.length === 11 ? `0${cleaned.slice(2)}` : cleaned;
  return /^04\d{8}$/.test(national) ? `+61${national.slice(1)}` : null;
}
export function validateSuppression(body: Record<string, unknown>) {
  const fields: Record<string, string> = {};
  if (typeof body.mobile !== "string" || !normalizeMobile(body.mobile)) fields.mobile = "Enter a valid Australian mobile number.";
  if (typeof body.reason !== "string" || !body.reason.trim()) fields.reason = "Enter a reason for suppression.";
  if (body.source !== undefined && !suppressionSources.some((item) => item.value === body.source)) fields.source = "Choose a supported source.";
  return fields;
}
export class ComplianceApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}
export async function complianceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/compliance/${path}`, { ...init, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", ...init.headers } }); }
  catch { throw new ComplianceApiError("Cannot reach compliance management. Please try again.", 503); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("booran:session-refresh"));
    throw new ComplianceApiError(typeof data.message === "string" ? data.message : "Unable to complete your request.", response.status, data.fields ?? {});
  }
  return data as T;
}
