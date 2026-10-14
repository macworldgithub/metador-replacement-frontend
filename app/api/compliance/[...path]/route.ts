import type { NextRequest } from "next/server";
import { handleCompliance } from "@/lib/compliance-server";

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return handleCompliance(request, path);
}
export { handler as GET, handler as POST, handler as DELETE };
