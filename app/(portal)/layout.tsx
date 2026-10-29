import { Suspense, type ReactNode } from 'react';
import { PortalApp } from '@/components/portal-app';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="session-state" role="status">Loading your workspace…</main>}>
    <PortalApp>{children}</PortalApp>
  </Suspense>;
}
