import type { NextRequest } from 'next/server';
import { authResponse, backendAuth, clearSession, sameOrigin, sessionCookie } from './auth-server';
import { sanitizeDealerSocket } from './dealersocket';
import { sanitizeLiveSnapshot } from './live-dealersocket';

export async function handleDealerSocket(request: NextRequest, path: string[]) {
  const action = path.join('/');
  const live = ['leads/status','leads/read'].includes(action);
  if (!(request.method === 'GET' && ['status','leads/status'].includes(action) || request.method === 'POST' && ['check', 'login/start','login/automatic/start','leads/read'].includes(action)))
    return authResponse({ message: 'DealerSocket endpoint not found.' }, 404);
  // A real Origin is required for opening/checking the local automation browser.
  if (request.method !== 'GET' && (!request.headers.get('origin') || !sameOrigin(request)))
    return authResponse({ message: 'Request origin is not allowed.' }, 403);
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return authResponse({ message: 'Please sign in to continue.' }, 401);
  try {
    const profile = await backendAuth('me', { headers: { Authorization: `Bearer ${token}` } }, request);
    if (profile.status === 401) return clearSession(authResponse({ message: 'Your session has expired. Please sign in again.' }, 401));
    if (!profile.ok) return authResponse({ message: 'Cannot verify integration access.' }, 503);
    const actor = await profile.json();
    const viewLive = action === 'leads/status' && ['group_admin','sales_manager','bdc','salesperson','read_only'].includes(actor.role);
    if ((!viewLive && actor.role !== 'group_admin') || actor.isActive !== true)
      return authResponse({ message: 'Only Group Admin can manage the DealerSocket connection.' }, 403);
    const base = (process.env.API_BASE_URL || 'https://www.cranbourne-backend.omnisuiteai.com/api').replace(/\/$/, '');
    if (new URL(base).origin === request.nextUrl.origin) return authResponse({ message: 'Backend configuration is invalid.' }, 503);
    const response = await fetch(`${base}/integrations/dealersocket/${action}`, {
      method: request.method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
    if (response.status === 401) return clearSession(authResponse({ message: 'Your session has expired. Please sign in again.' }, 401));
    if (!response.ok) return authResponse({ message: response.status === 403 ? 'Access to this integration is restricted.' : response.status === 409 ? 'DealerSocket is busy. Wait for the current operation to finish.' : 'DealerSocket connector is unavailable. Check the automation PC and connector setup.' }, response.status);
    try { return authResponse(live ? sanitizeLiveSnapshot(await response.json()) : sanitizeDealerSocket(await response.json()), response.status); }
    catch { return authResponse({ message: 'Invalid DealerSocket connection response.' }, 502); }
  } catch { return authResponse({ message: 'Cannot reach the DealerSocket connection service.' }, 503); }
}
