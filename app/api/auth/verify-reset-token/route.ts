import type { NextRequest } from "next/server";
import { authResponse, backendAuth, sameOrigin } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) return authResponse({ message: "Request origin is not allowed." }, 403);

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return authResponse({ message: "Reset token is required." }, 400);
  }

  try {
    const response = await backendAuth(
      `verify-reset-token?token=${encodeURIComponent(token)}`,
      { method: "GET" },
      request,
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return authResponse(
        { message: data.message || "Invalid or expired password reset link." },
        response.status,
      );
    }

    return authResponse(data, 200);
  } catch {
    return authResponse({ message: "Cannot reach the authentication service. Please try again." }, 503);
  }
}
