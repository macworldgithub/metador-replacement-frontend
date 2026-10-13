"use client";

import { useState } from "react";
import { Icon } from "../icon";

const executions = [
  { id: "EX-001", rooftop: "Cranbourne Kia", opportunity: "DS-847291", trigger: "Qualifying new lead", result: "Ack delivered", status: "Completed", time: "9:59:38 am" },
  { id: "EX-002", rooftop: "Cranbourne Kia", opportunity: "DS-847291", trigger: "Staff SMS", result: "Journey paused · human takeover", status: "Paused", time: "10:04 am" },
  { id: "EX-003", rooftop: "Cranbourne Kia", opportunity: "DS-847291", trigger: "Customer reply", result: "Inbound appended to existing thread", status: "Paused", time: "10:06 am" },
  { id: "EX-004", rooftop: "Cranbourne MG", opportunity: "DS-847288", trigger: "No reply · +4 business hours", result: "Qualify step queued within send hours", status: "Queued", time: "10:10 am" },
  { id: "EX-005", rooftop: "Geely Cranbourne", opportunity: "DS-847044", trigger: "STOP keyword", result: "Mobile suppressed across all rooftops", status: "Stopped", time: "Yesterday, 2:14 pm" },
];

export function AutomationMonitoring({ notify }: { notify: (message: string) => void }) {
  const [status, setStatus] = useState("All statuses");
  const [rooftop, setRooftop] = useState("All rooftops");
  const filtered = executions.filter((e) => (status === "All statuses" || status === e.status) && (rooftop === "All rooftops" || rooftop === e.rooftop));
  return <div className="page-wrap"><div className="section-heading"><div><span className="eyebrow">AUTOMATION / SYSTEM ADMINISTRATION</span><h2>Triggers and execution history</h2><p>Review message schedules, handoffs and stop rules for new-lead journeys.</p></div><button className="btn secondary" onClick={() => notify("Preview execution history refreshed")}><Icon name="clock" />Refresh</button></div>
    <p className="scope-note">Preview execution records. Live trigger, carrier and CRM failure monitoring will use the connected backend.</p>
    <div className="report-stats">{[{ name: "First-message target", value: "60s", detail: "Qualifying lead · within send hours" }, { name: "Quiet hours", value: "20:00–09:00", detail: "Australia/Melbourne · closed days apply" }, { name: "Duplicate window", value: "14 days", detail: "Same mobile and rooftop" }, { name: "Write-back exceptions", value: "0", detail: "No failed writes in preview records" }].map((s) => <article className="card" key={s.name}><span>{s.name}</span><b>{s.value}</b><small>{s.detail}</small></article>)}</div>
    <div className="filter-bar card"><select aria-label="Execution rooftop" value={rooftop} onChange={(e) => setRooftop(e.target.value)}><option>All rooftops</option><option>Cranbourne Kia</option><option>Cranbourne MG</option><option>Geely Cranbourne</option></select><select aria-label="Execution status" value={status} onChange={(e) => setStatus(e.target.value)}><option>All statuses</option><option>Completed</option><option>Queued</option><option>Paused</option><option>Stopped</option><option>Failed</option></select><span className="filter-count">{filtered.length} events</span></div>
    <section className="card audit-table"><div className="card-header"><div><h3>Execution history</h3><p>Diagnostic journey events linked to DealerSocket opportunities.</p></div></div><div className="table-scroll"><table><thead><tr><th>Rooftop</th><th>Opportunity</th><th>Trigger</th><th>Result</th><th>Status</th><th>Time</th></tr></thead><tbody>{filtered.map((e) => <tr key={e.id}><td>{e.rooftop}</td><td>{e.opportunity}</td><td>{e.trigger}</td><td>{e.result}</td><td><span className="status-pill">{e.status}</span></td><td>{e.time}</td></tr>)}</tbody></table></div>{!filtered.length && <div className="empty-state"><Icon name="check" /><b>No matching execution events</b><span>Adjust the rooftop or status filter.</span></div>}</section>
    <section className="card role-permissions-card"><div className="card-header"><div><h3>Pause and stop conditions</h3><p>Applied to every new-lead journey.</p></div></div>{["Customer replies and staff sends pause the journey.", "STOP, STOPALL, UNSUBSCRIBE, CANCEL, END and QUIT suppress the mobile immediately.", "Appointment, not interested, already bought and wrong number end the journey.", "Closed opportunity status and relevant CRM updates stop subsequent journey steps.", "Write-back failures retry and flag the thread without blocking SMS."].map((rule) => <div className="rule" key={rule}><span><Icon name="check" size={13} /></span>{rule}</div>)}</section>
  </div>;
}
