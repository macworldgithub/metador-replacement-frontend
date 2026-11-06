"use client";
import { useCallback, useEffect, useState } from 'react';
import { sanitizeLiveSnapshot, type LiveLeadSnapshot } from '@/lib/live-dealersocket';

const stages: Record<string,string> = { checking_session:'Checking DealerSocket session',opening_opportunities:'Opening opportunities',
  reading_filter_catalog:'Checking available queues',reading_queue:'Reading current lead queues',reading_details:'Reading customer details' };
const time = (value: string | null) => value ? new Date(value).toLocaleString('en-AU',{timeZone:'Australia/Melbourne'}) : 'Not yet fetched';

export function LiveDealerSocketLeads() {
  const [snapshot,setSnapshot] = useState<LiveLeadSnapshot | null>(null);
  const [error,setError] = useState('');
  const [query,setQuery] = useState('');
  const [roof,setRoof] = useState('all');
  const [owner,setOwner] = useState('all');
  const api = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/integrations/dealersocket/leads/status',{
      method:'GET',cache:'no-store',credentials:'same-origin',signal,
    });
    const result = await response.json();
    if(response.status===401) window.dispatchEvent(new Event('booran:session-refresh'));
    if(!response.ok) throw new Error(result.message || 'Cannot read DealerSocket leads.');
    return sanitizeLiveSnapshot(result);
  },[]);
  useEffect(() => {
    const controller=new AbortController();
    let loading=false;
    const load=async () => {
      if(loading || document.hidden)return;
      loading=true;
      try {
        const result=await api(controller.signal);
        if(!controller.signal.aborted) { setSnapshot(result);setError(''); }
      } catch(cause) { if(!controller.signal.aborted) { setError(cause instanceof Error?cause.message:'Cannot load live leads.'); } }
      finally { loading=false; }
    };
    void load();
    const timer=window.setInterval(()=>void load(),5000);
    return()=>{controller.abort();window.clearInterval(timer);};
  },[api]);
  const running=snapshot?.state==='running';
  const rows=(snapshot?.records || []).filter(row=>(roof==='all'||row.rooftopId===roof) &&
    (owner==='all'||(row.owner||'Unassigned')===owner) &&
    `${row.customerName} ${row.mobile} ${row.email} ${row.vehicle} ${row.opportunityId}`.toLowerCase().includes(query.toLowerCase()));
  const completed=snapshot && snapshot.snapshotState !== null;
  return <div className="page-wrap live-leads-page">
    <div className="section-heading"><div><span className="eyebrow">DEALERSOCKET · READ ONLY</span><h2>Live dealership leads</h2><p>Current records from accessible dealership queues. These records are not enrolled in SMS journeys.</p></div>
    </div>
    <div className="live-leads-meta"><span>Last snapshot (Melbourne): <b>{time(snapshot?.fetchedAt ?? null)}</b></span>
      {snapshot?.durationSeconds !== null && snapshot?.durationSeconds !== undefined && <span>Read duration: {snapshot.durationSeconds.toFixed(1)} seconds</span>}
      {snapshot?.schedule.enabled ? <span>Server sync: every {snapshot.schedule.intervalSeconds / 60} minutes · Next scheduled attempt (Melbourne): <b>{time(snapshot.schedule.nextRunAt)}</b></span> :
        snapshot && <span>Automatic server sync is disabled. An administrator must enable the connector schedule.</span>}
    </div>
    {error && <p className="portal-api-error" role="alert">{error}</p>}
    {running && <p className="scope-note" role="status">{stages[snapshot?.progress || ''] || 'Reading DealerSocket'}. This may take a minute or longer; results appear when the read completes.</p>}
    {snapshot?.state==='error' && <p className="portal-api-error" role="alert">{snapshot.errorCode==='login_required'?'DealerSocket authentication failed during the refresh.':snapshot.errorCode==='read_timeout'?'The lead refresh exceeded its 10-minute time limit.':snapshot.errorCode==='session_unavailable'?'The automation browser could not verify a session.':snapshot.errorCode==='read_cancelled'?'The lead refresh was interrupted.':'The lead refresh failed while reading DealerSocket.'} {snapshot.progress && `Last stage: ${stages[snapshot.progress] || 'Reading DealerSocket'}.`} {snapshot.schedule.enabled && 'The server will retry automatically at the next scheduled attempt.'}</p>}
    {snapshot?.state==='idle' && <p className="scope-note">No snapshot is available yet. {snapshot.schedule.enabled?'Leads will also refresh on the server schedule.':'Server sync is disabled.'}</p>}
    {completed && <>
      {(running || snapshot.state==='error') && <p className="scope-note">Showing the previous snapshot from {time(snapshot.fetchedAt)}. These results have not been refreshed yet.</p>}
      <div className="live-roof-summary">{snapshot.rooftops.map(item=><article key={item.id}><b>{item.name}</b><span>{item.recordCount} visible {item.recordCount===1?'record':'records'}{item.matchedCandidateCount!==null?` / ${item.matchedCandidateCount} matching candidates`:''}</span>
        {item.recordCount===0 && <small>No matching records observed; complete rooftop coverage is unverified.</small>}</article>)}</div>
      <p className="scope-note">{snapshot.snapshotState==='partial'?'Partial snapshot. ':''}{snapshot.coverageNote} {snapshot.issues.join(' ')}</p>
      <div className="filter-bar card"><label>Search leads<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Customer, mobile, email, vehicle or opportunity" /></label>
        <label>Rooftop<select value={roof} onChange={e=>setRoof(e.target.value)}><option value="all">All permitted rooftops</option>{snapshot.rooftops.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Owner<select value={owner} onChange={e=>setOwner(e.target.value)}><option value="all">All owners</option>{Array.from(new Set(snapshot.records.map(row=>row.owner||'Unassigned'))).map(name=><option key={name}>{name}</option>)}</select></label>
        <span>{rows.length} visible records</span>
      </div>
      <section className="card"><div className="table-scroll"><table className="live-leads-table"><thead><tr><th>Customer / contact</th><th>Rooftop</th><th>Vehicle / source</th><th>Owner / status</th><th>Opportunity / timestamps</th></tr></thead><tbody>
        {rows.map(row=><tr key={row.id}><td><b>{row.customerName||'Name unavailable'}</b><span>{row.mobile||'Mobile unavailable'}</span><span>{row.email||'Email unavailable'}</span><small>{row.detailsVerified?'Details read':'Queue data only'}</small></td>
          <td>{row.rooftop}</td><td>{row.vehicle||'Vehicle unavailable'}<span>{row.source||'Source unavailable'}</span></td><td>{row.owner||'Unassigned'}<span>{row.status||'Status unavailable'}</span></td>
          <td><b>{row.opportunityId}</b><span>Customer ID: {row.customerId}</span><span>Observed: {time(row.observedAt)}</span><details><summary>Source details</summary><p>Source timestamp: {row.sourceTimestamp||'Unavailable'}</p><p>Timestamp basis: {row.sourceTimestampBasis||'Unverified'}</p>{row.missingFields && <p>Missing: {row.missingFields}</p>}{row.warnings && <p>Warnings: {row.warnings}</p>}</details></td></tr>)}
      </tbody></table></div>{!rows.length && <div className="empty-state">No records match the permitted scope and selected filters.</div>}</section>
    </>}
    {!snapshot && !error && <p role="status">Loading snapshot status…</p>}
  </div>;
}
