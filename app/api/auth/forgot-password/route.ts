import type { NextRequest } from "next/server";
import { authResponse, backendAuth, sameOrigin } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return authResponse({ message: "Request origin is not allowed." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return authResponse({ message: "Enter a valid email address." }, 400);
  }

  if (!body || typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return authResponse({ message: "Enter a valid email address." }, 400);
  }

  try {
    const response = await backendAuth(
      "forgot-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: body.email.trim().toLowerCase() }),
      },
      request,
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return authResponse(
        { message: data.message || "Unable to process password reset request." },
        response.status,
      );
    }

    return authResponse(data, 200);
  } catch {
    return authResponse({ message: "Cannot reach the authentication service. Please try again." }, 503);
  }
}
