export const portalPages = ['overview', 'prospects', 'conversations', 'journeys', 'reports', 'suppression', 'team', 'settings', 'automation'] as const;
export type PortalPage = typeof portalPages[number];

export function conversationPath(id: string): string {
  return `/conversations/${encodeURIComponent(id)}`;
}

// Only known internal portal destinations may be used after sign-in.
export function safePortalDestination(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/overview';
  try {
    const url = new URL(value, 'https://portal.invalid');
    if (url.origin !== 'https://portal.invalid') return '/overview';
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 1 && portalPages.includes(parts[0] as PortalPage)) return url.pathname + url.search;
    if (parts.length === 2 && parts[0] === 'conversations') {
      const id = decodeURIComponent(parts[1]);
      if (id.length <= 200 && id !== '.' && id !== '..' && !/[\/\\\u0000-\u001f]/.test(id)) return conversationPath(id);
    }
  } catch { /* Invalid URL or encoding falls back to the workspace. */ }
  return '/overview';
}
