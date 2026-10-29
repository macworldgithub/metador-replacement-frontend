"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../icon";
import { fetchWritebackLogs, retryWriteback, type WritebackLog } from "@/lib/writeback";
import { sanitizeLiveSnapshot, type LiveLeadSnapshot } from "@/lib/live-dealersocket";

type MonitoringLog = WritebackLog & { action?: string; attempts?: number; simulated?: boolean };

function displayTime(value?: string | null) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" });
}

export function AutomationMonitoring({ notify }: { notify: (message: string) => void }) {
  const [snapshot, setSnapshot] = useState<LiveLeadSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [writebackLogs, setWritebackLogs] = useState<MonitoringLog[]>([]);
  const [writebackError, setWritebackError] = useState("");
  const [writebackLoading, setWritebackLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const mounted = useRef(false);
  const writebackPending = useRef(false);
  const retryPending = useRef(false);

  const loadWriteback = useCallback(async () => {
    if (writebackPending.current) return false;
    writebackPending.current = true;
    try {
      const logs = await fetchWritebackLogs();
      if (!Array.isArray(logs) || logs.some(log => !log || typeof log.id !== "string" ||
          !["pending", "success", "failed"].includes(log.status))) throw new Error("Invalid CRM write-back response.");
      if (mounted.current) { setWritebackLogs(logs); setWritebackError(""); }
      return true;
    } catch (cause) {
      if (mounted.current) setWritebackError(cause instanceof Error ? cause.message : "Could not load CRM write-back logs.");
      return false;
    } finally {
      writebackPending.current = false;
      if (mounted.current) setWritebackLoading(false);
    }
  }, []);

  async function handleRetry(id: string) {
    if (retryPending.current) return;
    retryPending.current = true;
    setRetryingId(id);
    try {
      await retryWriteback(id);
      if (mounted.current) {
        notify("Write-back retry request processed; check the updated status.");
        await loadWriteback();
      }
    } catch (cause) {
      if (mounted.current) notify(cause instanceof Error ? cause.message : "Retry failed.");
    } finally {
      retryPending.current = false;
      if (mounted.current) setRetryingId(null);
    }
  }

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/integrations/dealersocket/leads/status", {
        cache: "no-store", credentials: "same-origin", signal,
      });
      const data = await response.json();
      if (response.status === 401) window.dispatchEvent(new Event("booran:session-refresh"));
      if (!response.ok) throw new Error(data.message || "Could not load connector status.");
      const next = sanitizeLiveSnapshot(data);
      if (!signal?.aborted) { setSnapshot(next); setError(""); }
      return true;
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load connector status.");
      return false;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try { await Promise.all([refresh(controller.signal), loadWriteback()]); } finally { pending = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => { mounted.current = false; controller.abort(); window.clearInterval(timer); };
  }, [refresh, loadWriteback]);

  const label = error ? "Connection unavailable" : !snapshot ? "Checking" :
    snapshot.state === "running" ? "Reading leads" : snapshot.state === "error" ?
      (snapshot.errorCode === "login_required" ? "Login required" : "Read failed") :
      snapshot.snapshotState === "partial" ? "Partial snapshot" : snapshot.snapshotState === "complete" ? "Snapshot available" : "Waiting for first sync";
  const hasSnapshot = snapshot?.snapshotState != null;
  const shown = hasSnapshot ? snapshot!.records.length : null;
  const verified = hasSnapshot ? snapshot!.records.filter(row => row.detailsVerified).length : null;
  const scheduled = snapshot?.schedule.enabled;

  return <div className="page-wrap">
    <div className="section-heading"><div>
      <span className="eyebrow">DEALERSOCKET / READ-ONLY LIVE SYNC</span>
      <h2>Connector monitoring</h2>
      <p>Hourly reads update the live lead snapshot shown in the prospect list.</p>
    </div><button className="btn secondary" disabled={loading} onClick={() => {
      setLoading(true); void Promise.all([refresh(), loadWriteback()]).then(([ok]) => { if (ok && mounted.current) notify("Connector status refreshed"); });
    }}><Icon name="clock" />{loading ? "Refreshing" : "Refresh status"}</button></div>
    <p className="scope-note">This sync reads DealerSocket leads. It does not enrol SMS journeys, import portal conversations or write CRM records.</p>
    {error && <p className="portal-api-error" role="alert">{error} Any snapshot below is the last result received by this screen.</p>}
    {snapshot?.state === "error" && <p className="portal-api-error" role="alert">{snapshot.errorCode === "login_required" ?
      "DealerSocket login is required in the connector browser." : "The latest lead read failed. The previous snapshot, if available, is retained."}</p>}
    {(snapshot?.state === "running" || snapshot?.state === "error") && hasSnapshot &&
      <p className="scope-note">Showing the previous snapshot from {displayTime(snapshot.fetchedAt)} while the latest attempt is {snapshot.state === "running" ? "running" : "unsuccessful"}.</p>}
    <div className="report-stats">{[
      {name:"Connector",value:label,detail:snapshot?.state === "running" ? "A live read is in progress; session checks pause during the read." : "Status from the active snapshot connector"},
      {name:"Visible leads",value:shown === null ? "—" : String(shown),detail:"Records in the last saved snapshot within your access scope"},
      {name:"Details verified",value:verified === null ? "—" : String(verified),detail:"Customer details verified during that snapshot"},
      {name:"Server schedule",value:snapshot ? scheduled ? `Every ${snapshot.schedule.intervalSeconds / 60} minutes` : "Disabled" : "—",detail:scheduled ? `Next attempt: ${displayTime(snapshot.schedule.nextRunAt)}` : "Schedule status from connector configuration"},
    ].map(item => <article className="card" key={item.name}><span>{item.name}</span><b>{item.value}</b><small>{item.detail}</small></article>)}</div>
    <section className="card audit-table"><div className="card-header"><div>
      <h3>Latest DealerSocket snapshot</h3><p>Times shown in Melbourne time. Partial coverage does not mean that every CRM lead was read.</p>
    </div><span className="status-pill">{label}</span></div>
      <div className="table-scroll"><table><thead><tr><th>Latest attempt started</th><th>Snapshot fetched</th><th>Snapshot completed</th><th>Read duration</th><th>Mode</th></tr></thead>
        <tbody><tr><td>{displayTime(snapshot?.startedAt)}</td><td>{displayTime(snapshot?.fetchedAt)}</td><td>{displayTime(snapshot?.completedAt)}</td>
          <td>{snapshot?.durationSeconds == null ? "—" : `${snapshot.durationSeconds.toFixed(1)} seconds`}</td><td>Read-only</td></tr></tbody></table></div>
      {snapshot && hasSnapshot && <div className="empty-state"><span>{snapshot.rooftops.map(roof => `${roof.name}: ${roof.recordCount} visible leads${roof.recordCount === 0 ? " (coverage unverified)" : ""}`).join(" · ")}</span>
        <span>{snapshot.coverageNote} {snapshot.issues.join(" ")}</span></div>}
    </section>

    <section className="card audit-table" style={{ marginTop: "1.5rem" }}>
      <div className="card-header"><div>
        <h3>DealerSocket CRM Write-Back Logs &amp; Exceptions</h3>
        <p>Activity write-back records and retry results. Pending, failed or simulated records do not confirm a successful CRM update.</p>
      </div><span className="status-pill">{writebackError ? "Unavailable" : writebackLoading ? "Loading" : `${writebackLogs.length} records`}</span></div>
      {writebackError && <p className="portal-api-error" role="alert">{writebackError} Any displayed logs are from the last successful refresh.</p>}
      <div className="table-scroll"><table><thead><tr><th>Opportunity ID</th><th>Event type</th><th>Status</th><th>Attempt count</th><th>Action</th></tr></thead>
        <tbody>{writebackLogs.slice(0, 10).map(log => <tr key={log.id}>
          <td><b>{log.opportunityId || log.prospectId || "—"}</b></td>
          <td>{log.action || log.eventType || "—"}</td>
          <td><span className="status-pill">{log.simulated ? "Not configured / simulated" : log.status}</span>{log.lastError && <small>{log.lastError}</small>}</td>
          <td>{log.attempts ?? log.retryCount ?? 0}</td>
          <td>{log.status === "failed" && <button className="btn secondary" disabled={retryingId !== null || log.simulated === true}
            onClick={() => void handleRetry(log.id)}>{retryingId === log.id ? "Retrying…" : "Retry CRM write"}</button>}</td>
        </tr>)}
        {!writebackLogs.length && <tr><td colSpan={5}>{writebackError ? "Logs could not be loaded." : writebackLoading ? "Loading CRM write-back logs…" : "No CRM write-back records returned. This does not confirm that CRM write-back is configured."}</td></tr>}
        </tbody></table></div>
    </section>
  </div>;
}
