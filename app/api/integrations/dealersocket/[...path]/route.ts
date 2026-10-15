import type { NextRequest } from 'next/server';
import { handleDealerSocket } from '@/lib/dealersocket-server';

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleDealerSocket(request, (await context.params).path);
}
export { handler as GET, handler as POST };
