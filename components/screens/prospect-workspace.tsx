"use client";
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Role } from '@/lib/types';
import { Prospects } from './prospects';
import { LiveDealerSocketLeads } from './live-dealersocket-leads';
import { useSession } from '../auth/session-provider';

export function ProspectWorkspace(props: {role:Role;openConversation:(id:string)=>void;notify:(message:string)=>void}) {
  const user=useSession();
  const scopeKey=`${user.id}-${user.apiRole}-${user.rooftopIds.join(',')}`;
  const source=useSearchParams().get('source')==='portal'?'portal':'live';
  return <><nav className="prospect-source-tabs" aria-label="Prospect data source">
    <Link href="/prospects" className={`btn ${source==='live'?'primary':'secondary'}`} aria-current={source==='live'?'page':undefined}>Live DealerSocket leads</Link>
    <Link href="/prospects?source=portal" className={`btn ${source==='portal'?'primary':'secondary'}`} aria-current={source==='portal'?'page':undefined}>Portal conversations</Link>
  </nav>{source==='live'?<LiveDealerSocketLeads key={scopeKey}/>:<Prospects {...props}/>}</>;
}
