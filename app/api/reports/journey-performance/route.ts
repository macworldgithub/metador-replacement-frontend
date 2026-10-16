import type { NextRequest } from "next/server";
import { authResponse, clearSession, sessionCookie } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return authResponse({ message: "Please sign in to continue." }, 401);

  const base = (process.env.API_BASE_URL || "http://localhost:3000/api").replace(/\/$/, "");
  const target = new URL(`${base}/reports/journey-performance`);
  for (const p of ["rooftopId", "from", "to"]) {
    const v = request.nextUrl.searchParams.get(p);
    if (v) target.searchParams.set(p, v);
  }

  try {
    const response = await fetch(target, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401) return clearSession(authResponse({ message: "Session expired." }, 401));
    if (!response.ok) return authResponse(data || { message: "Error in reports service." }, response.status);
    return authResponse(data, response.status);
  } catch {
    return authResponse({ message: "Cannot reach reports service." }, 503);
  }
}
