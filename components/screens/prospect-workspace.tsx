"use client";
import { useState } from 'react';
import type { Role } from '@/lib/types';
import { Prospects } from './prospects';
import { LiveDealerSocketLeads } from './live-dealersocket-leads';
import { useSession } from '../auth/session-provider';

export function ProspectWorkspace(props: {role:Role;openConversation:(id:string)=>void;notify:(message:string)=>void}) {
  const user=useSession();
  const scopeKey=`${user.id}-${user.apiRole}-${user.rooftopIds.join(',')}`;
  const [source,setSource]=useState<'live'|'portal'>('live');
  return <><nav className="prospect-source-tabs" aria-label="Prospect data source">
    <button className={`btn ${source==='live'?'primary':'secondary'}`} aria-pressed={source==='live'} onClick={()=>setSource('live')}>Live DealerSocket leads</button>
    <button className={`btn ${source==='portal'?'primary':'secondary'}`} aria-pressed={source==='portal'} onClick={()=>setSource('portal')}>Portal conversations</button>
  </nav>{source==='live'?<LiveDealerSocketLeads key={scopeKey}/>:<Prospects {...props}/>}</>;
}
