"use client";
import { useEffect, useState } from 'react';
import { useSession } from '../auth/session-provider';
import { fetchJourneys, activateJourney, pauseJourney, type JourneyRecord } from '@/lib/journeys';
import { fetchPerformance, type PerformanceReport } from '@/lib/reports';
import { useRooftops } from '@/lib/rooftops';
import { DealerSocketConnection } from './dealersocket-connection';
import type { Role } from '@/lib/types';

type Props = { notify: (message: string) => void };
function Notice({ error, loading }: { error: string; loading: boolean }) {
  return error ? <div className="portal-api-error" role="alert">{error} No sample data is substituted.</div>
    : loading ? <div className="scope-note" role="status">Loading saved records…</div> : null;
}
function timestamp(value: string) {
  return new Date(value).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
}

export function Journeys({ notify }: Props) {
  const user = useSession();
  const roofs = useRooftops();
  const permitted = roofs.rooftops.filter(r => user.rooftopIds.includes(r.id));
  const [selected, setSelected] = useState('');
  const rooftopId = selected || permitted[0]?.id;
  const [journeys, setJourneys] = useState<JourneyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setJourneys([]); setError('');
    if (!rooftopId) { setLoading(false); return; }
    setLoading(true);
    void fetchJourneys(rooftopId).then(data => { if (!cancelled) setJourneys(data); })
      .catch(cause => { if (!cancelled) setError(cause.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rooftopId, version]);
  const current = journeys.find(j => j.data.isCurrent === true);
  const active = current?.data.enabled === true;
  async function toggle() {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (active) await pauseJourney(current.key); else await activateJourney(current.key);
      setVersion(v => v + 1);
      notify(active ? 'Journey paused for new leads.' : 'Journey activated for new leads.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update journey.'); }
    finally { setBusy(false); }
  }
  return <div className="page-wrap">
    <div className="section-heading"><div><span className="eyebrow">SAVED JOURNEY CONFIGURATION</span><h2>Automated new-lead journey</h2>
      <p>Current published configuration for each authorised dealership.</p></div>
      <button className="btn secondary" disabled={!current || loading || busy || !!error} onClick={() => void toggle()}>{busy ? 'Updating…' : active ? 'Pause' : 'Activate'}</button></div>
    <Notice error={roofs.error || error} loading={roofs.loading || loading} />
    <div className="roof-tabs">{permitted.map(r => <button key={r.id} className={r.id === rooftopId ? 'active' : ''} onClick={() => setSelected(r.id)}>{r.name}</button>)}</div>
    {!loading && !error && !current && <div className="empty-state"><b>No current published journey</b><span>A saved published configuration is required before activation.</span></div>}
    {current && !error && <section className="card journey-builder"><div className="card-header"><div><h3>{current.data.name}</h3>
      <p>Version {current.data.version ?? 'not recorded'} · {current.data.publishedAt ? `Published ${timestamp(current.data.publishedAt)} (Melbourne)` : 'Publication time not recorded'}</p></div>
      <span className={'active-badge ' + (active ? '' : 'off')}>{active ? 'ACTIVE' : 'PAUSED'}</span></div>
      <div className="steps-list">{current.data.steps.map((step, index) => <div className="journey-step" key={index}><div className="step-number">{index + 1}</div><div>
        <span>{step.delayType === 'immediate' ? 'Immediate' : `${step.delayValue} · ${step.delayType.replaceAll('_', ' ')}`}</span><h4>{step.name}</h4><p>{step.template}</p>
      </div></div>)}</div></section>}
    <p className="scope-note">This is saved configuration. ACTIVE permits new journeys; it does not confirm that SMS delivery is available.</p>
  </div>;
}

export function Reports({ notify }: Props & { role: Role }) {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const roofs = useRooftops();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setReport(null); setError('');
    void fetchPerformance().then(data => {
      if (!Array.isArray(data.rooftops) || !Array.isArray(data.daily)) throw new Error('Reporting service needs the latest backend update.');
      if (!cancelled) setReport(data);
    }).catch(cause => { if (!cancelled) setError(cause.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version]);
  const sum = (field: 'totalLeads' | 'replied' | 'optedOut') => report!.rooftops.reduce((total, r) => total + r[field], 0);
  const outcome = (key: string) => report!.rooftops.reduce((total, r) => total + (r.outcomes[key] ?? 0), 0);
  function download() {
    if (!report) return;
    const rows = [['rooftop_id', 'leads', 'replied', 'reply_rate', 'median_first_sms_seconds', 'failed_sends', 'appointment_requested', 'handed_to_salesperson', 'not_interested', 'opted_out', 'wrong_number'],
      ...report.rooftops.map(r => [r.rooftopId, r.totalLeads, r.replied, r.replyRate, r.medianFirstSmsSeconds ?? '', r.failedSends,
        r.outcomes.appointment_requested ?? 0, r.outcomes.handed_to_salesperson ?? 0, r.outcomes.not_interested ?? 0, r.optedOut, r.outcomes.wrong_number ?? 0])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'journey-performance.csv'; link.click(); URL.revokeObjectURL(url);
    notify('Performance report downloaded.');
  }
  const max = report ? Math.max(1, ...report.daily.flatMap(d => [d.leads, d.replies])) : 1;
  return <div className="page-wrap"><div className="section-heading"><div><span className="eyebrow">RECORDED PORTAL ACTIVITY</span><h2>Journey performance</h2>
    <p>Saved portal prospects and SMS events across your authorised dealerships.</p></div><div className="intro-actions">
      <button className="btn secondary" disabled={loading} onClick={() => setVersion(v => v + 1)}>Refresh</button>
      <button className="btn secondary" disabled={!report || loading} onClick={download}>Export CSV</button></div></div>
    <Notice error={error} loading={loading} />
    {report && <><p className="scope-note">As of {timestamp(report.generatedAt)} (Melbourne). {report.excludedTestRecords} known test records excluded. These totals describe saved portal records, not the separate live DealerSocket snapshot.</p>
      <div className="report-stats">{[
        { label: 'New leads', value: sum('totalLeads'), detail: 'Recorded prospects' },
        { label: 'Replied', value: sum('totalLeads') ? `${Math.round(sum('replied') / sum('totalLeads') * 100)}%` : '—', detail: `${sum('replied')} prospects with a reply` },
        { label: 'Median first SMS', value: report.medianFirstSmsSeconds == null ? '—' : `${Math.round(report.medianFirstSmsSeconds)}s`, detail: report.medianFirstSmsSeconds == null ? 'No confirmed send records' : 'Automated sends accepted by the provider' },
        { label: 'Appointments', value: outcome('appointment_requested'), detail: 'Recorded appointment requests' },
      ].map(item => <article className="card" key={item.label}><span>{item.label}</span><b>{item.value}</b><small>{item.detail}</small></article>)}</div>
      <div className="reports-grid"><section className="card chart-card"><div className="card-header"><div><h3>Daily leads and customer replies</h3><p>Melbourne dates · recent recorded activity · leads / reply messages</p></div></div>
        {report.daily.length ? <div className="bar-chart">{report.daily.slice(-14).map(d => <div key={d.date} title={`${d.date}: ${d.leads} leads, ${d.replies} replies`}>
          <i style={{ height: `${d.leads / max * 100}%` }} /><em style={{ height: `${d.replies / max * 100}%` }} /><span>{d.date.slice(5)}<br />{d.leads}/{d.replies}</span></div>)}</div>
          : <div className="empty-state">No recorded activity.</div>}</section>
        <section className="card rooftop-report"><div className="card-header"><h3>By dealership rooftop</h3></div>{report.rooftops.map(r => <div className="roof-report-row" key={r.rooftopId}>
          <span><b>{roofs.rooftops.find(roof => roof.id === r.rooftopId)?.name ?? r.rooftopId.replaceAll('_', ' ')}</b><small>{r.totalLeads} leads</small></span>
          <strong>{r.totalLeads ? `${Math.round(r.replyRate * 100)}%` : '—'}</strong><small>reply rate</small></div>)}</section></div>
      <section className="card outcome-table"><div className="card-header"><div><h3>Recorded outcomes</h3><p>Portal records. CRM writeback completion is tracked separately in Automation monitoring.</p></div></div>
        <div className="outcome-grid">{[
          ['Appointment requested', outcome('appointment_requested')], ['Handed to salesperson', outcome('handed_to_salesperson')],
          ['Not interested', outcome('not_interested')], ['Opted out', sum('optedOut')], ['Wrong number', outcome('wrong_number')],
        ].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div></section>
    </>}
  </div>;
}

export function Settings(_: Props) {
  const [tab, setTab] = useState('Dealership identities');
  const roofs = useRooftops();
  const user = useSession();
  return <div className="page-wrap dealership-settings"><div className="section-heading"><div><span className="eyebrow">BOORAN MOTOR GROUP</span><h2>Dealership identities &amp; CRM connection</h2><p>Sending identities, business hours and CRM connection.</p></div></div>
    <div className="settings-layout"><nav className="settings-tabs">{['Dealership identities', 'DealerSocket connection'].map(value => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value}</button>)}</nav>
      <section className="card settings-card"><div className="card-header"><h3>{tab}</h3></div>{tab === 'DealerSocket connection' ? <DealerSocketConnection /> : <>
        <Notice error={roofs.error} loading={roofs.loading} />
        <div className="identity-list">{roofs.rooftops.filter(r => user.rooftopIds.includes(r.id)).map(r => <article className="identity-card" key={r.id}>
          <header className="identity-header"><div><span className="eyebrow">DEALERSHIP</span><h4>{r.name}</h4></div><span className={'active-badge ' + (r.senderPhone ? '' : 'off')}>{r.senderPhone ? 'CONFIGURED' : 'NOT CONFIGURED'}</span></header>
          <dl className="identity-details">
            <div className="identity-address"><dt>Address</dt><dd>{r.address || 'Not configured'}</dd></div>
            <div><dt>Sender number</dt><dd>{r.senderPhone || 'Not configured'}</dd></div>
            <div><dt>Contact number</dt><dd>{r.displayPhone || 'Not configured'}</dd></div>
          </dl>
          <footer className="identity-hours"><div><span>Sending hours</span><strong>{r.sendHours.start}–{r.sendHours.end}</strong></div><div><span>Closed days</span><strong>{r.closedDays.join(', ') || 'None configured'}</strong></div><div><span>SMS sending</span><strong>{r.smsMode === 'test_only' ? 'Test recipient only' : r.smsMode === 'disabled' ? 'Disabled' : r.smsMode === 'enabled' ? 'Provider configured' : 'Not verified'}</strong></div></footer>
        </article>)}</div>
        <p className="scope-note">Configured means a sender number is stored. Delivery and inbound capability require provider verification.</p>
      </>}</section></div></div>;
}
