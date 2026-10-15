import type { NextRequest } from "next/server";
import { handleDealerSocket } from "@/lib/dealersocket-server";

export async function GET(request: NextRequest) {
  return handleDealerSocket(request, ["status"]);
}
