import type { NextRequest } from "next/server";
import {
  authResponse,
  clearSession,
  sameOrigin,
  sessionCookie,
} from "@/lib/auth-server";

type Context = { params: Promise<{ path?: string[] }> };
async function handler(request: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  const [id, action] = path;
  const validId = id && /^[a-zA-Z0-9_-]{1,150}$/.test(id);
  const valid =
    path.length === 0
      ? request.method === "GET"
      : path.length === 1
        ? validId && request.method === "GET"
        : path.length === 2 &&
          validId &&
          (action === "thread"
            ? request.method === "GET"
            : ["messages", "notes"].includes(action)
              ? request.method === "POST"
              : ["journey", "outcome", "assign"].includes(action) &&
                request.method === "PATCH");
  if (!valid)
    return authResponse({ message: "Conversation endpoint not found." }, 404);
  if (request.method !== "GET" && !sameOrigin(request))
    return authResponse({ message: "Request origin is not allowed." }, 403);
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token)
    return authResponse({ message: "Please sign in to continue." }, 401);
  let body;
  if (request.method !== "GET") {
    try {
      body = await request.json();
    } catch {
      return authResponse({ message: "Invalid request body." }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return authResponse({ message: "Invalid request body." }, 400);
  }
  const base = (
    process.env.API_BASE_URL || "http://localhost:3000/api"
  ).replace(/\/$/, "");
  const url = new URL(
    `${base}/prospects${path.length ? `/${path.join("/")}` : ""}`,
  );
  if (url.origin === request.nextUrl.origin)
    return authResponse(
      { message: "Backend and frontend URLs must differ." },
      503,
    );
  for (const key of ["rooftopId", "status", "ownerName", "search"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null) url.searchParams.set(key, value);
  }
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 401)
      return clearSession(
        authResponse(
          { message: "Your session has expired. Please sign in again." },
          401,
        ),
      );
    if (!response.ok)
      return authResponse(
        {
          message:
            response.status >= 500
              ? "The conversation service encountered an error. Please try again."
              : Array.isArray(data?.message)
                ? data.message.join(" ")
                : data?.message || "Unable to complete your request.",
        },
        response.status,
      );
    if (!data)
      return authResponse({ message: "Invalid conversation response." }, 502);
    return authResponse(data, response.status);
  } catch {
    return authResponse(
      { message: "Cannot reach the conversation service. Please try again." },
      503,
    );
  }
}
export { handler as GET, handler as POST, handler as PATCH };
