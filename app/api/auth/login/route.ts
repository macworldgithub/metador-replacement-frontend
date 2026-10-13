import type { NextRequest } from "next/server";
import { authResponse, backendAuth, clearSession, cookieOptions, sameOrigin, sessionCookie } from "@/lib/auth-server";
import { mapAuthProfile, sessionDuration } from "@/lib/auth-profile";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return authResponse({ message: "Request origin is not allowed." }, 403);
  let credentials: Record<string, unknown>;
  try { credentials = await request.json(); } catch { return authResponse({ message: "Enter a valid email and password." }, 400); }
  if (!credentials || typeof credentials.email !== "string" || typeof credentials.password !== "string" || !credentials.password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email.trim())) return authResponse({ message: "Enter a valid email and password." }, 400);
  try {
    const response = await backendAuth("login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: credentials.email.trim().toLowerCase(), password: credentials.password }) }, request);
    if (!response.ok) {
      if (response.status === 401) return clearSession(authResponse({ message: "Invalid email or password." }, 401));
      return authResponse({ message: response.status === 429 ? "Too many attempts. Please try again later." : "Sign-in is unavailable. Please try again." }, response.status === 429 ? 429 : 502);
    }
    const data = await response.json();
    if (typeof data.accessToken !== "string" || !data.accessToken || data.tokenType !== "Bearer") return authResponse({ message: "The authentication service returned an invalid response." }, 502);
    let user;
    try { user = mapAuthProfile(data.user); } catch { return clearSession(authResponse({ message: "Your account role or status is not supported. Contact your administrator." }, 403)); }
    const result = authResponse({ user });
    result.cookies.set(sessionCookie, data.accessToken, { ...cookieOptions, maxAge: sessionDuration(data.expiresIn) });
    return result;
  } catch {
    return authResponse({ message: "Cannot reach the authentication service. Please try again." }, 503);
  }
}
