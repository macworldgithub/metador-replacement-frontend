import type { NextRequest } from "next/server";
import { authResponse, backendAuth, clearSession, sessionCookie } from "@/lib/auth-server";
import { mapAuthProfile } from "@/lib/auth-profile";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return authResponse({ message: "Please sign in to continue." }, 401);
  try {
    const response = await backendAuth("me", { headers: { Authorization: `Bearer ${token}` } }, request);
    if (response.status === 401 || response.status === 403) return clearSession(authResponse({ message: "Your session has expired. Please sign in again." }, 401));
    if (!response.ok) return authResponse({ message: "Cannot load your profile. Please try again." }, 502);
    const data = await response.json();
    try { return authResponse({ user: mapAuthProfile(data) }); }
    catch { return clearSession(authResponse({ message: "Your account role or status is not supported. Contact your administrator." }, 401)); }
  } catch { return authResponse({ message: "Cannot reach the authentication service. Please try again." }, 503); }
}
