import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authResponse, backendAuth, sessionCookie } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return authResponse({ message: 'Please sign in to open the automation browser.' }, 401);
  try {
    const response = await backendAuth('me', { headers: { Authorization: `Bearer ${token}` } }, request);
    if (!response.ok) return authResponse({ message: 'Cannot verify browser viewer access.' }, response.status);
    const actor = await response.json();
    if (actor.role !== 'group_admin' || actor.isActive !== true) {
      return authResponse({ message: 'Only Super Admin can open the automation browser.' }, 403);
    }
    const configured = process.env.DEALERSOCKET_VIEWER_URL;
    if (!configured) return authResponse({ message: 'The production browser viewer needs server setup. Configure DEALERSOCKET_VIEWER_URL after installing the secured viewer.' }, 503);
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return authResponse({ message: 'Browser viewer configuration requires an HTTPS URL without embedded credentials.' }, 503);
    }
    const result = NextResponse.redirect(url);
    result.headers.set('Cache-Control', 'no-store');
    result.headers.set('Referrer-Policy', 'no-referrer');
    return result;
  } catch {
    return authResponse({ message: 'Cannot open the automation browser. Check viewer configuration and backend availability.' }, 503);
  }
}
