import { NextResponse, type NextRequest } from "next/server";

export const sessionCookie = "booran_session";
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export function authResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function clearSession(response: NextResponse) {
  response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" && (!origin || origin === request.nextUrl.origin);
}

export async function backendAuth(path: "login" | "me", init: RequestInit, request: NextRequest): Promise<Response> {
  const base = (process.env.API_BASE_URL || "http://localhost:3000/api").replace(/\/$/, "");
  const target = new URL(`${base}/auth/${path}`);
  if (target.origin === request.nextUrl.origin) throw new Error("The backend and frontend URLs must use different ports.");
  return fetch(target, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000), headers: { Accept: "application/json", ...init.headers } });
}
