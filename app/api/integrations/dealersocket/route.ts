import type { NextRequest } from "next/server";
import {
  authResponse,
  clearSession,
  sessionCookie,
} from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token)
    return authResponse({ message: "Please sign in to continue." }, 401);
  const base = (
    process.env.API_BASE_URL || "http://localhost:3000/api"
  ).replace(/\/$/, "");
  const target = new URL(`${base}/integrations/dealersocket/status`);
  if (target.origin === request.nextUrl.origin)
    return authResponse(
      { message: "Backend and frontend URLs must differ." },
      503,
    );
  try {
    const response = await fetch(target, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401)
      return clearSession(
        authResponse(
          { message: "Your session has expired. Please sign in again." },
          401,
        ),
      );
    if (!response.ok || !data)
      return authResponse(
        {
          message:
            data?.message || "Unable to read DealerSocket connector status.",
        },
        response.ok ? 502 : response.status,
      );
    return authResponse(data);
  } catch {
    return authResponse(
      { message: "Cannot reach the DealerSocket connector service." },
      503,
    );
  }
}
