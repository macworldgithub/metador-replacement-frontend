import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { conversationPath } from '@/lib/portal-routes';

type Props = { searchParams: Promise<{ prospect?: string | string[] }> };
async function LegacyDestination({ searchParams }: Props) {
  const { prospect } = await searchParams;
  if (typeof prospect === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(prospect)) redirect(conversationPath(prospect));
  redirect('/overview');
  return null;
}
export default function Home(props: Props) {
  return <Suspense fallback={<main className="session-state" role="status">Opening your workspace…</main>}>
    <LegacyDestination {...props} />
  </Suspense>;
}
