export type DealerSocketStatus = {
  state: 'disconnected' | 'connecting' | 'connected' | 'login_required' | 'error';
  operation: 'login' | 'check' | null;
  lastCheckedAt: string | null;
  lastConnectedAt: string | null;
  errorCode: string | null;
  message: string;
  interactiveLoginEnabled: boolean;
  sessionExpiresAt: string | null;
  rooftops: { id: string; name: string; verified: boolean }[];
};

export function sanitizeDealerSocket(value: unknown): DealerSocketStatus {
  const data = value as DealerSocketStatus | null;
  const date = (value: unknown) => value === null || typeof value === 'string' && Number.isFinite(Date.parse(value));
  const roofs = [ ['cranbourne_kia', 'Cranbourne Kia'], ['cranbourne_mg', 'Cranbourne MG'], ['geely_cranbourne', 'Geely Cranbourne'] ];
  if (!data || !['disconnected', 'connecting', 'connected', 'login_required', 'error'].includes(data.state) ||
    ![null, 'login', 'check'].includes(data.operation) || typeof data.message !== 'string' || data.message.length > 500 ||
    !(data.errorCode === null || typeof data.errorCode === 'string' && /^[a-z_]{1,60}$/.test(data.errorCode)) ||
    typeof data.interactiveLoginEnabled !== 'boolean' || !date(data.lastCheckedAt) || !date(data.lastConnectedAt) || !date(data.sessionExpiresAt) ||
    !Array.isArray(data.rooftops) || data.rooftops.length !== 3 || roofs.some(([id, name]) =>
      !data.rooftops.some(roof => roof.id === id && roof.name === name && typeof roof.verified === 'boolean')))
    throw new Error('Invalid DealerSocket connection response.');
  return {
    state: data.state, operation: data.operation, message: data.message,
    errorCode: data.errorCode, interactiveLoginEnabled: data.interactiveLoginEnabled,
    lastCheckedAt: data.lastCheckedAt, lastConnectedAt: data.lastConnectedAt, sessionExpiresAt: data.sessionExpiresAt,
    rooftops: roofs.map(([id, name]) => ({ id, name, verified: data.rooftops.find(roof => roof.id === id)!.verified })),
  };
}
