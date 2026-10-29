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
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    if (!['http:', 'https:'].includes(source.protocol) || source.origin !== origin) return false;
    // Next's internal URL may use the listening address (localhost/0.0.0.0)
    // instead of the hostname the browser requested. Host includes the port.
    const host = request.headers.get("host");
    const configured = process.env.PORTAL_ORIGIN;
    if (configured) return source.origin === new URL(configured).origin;
    if (host) return source.host === host.toLowerCase() && source.protocol === request.nextUrl.protocol;
    return source.origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function backendAuth(path: "login" | "me", init: RequestInit, request: NextRequest): Promise<Response> {
  const base = (process.env.API_BASE_URL || "https://www.cranbourne-backend.omnisuiteai.com/api").replace(/\/$/, "");
  const target = new URL(`${base}/auth/${path}`);
  if (target.origin === request.nextUrl.origin) throw new Error("The backend and frontend URLs must use different ports.");
  return fetch(target, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000), headers: { Accept: "application/json", ...init.headers } });
}
