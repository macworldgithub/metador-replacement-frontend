"use client";
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../auth/session-provider';
import { sanitizeDealerSocket, type DealerSocketStatus } from '@/lib/dealersocket';

const labels = { disconnected: 'Not checked / disconnected', connecting: 'Connecting', connected: 'Connected', login_required: 'Login required', error: 'Connection error' };

export function DealerSocketConnection() {
  const user = useSession();
  const [status, setStatus] = useState<DealerSocketStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const allowed = user.apiRole === 'group_admin';
  const request = useCallback(async (action = 'status', signal?: AbortSignal) => {
    const response = await fetch(`/api/integrations/dealersocket/${action}`, {
      method: action === 'status' ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin', signal,
    });
    const data = await response.json();
    if (response.status === 401) window.dispatchEvent(new Event('booran:session-refresh'));
    if (!response.ok) throw new Error(data.message || 'Unable to check DealerSocket.');
    return sanitizeDealerSocket(data);
  }, []);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    let loading = false;
    async function load() {
      if (loading || document.hidden) return;
      loading = true;
      try { const next = await request('status', controller.signal); if (!controller.signal.aborted) { setStatus(next); setError(''); } }
      catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Connection unavailable.'); }
      finally { loading = false; }
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [allowed, request]);
  async function act(action: string) {
    if (busy || status?.operation) return;
    setBusy(true); setError('');
    try { setStatus(await request(action)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Connection action failed.'); }
    finally { setBusy(false); }
  }
  const time = (value: string | null) => value ? new Date(value).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }) : 'Not yet verified';
  if (!allowed) return <div className="scope-note">Only Super Admin can manage the DealerSocket connection.</div>;
  const disabled = busy || !!status?.operation;
  return <div className="dealersocket-panel">
    <div className={'connection-banner connection-state-' + (error ? 'error' : status?.operation ? 'working' : status?.state ?? 'loading')}><div><b>DealerSocket session</b><p aria-live="polite">{error ? 'Connection status unavailable' : status?.operation === 'read' ? 'Lead read in progress' : status ? labels[status.state] : 'Loading connection status…'}</p></div></div>
    {error && <p className="portal-api-error" role="alert">{error}</p>}
    <p aria-live="polite">{!error && status?.message}</p>
    <div className="intro-actions" style={{ margin: '16px 0', flexWrap: 'wrap' }}>
      <button className="btn secondary" disabled={disabled} onClick={() => void act('check')}>{busy || status?.operation === 'check' ? 'Checking…' : 'Check connection'}</button>
      <button className="btn primary" disabled={disabled || !status?.interactiveLoginEnabled || status?.errorCode === 'auto_login_manual_required'} onClick={() => void act('login/automatic/start')}>{status?.operation === 'login' ? 'Login in progress…' : 'Log in automatically · Show Chrome'}</button>
      <button className="btn secondary" disabled={disabled || !status?.interactiveLoginEnabled} onClick={() => void act('login/start')}>Open manual login</button>
    </div>
    <p>Automatic login opens Chrome on the automation PC and enters the configured username, password and authenticator code. Existing retry limits and cooldown still apply. Use manual login for extra verification or unsupported challenges.</p>
    {status?.errorCode === 'auto_login_manual_required' && <p className="scope-note">Automatic recovery is paused. Complete a manual login to restore verified access before retrying automation.</p>}
    {status && !status.interactiveLoginEnabled && <p>Interactive login is disabled in the connector settings.</p>}
    <dl className="connection-details"><div><dt>Last check (Melbourne)</dt><dd>{time(status?.lastCheckedAt ?? null)}</dd></div><div><dt>Last successful check (Melbourne)</dt><dd>{time(status?.lastConnectedAt ?? null)}</dd></div><div><dt>Session expiry</dt><dd>{status?.sessionExpiresAt ? time(status.sessionExpiresAt) : 'Controlled by DealerSocket; duration not verified'}</dd></div></dl>
    {status && <><h4>Rooftop access evidence</h4><ul>{status.rooftops.map(roof => <li key={roof.id}>{roof.name}: {!error && status.state === 'connected' && roof.verified ? 'Explicit dealership label observed' : 'Not verified'}</li>)}</ul></>}
    <p className="scope-note">This connection check does not send SMS, import leads or change CRM records. Unverified rooftop access needs a separate coverage check.</p>
  </div>;
}
