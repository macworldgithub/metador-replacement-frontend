"use client";

import { FormEvent, useState } from "react";
import { initialMessages, prospects } from "@/lib/mock-data";
import type { Message, Role } from "@/lib/types";
import { canViewProspect, hasPermission, roleProfiles } from "@/lib/permissions";
import { Icon } from "../icon";

type Props = { initialProspectId?: string; role: Role; notify: (message: string) => void };

export function Conversations({ initialProspectId = "p1", role, notify }: Props) {
  const [selectedId, setSelectedId] = useState(initialProspectId);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All active");
  const [messages, setMessages] = useState<Record<string, Message[]>>(initialMessages);
  const [draft, setDraft] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [paused, setPaused] = useState(true);
  const [closed, setClosed] = useState(false);
  const [outcome, setOutcome] = useState("No outcome");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "thread" | "details">("list");
  const authorised = prospects.filter((p) => canViewProspect(role, p));
  const canSend = hasPermission(role, "sendSms");
  const canControlJourney = hasPermission(role, "controlConversationJourney");
  const selected = authorised.find((p) => p.id === selectedId) ?? authorised[0];
  const filtered = authorised.filter((p) => (status === "All active" || p.status === status) && `${p.name} ${p.mobile} ${p.vehicle}`.toLowerCase().includes(query.toLowerCase()));
  const thread = messages[selected.id] ?? [{ id: "system-default", kind: "system" as const, body: "Lead imported from DealerSocket. Conversation history begins here.", time: selected.time }];
  const smsBody = noteMode ? draft : `${draft}\n\n${selected.rooftop} · 03 5991 5500 · Reply STOP to opt out.`;
  const segments = draft.length ? (smsBody.length <= 70 ? 1 : Math.ceil(smsBody.length / 67)) : 0;

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (!canSend || !draft.trim() || sending) return;
    if (!noteMode && selected.status === "Opted out") { notify("Sending is blocked: this mobile is suppressed"); return; }
    setSending(true);
    const text = draft.trim();
    const body = noteMode ? text : `${text}\n\n${selected.rooftop} · 03 5991 5500 · Reply STOP to opt out.`;
    const id = `local-${Date.now()}`;
    const newMessage: Message = { id, kind: noteMode ? "note" : "outbound", sender: roleProfiles[role].name, body, time: "Just now", state: noteMode ? undefined : "Sending" };
    setMessages((current) => ({ ...current, [selected.id]: [...(current[selected.id] ?? thread), newMessage] }));
    setDraft("");
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setMessages((current) => ({ ...current, [selected.id]: current[selected.id].map((message) => message.id === id ? { ...message, state: noteMode ? undefined : "Delivered" } : message) }));
    setSending(false);
    if (!noteMode) setPaused(true);
    notify(noteMode ? "Internal note added" : "SMS added to the preview thread");
  }

  function selectProspect(id: string) { setSelectedId(id); setDraft(""); setPaused(true); setClosed(false); setOutcome("No outcome"); setMobileView("thread"); }

  return <div className={`conversation-layout mobile-${mobileView}`}>
    <section className="inbox-panel">
      <div className="panel-title"><div><h2>Prospect list</h2><span>{filtered.length} conversations</span></div><button className="icon-button" onClick={() => notify("Filters are ready below")}><Icon name="filter" /></button></div>
      <div className="inbox-tools"><label className="search-field"><Icon name="search" size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or vehicle" /></label><select value={status} onChange={(e) => setStatus(e.target.value)}><option>All active</option><option>Waiting on us</option><option>In journey</option><option>Waiting on customer</option><option>Opted out</option><option>Closed</option></select></div>
      <div className="inbox-list">{filtered.length ? filtered.map((prospect) => <button key={prospect.id} onClick={() => selectProspect(prospect.id)} className={selected.id === prospect.id ? "selected" : ""}>
        <div className={`avatar brand-${prospect.rooftop.includes("Kia") ? "kia" : prospect.rooftop.includes("MG") ? "mg" : "geely"}`}>{prospect.initials}</div>
        <div className="inbox-copy"><div><b>{prospect.name}</b><time>{prospect.lastActivity}</time></div><strong>{prospect.rooftop}</strong><p>{prospect.preview}</p><div><span className={`status-dot status-${prospect.status.toLowerCase().replaceAll(" ", "-")}`} />{prospect.status}</div></div>
        {!!prospect.unread && <em>{prospect.unread}</em>}
      </button>) : <div className="empty-state"><Icon name="search" /><b>No conversations found</b><span>Try a different search or status.</span></div>}</div>
    </section>

    <section className="thread-panel">
      <header className="thread-header"><button className="mobile-back" onClick={() => setMobileView("list")} aria-label="Back to inbox">‹</button><div className={`avatar brand-${selected.rooftop.includes("Kia") ? "kia" : selected.rooftop.includes("MG") ? "mg" : "geely"}`}>{selected.initials}</div><div><h2>{selected.name}</h2><p>{selected.mobile} · {selected.vehicle}</p></div><span className="rooftop-pill">{selected.rooftop}</span><button className="icon-button detail-toggle" onClick={() => setMobileView("details")}><Icon name="more" /></button></header>
      <div className="journey-bar"><div><span className={`live-status ${paused ? "paused" : ""}`}><i />{selected.status === "Opted out" ? "JOURNEY STOPPED · OPTED OUT" : closed ? "JOURNEY CLOSED" : paused ? "JOURNEY PAUSED" : "JOURNEY ACTIVE"}</span><p>{paused ? "Customer replied · human follow-up required" : "Next step: Book · tomorrow at 9:00 am"}</p></div><button disabled={!canControlJourney || closed || selected.status === "Opted out"} onClick={() => { setPaused(!paused); notify(paused ? "Journey resumed" : "Journey paused"); }}><Icon name={paused ? "play" : "pause"} size={15} />{paused ? "Resume" : "Pause"}</button></div>
      <div className="messages"><div className="day-divider"><span>Today</span></div>{thread.map((message) => {
        if (message.kind === "system") return <div className="system-event" key={message.id}><span><Icon name="clock" size={13} /></span>{message.body}<time>{message.time}</time></div>;
        if (message.kind === "note") return <div className="internal-note" key={message.id}><div><Icon name="note" size={15} /><b>Internal note</b><span>Only your team can see this</span></div><p>{message.body}</p><small>{message.sender} · {message.time}</small></div>;
        return <div className={`message-row ${message.kind}`} key={message.id}><div className="bubble"><div>{message.label && <span>{message.label}</span>}<b>{message.sender}</b></div><p>{message.body}</p><small>{message.time}{message.state && <> · {message.state}</>}</small></div></div>;
      })}</div>
      <form className={`composer ${noteMode ? "note-composer" : ""}`} onSubmit={submitMessage}>
        {selected.status === "Opted out" && <div className="send-blocked"><Icon name="shield" />This number is suppressed. Staff and automated SMS are blocked.</div>}
        {!canSend && <div className="send-blocked"><Icon name="shield" />Read-only customer communication · automation monitoring access</div>}
        <p className="sender-identity">{noteMode ? "Internal note · never sent to the customer" : `Sending as ${selected.rooftop} · Identification, contact path and reply STOP are included.`}</p>
        <div className="composer-tabs"><button type="button" className={!noteMode ? "active" : ""} onClick={() => setNoteMode(false)}><Icon name="message" size={15} />SMS reply</button><button type="button" className={noteMode ? "active" : ""} onClick={() => setNoteMode(true)}><Icon name="note" size={15} />Internal note</button></div>
        <textarea disabled={!canSend} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={640} placeholder={noteMode ? "Add a note for your team…" : `Message ${selected.name.split(" ")[0]}…`} />
        <div className="composer-footer"><div><button type="button" onClick={() => setDraft(`Hi ${selected.name.split(" ")[0]}, thanks for getting back to us. I can help with that.`)}>Templates</button><span>{noteMode ? draft.length : smsBody.length} characters · {segments} segment{segments === 1 ? "" : "s"}</span></div><button type="submit" className="send-button" disabled={!canSend || !draft.trim() || sending || (!noteMode && selected.status === "Opted out")}>{sending ? <span className="spinner" /> : <Icon name="send" size={16} />}{sending ? "Sending" : noteMode ? "Add note" : "Send SMS"}</button></div>
      </form>
    </section>

    <aside className="detail-panel"><div className="detail-heading"><button className="mobile-back" onClick={() => setMobileView("thread")}>‹</button><h3>Opportunity details</h3><button className="icon-button"><Icon name="more" /></button></div>
      <div className="profile-card"><div className="large-avatar">{selected.initials}</div><b>{selected.name}</b><span>{selected.mobile}</span><span className="profile-system">DealerSocket opportunity · {selected.crmId}</span></div>
      <DetailSection title="DealerSocket opportunity"><Detail label="Vehicle of interest" value={selected.vehicle} /><Detail label="Lead source" value={selected.source} /><Detail label="Landed" value="Today, 9:59 am" /><Detail label="Opportunity ID" value={selected.crmId} /></DetailSection>
      <DetailSection title="Ownership"><label className="field-label">Assigned to<select key={selected.id} disabled={!hasPermission(role, "reassign")} defaultValue={selected.owner} onChange={() => notify("Owner updated and queued for CRM write-back")}><option>{selected.owner}</option><option>Mia Harris</option><option>Daniel Lee</option><option>Liam Chen</option><option>Unassigned</option></select></label><label className="field-label">Outcome<select disabled={!canSend} value={outcome} onChange={(e) => { setOutcome(e.target.value); if (e.target.value !== "No outcome") { setClosed(true); setPaused(true); } notify(`Outcome set: ${e.target.value}`); }}><option>No outcome</option><option>Appointment requested</option><option>Not interested</option><option>Already bought</option><option>Wrong number</option><option>Handed to salesperson</option></select></label></DetailSection>
      <DetailSection title="Journey"><Detail label="Sequence" value="New vehicle internet · v3" /><Detail label="Current step" value={selected.step} /><div className="thread-journey-controls"><select aria-label="Skip to journey step" disabled={!canControlJourney || closed || selected.status === "Opted out"} onChange={(e) => { if (e.target.value) { setPaused(true); notify(`Journey moved to ${e.target.value} in the preview`); } }} defaultValue=""><option value="" disabled>Skip to a later step</option><option>Qualify</option><option>Book</option><option>Nudge</option><option>Close loop</option></select><button disabled={!canControlJourney || closed} onClick={() => { setClosed(true); setPaused(true); notify("Journey closed in the preview"); }}>Close journey</button></div><div className="writeback-ok"><Icon name="clock" size={14} />CRM write-back · preview only</div></DetailSection>
      {!canSend && <div className="permission-note">Automation monitoring access: review threads and journey events. Customer SMS, internal notes and outcomes are handled by authorised staff.</div>}
    </aside>
  </div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="detail-section"><h4>{title}</h4>{children}</section>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><b>{value}</b></div>; }
