import type { NextRequest } from "next/server";
import { handleUsers } from "@/lib/users-server";

type Context = { params: Promise<{ path?: string[] }> };
async function handler(request: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  return handleUsers(request, path);
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
