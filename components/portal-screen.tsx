"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext } from 'react';
import type { PortalPage } from '@/lib/portal-routes';
import { conversationPath } from '@/lib/portal-routes';
import { canAccessPage } from '@/lib/permissions';
import { useSession } from './auth/session-provider';
import { Dashboard } from './screens/dashboard';
import { Conversations } from './screens/conversations';
import { ProspectWorkspace } from './screens/prospect-workspace';
import { AdminScreen } from './screens/admin-screens';

export const PortalNotificationContext = createContext<(message: string) => void>(() => {});

export function PortalScreen({ page, prospectId = '' }: { page: PortalPage; prospectId?: string }) {
  const user = useSession();
  const router = useRouter();
  const notify = useContext(PortalNotificationContext);
  if (!canAccessPage(user.role, page, user)) return <div className="page-wrap" role="alert">
    <h2>Access unavailable</h2><p>Your account does not have access to this page.</p>
    <Link href="/overview" className="btn secondary">Back to overview</Link>
  </div>;
  const navigate = (next: string) => {
    if (canAccessPage(user.role, next, user)) router.push(`/${next}`);
    else notify('This page is unavailable for your role.');
  };
  const openConversation = (id: string) => router.push(conversationPath(id));
  if (page === 'overview') return <Dashboard role={user.role} navigate={navigate} openConversation={openConversation} />;
  if (page === 'prospects') return <ProspectWorkspace role={user.role} notify={notify} openConversation={openConversation} />;
  if (page === 'conversations') return <Conversations
    key={`${user.id}-${user.apiRole}-${user.rooftopIds.join(',')}-${prospectId}`}
    initialProspectId={prospectId} role={user.role} notify={notify} onSelectProspect={openConversation} />;
  return <AdminScreen role={user.role} page={page} notify={notify} />;
}
