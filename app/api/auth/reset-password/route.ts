import type { NextRequest } from "next/server";
import { authResponse, backendAuth, sameOrigin } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return authResponse({ message: "Request origin is not allowed." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return authResponse({ message: "Invalid request payload." }, 400);
  }

  if (!body || typeof body.token !== "string" || !body.token || typeof body.newPassword !== "string" || body.newPassword.length < 8) {
    return authResponse({ message: "Valid token and a password of at least 8 characters are required." }, 400);
  }

  try {
    const response = await backendAuth(
      "reset-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: body.token,
          newPassword: body.newPassword,
        }),
      },
      request,
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return authResponse(
        { message: data.message || "Unable to reset password. The link may have expired." },
        response.status,
      );
    }

    return authResponse(data, 200);
  } catch {
    return authResponse({ message: "Cannot reach the authentication service. Please try again." }, 503);
  }
}
