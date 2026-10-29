import type { NextRequest } from "next/server";
import { authResponse, backendAuth, clearSession, sameOrigin, sessionCookie } from "./auth-server";
import { normalizeMobile, validateSuppression } from "./compliance";

export async function handleCompliance(request: NextRequest, segments: string[]) {
  const method = request.method;
  const [action, mobile] = segments;
  const valid = segments.length === 1 && (method === "GET" && ["suppressions", "audit"].includes(action) || method === "POST" && action === "suppress") || segments.length === 2 && method === "DELETE" && action === "suppress";
  if (!valid) return authResponse({ message: "Compliance endpoint not found." }, 404);
  if (method !== "GET" && !sameOrigin(request)) return authResponse({ message: "Request origin is not allowed." }, 403);
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return authResponse({ message: "Please sign in to continue." }, 401);
  try {
    const profile = await backendAuth("me", { headers: { Authorization: `Bearer ${token}` } }, request);
    if (profile.status === 401) return clearSession(authResponse({ message: "Your session has expired. Please sign in again." }, 401));
    if (!profile.ok) return authResponse({ message: "Unable to verify compliance access." }, profile.status === 403 ? 403 : 502);
    const actor = await profile.json();
    if (actor.role !== "group_admin" || actor.isActive === false) return authResponse({ message: "Only Group Admin can manage global suppressions." }, 403);
    let body;
    let normalized: string | null = null;
    if (method === "POST") {
      let raw;
      try { raw = await request.json(); } catch { return authResponse({ message: "Invalid request body." }, 400); }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return authResponse({ message: "Invalid request body." }, 400);
      const fields = validateSuppression(raw);
      if (Object.keys(fields).length) return authResponse({ message: "Check the highlighted fields.", fields }, 400);
      body = { mobile: normalizeMobile(raw.mobile), reason: raw.reason.trim(), source: raw.source ?? "manual_admin" };
    }
    if (method === "DELETE") {
      normalized = normalizeMobile(mobile);
      if (!normalized) return authResponse({ message: "Enter a valid Australian mobile number." }, 400);
    }
    const base = (process.env.API_BASE_URL || "https://www.cranbourne-backend.omnisuiteai.com/api").replace(/\/$/, "");
    const response = await fetch(`${base}/compliance/${action}${normalized ? `/${encodeURIComponent(normalized)}` : ""}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401) return clearSession(authResponse({ message: "Your session has expired. Please sign in again." }, 401));
    if (!response.ok) return authResponse({ message: response.status >= 500 ? "Compliance service is unavailable. Please try again." : Array.isArray(data?.message) ? data.message.join(" ") : typeof data?.message === "string" ? data.message : "Unable to complete your request." }, response.status);
    const isSuppression = (item: unknown) => !!item && typeof item === "object" && typeof (item as Record<string, unknown>).mobile === "string" && typeof (item as Record<string, unknown>).reason === "string" && typeof (item as Record<string, unknown>).createdAt === "string" && typeof (item as Record<string, unknown>).source === "string";
    // The documented backend returns success: {} on DELETE. Do not treat that object as confirmation of removal.
    const validData = action === "audit" ? data && typeof data.generatedAt === "string" && typeof data.complianceStandard === "string" && typeof data.totalSuppressedNumbers === "number" && Array.isArray(data.suppressions) && data.suppressions.every(isSuppression) : method === "DELETE" ? data && typeof data.mobile === "string" && (typeof data.success === "boolean" || data.success && typeof data.success === "object" && !Array.isArray(data.success) && Object.keys(data.success).length === 0) : method === "POST" ? isSuppression(data) : Array.isArray(data) && data.every(isSuppression);
    if (!validData) return authResponse({ message: "Invalid compliance response returned by the service." }, 502);
    return authResponse(data, response.status);
  } catch { return authResponse({ message: "Cannot reach compliance management. Please try again." }, 503); }
}
