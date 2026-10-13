import type { NextRequest } from "next/server";
import { authResponse, clearSession, sameOrigin } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return authResponse({ message: "Request origin is not allowed." }, 403);
  return clearSession(authResponse({ success: true }));
}
