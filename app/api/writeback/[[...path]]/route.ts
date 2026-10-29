import type { NextRequest } from "next/server";
import { authResponse, clearSession, sameOrigin, sessionCookie } from "@/lib/auth-server";

type Context = { params: Promise<{ path?: string[] }> };

async function handler(request: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return authResponse({ message: "Please sign in to continue." }, 401);
  if (request.method !== "GET" && !sameOrigin(request)) return authResponse({ message: "Request origin is not allowed." }, 403);

  const base = (process.env.API_BASE_URL || "https://www.cranbourne-backend.omnisuiteai.com/api").replace(/\/$/, "");
  const target = new URL(`${base}/writeback${path.length ? `/${path.join("/")}` : ""}`);
  const status = request.nextUrl.searchParams.get("status");
  if (status) target.searchParams.set("status", status);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401) return clearSession(authResponse({ message: "Session expired." }, 401));
    if (!response.ok) return authResponse(data || { message: "Error in writeback service." }, response.status);
    return authResponse(data, response.status);
  } catch {
    return authResponse({ message: "Cannot reach writeback service." }, 503);
  }
}

export { handler as GET, handler as POST };
