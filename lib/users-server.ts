import type { NextRequest } from "next/server";
import { authResponse, backendAuth, clearSession, sameOrigin, sessionCookie } from "./auth-server";
import { sanitizeUser, validateUserInput } from "./users";

export async function handleUsers(request: NextRequest, segments: string[]) {
  const method = request.method;
  const [id, action] = segments;
  const validRoute = segments.length === 0 ? ["GET", "POST"].includes(method) : segments.length === 1 ? /^[a-f\d]{24}$/i.test(id) && ["GET", "DELETE"].includes(method) : segments.length === 2 && /^[a-f\d]{24}$/i.test(id) && ["role", "rooftops", "password"].includes(action) && method === "PATCH";
  if (!validRoute) return authResponse({ message: "User-management endpoint not found." }, 404);
  if (method !== "GET" && !sameOrigin(request)) return authResponse({ message: "Request origin is not allowed." }, 403);
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return authResponse({ message: "Please sign in to continue." }, 401);
  try {
    const profileResponse = await backendAuth("me", { headers: { Authorization: `Bearer ${token}` } }, request);
    if (profileResponse.status === 401) return clearSession(authResponse({ message: "Your session has expired. Please sign in again." }, 401));
    if (!profileResponse.ok) return authResponse({ message: "Unable to verify user-management access." }, profileResponse.status === 403 ? 403 : 502);
    const actor = await profileResponse.json();
    if (actor.role !== "group_admin" || actor.isActive === false) return authResponse({ message: "Only Group Admin can manage portal users." }, 403);
    if (method === "DELETE" && id === actor.id) return authResponse({ message: "You cannot deactivate your own account." }, 400);
    let body: Record<string, unknown> | undefined;
    if (method === "POST" || method === "PATCH") {
      let raw;
      try { raw = await request.json(); } catch { return authResponse({ message: "Invalid request body." }, 400); }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return authResponse({ message: "Invalid request body." }, 400);
      const fields = validateUserInput(method === "POST" ? "create" : action as "role" | "rooftops" | "password", raw);
      if (Object.keys(fields).length) return authResponse({ message: "Check the highlighted fields.", fields }, 400);
      if (action === "role" && id === actor.id && raw.role !== "group_admin") return authResponse({ message: "Ask another Group Admin to change your own administrator role." }, 400);
      body = method === "POST" ? { name: raw.name.trim(), email: raw.email.trim().toLowerCase(), password: raw.password, role: raw.role, rooftopIds: [...new Set(raw.rooftopIds)] } : action === "role" ? { role: raw.role } : action === "password" ? { newPassword: raw.newPassword } : { rooftopIds: [...new Set(raw.rooftopIds)] };
    }
    const base = (process.env.API_BASE_URL || "https://www.cranbourne-backend.omnisuiteai.com/api").replace(/\/$/, "");
    const response = await fetch(`${base}/users${segments.length ? `/${segments.join("/")}` : ""}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(10000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) return clearSession(authResponse({ message: "Your session has expired. Please sign in again." }, 401));
      const message = response.status >= 500 ? "User management is unavailable. Please try again." : Array.isArray(data.message) ? data.message.join(" ") : typeof data.message === "string" ? data.message : "Unable to complete your request.";
      return authResponse({ message }, response.status >= 500 ? 502 : response.status);
    }
    if (action === "password") return authResponse({ message: "Password updated successfully" });
    if (method === "DELETE") return authResponse({ message: "User deactivated", user: sanitizeUser(data.user) });
    if (!segments.length && method === "GET") {
      if (!Array.isArray(data)) return authResponse({ message: "Invalid user list returned by the service." }, 502);
      return authResponse(data.map(sanitizeUser));
    }
    return authResponse(sanitizeUser(data), method === "POST" ? 201 : 200);
  } catch { return authResponse({ message: "Cannot reach user management. Please try again." }, 503); }
}
