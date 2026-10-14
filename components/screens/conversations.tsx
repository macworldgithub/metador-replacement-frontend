"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Role } from "@/lib/types";
import { hasPermission } from "@/lib/permissions";
import {
  conversationRequest,
  mapProspect,
  displayTime,
  outcomes,
  type ApiProspect,
  type ConversationThread,
  type ThreadEvent,
} from "@/lib/conversations";
import { useSession } from "../auth/session-provider";
import { useProspects } from "../conversations/prospect-provider";
import { Icon } from "../icon";

type Props = {
  initialProspectId?: string;
  role: Role;
  notify: (message: string) => void;
};
export function Conversations({ initialProspectId = "", role, notify }: Props) {
  const user = useSession();
  const { prospects, loading, error: listError, refresh } = useProspects();
  const [chosen, setChosen] = useState(initialProspectId);
  const id = chosen || prospects[0]?.id || "";
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [draft, setDraft] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [mobileView, setMobileView] = useState<"list" | "thread" | "details">(
    initialProspectId ? "thread" : "list",
  );
  const [assignment, setAssignment] = useState({ name: "", email: "" });
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const selected =
    thread?.prospect.id === id ? mapProspect(thread.prospect) : null;
  const canSend = hasPermission(role, "sendSms", user);
  const canControl = hasPermission(role, "controlConversationJourney", user);
  const canAssign = hasPermission(role, "reassign", user);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    async function load(initial: boolean) {
      if (initial) {
        setFetching(true);
        setError("");
      }
      try {
        if (initial)
          await conversationRequest<ApiProspect>(`/${encodeURIComponent(id)}`, {
            signal: controller.signal,
          });
        const data = await conversationRequest<ConversationThread>(
          `/${encodeURIComponent(id)}/thread`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setThread(data);
          if (initial) {
            setAssignment({
              name: data.prospect.assignedTo?.name ?? "",
              email: data.prospect.assignedTo?.email ?? "",
            });
            setOutcome(data.prospect.outcome ?? "");
          }
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Could not load thread.",
          );
      } finally {
        if (!controller.signal.aborted && initial) {
          setFetching(false);
          refresh();
        }
      }
    }
    void load(true);
    const timer = window.setInterval(() => {
      if (!document.hidden) void load(false);
    }, 5000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
    // Refresh is an event callback from the shared list; only the selected thread and mutation version trigger reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [thread?.events.length]);
  function select(id: string) {
    if (busy) return;
    setChosen(id);
    setDraft("");
    setNotes("");
    setMobileView("thread");
  }
  async function mutate(action: string, body: Record<string, unknown>) {
    if (busy || !selected) return;
    setBusy(action);
    setError("");
    try {
      const result = await conversationRequest<ThreadEvent | ApiProspect>(
        `/${encodeURIComponent(selected.id)}/${action}`,
        {
          method: ["messages", "notes"].includes(action) ? "POST" : "PATCH",
          body: JSON.stringify(body),
        },
      );
      if (
        action === "messages" &&
        "deliveryStatus" in result &&
        result.deliveryStatus === "failed"
      ) {
        setError(
          result.failureReason ||
            "Carrier send failed. The failed message remains in the thread.",
        );
        notify("SMS failed · review the thread");
      } else
        notify(
          action === "messages"
            ? "metadata" in result && result.metadata?.simulated
              ? "SMS recorded in simulation mode"
              : "SMS accepted by carrier"
            : action === "notes"
              ? "Internal note added"
              : action === "assign"
                ? "Owner updated"
                : action === "outcome"
                  ? "Outcome saved"
                  : "Journey updated",
        );
      if (["messages", "notes"].includes(action)) setDraft("");
      setVersion((v) => v + 1);
      refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to complete your request.",
      );
    } finally {
      setBusy("");
    }
  }
  function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !canSend) return;
    void mutate(noteMode ? "notes" : "messages", {
      content: draft.trim(),
      authorName: user.name,
    });
  }
  const filtered = prospects.filter(
    (p) =>
      (status === "All statuses" || p.status === status) &&
      `${p.name} ${p.mobile} ${p.vehicle}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const isEnded =
    !selected ||
    ["completed", "stopped"].includes(selected.api.journey.status) ||
    selected.status === "Closed";
  const optedOut = selected?.status === "Opted out";
  const unicode = /[^\u0000-\u007F]/.test(draft);
  const segments = draft.length
    ? draft.length <= (unicode ? 70 : 160)
      ? 1
      : Math.ceil(draft.length / (unicode ? 67 : 153))
    : 0;
  return (
    <div className={`conversation-layout mobile-${mobileView}`}>
      <section className="inbox-panel">
        <div className="panel-title">
          <div>
            <h2>Prospect list</h2>
            <span>{prospects.length} conversations</span>
          </div>
          <button
            className="icon-button"
            aria-label="Refresh prospects"
            onClick={refresh}
          >
            <Icon name="clock" />
          </button>
        </div>
        <div className="inbox-tools">
          <label className="search-field">
            <Icon name="search" />
            <input
              aria-label="Search inbox"
              placeholder="Search name or vehicle"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Inbox status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All statuses</option>
            {[
              "New",
              "In journey",
              "Waiting on us",
              "Waiting on customer",
              "Opted out",
              "Closed",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {listError && (
          <div className="portal-api-error" role="alert">
            {listError}
            <button onClick={refresh}>Retry</button>
          </div>
        )}
        <div className="inbox-list">
          {filtered.map((p) => (
            <button
              data-prospect-id={p.id}
              key={p.id}
              disabled={!!busy}
              className={p.id === id ? "selected" : ""}
              onClick={() => select(p.id)}
            >
              <div className="avatar">{p.initials}</div>
              <div className="inbox-copy">
                <div>
                  <b>{p.name}</b>
                </div>
                <strong>{p.rooftop}</strong>
                <p>{p.preview}</p>
                <div>
                  <span
                    className={`status-dot status-${p.status.toLowerCase().replaceAll(" ", "-")}`}
                  />
                  {p.status}
                </div>
                <small>{p.lastActivity}</small>
              </div>
              {!!p.unread && <em>{p.unread}</em>}
            </button>
          ))}
          {loading && (
            <div className="empty-state" role="status">
              Loading prospects…
            </div>
          )}
          {!loading && !filtered.length && (
            <div className="empty-state">
              <Icon name="message" />
              <b>No matching conversations</b>
            </div>
          )}
        </div>
      </section>
      <section className="thread-panel">
        {error && (
          <div className="portal-api-error" role="alert">
            {error}
            <button disabled={!!busy} onClick={() => setVersion((v) => v + 1)}>
              Reload thread
            </button>
          </div>
        )}
        {fetching ? (
          <div className="empty-state" role="status">
            Loading conversation…
          </div>
        ) : !selected ? (
          <div className="empty-state">
            <Icon name="message" />
            <b>Select a prospect</b>
            <span>Open a customer’s complete chronological thread.</span>
          </div>
        ) : (
          <>
            <header className="thread-header">
              <button
                className="mobile-back"
                aria-label="Back to inbox"
                onClick={() => setMobileView("list")}
              >
                ‹
              </button>
              <div className="avatar">{selected.initials}</div>
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {selected.mobile} · {selected.vehicle}
                </p>
              </div>
              <span className="rooftop-pill">{selected.rooftop}</span>
              <button
                className="icon-button detail-toggle"
                aria-label="Prospect details"
                onClick={() => setMobileView("details")}
              >
                <Icon name="more" />
              </button>
            </header>
            <div className="journey-bar">
              <div>
                <span
                  className={`live-status ${selected.api.journey.status === "paused" ? "paused" : ""}`}
                >
                  JOURNEY {selected.api.journey.status.toUpperCase()}
                </span>
                <p>
                  {selected.api.journey.pausedReason ||
                    selected.api.journey.currentStepName}
                </p>
              </div>
              <button
                disabled={!canControl || !!busy || isEnded || optedOut}
                onClick={() => {
                  void mutate("journey", {
                    action:
                      selected.api.journey.status === "paused"
                        ? "resume"
                        : "pause",
                    reason: `Portal control by ${user.name}`,
                  });
                }}
              >
                <Icon
                  name={
                    selected.api.journey.status === "paused" ? "play" : "pause"
                  }
                  size={15}
                />
                {selected.api.journey.status === "paused" ? "Resume" : "Pause"}
              </button>
            </div>
            <div className="messages">
              {thread?.events.map((event) =>
                event.type === "system" ? (
                  <div className="system-event" key={event.id}>
                    <Icon name="clock" size={13} />
                    {event.content}
                    <time>{displayTime(event.timestamp)}</time>
                  </div>
                ) : event.type === "internal_note" ? (
                  <div className="internal-note" key={event.id}>
                    <div>
                      <Icon name="note" size={15} />
                      <b>Internal note</b>
                      <span>Team only</span>
                    </div>
                    <p>{event.content}</p>
                    <small>
                      {event.authorName} · {displayTime(event.timestamp)}
                    </small>
                  </div>
                ) : (
                  <div
                    className={`message-row ${event.direction === "inbound" ? "inbound" : "outbound"}`}
                    key={event.id}
                  >
                    <div className="bubble">
                      <div>
                        {event.journeyStepName && (
                          <span>{event.journeyStepName}</span>
                        )}
                        <b>
                          {event.authorName ||
                            (event.direction === "inbound"
                              ? selected.name
                              : "Automation")}
                        </b>
                      </div>
                      <p>{event.content}</p>
                      {event.mediaUrls
                        ?.filter((url) => /^https?:\/\//i.test(url))
                        .map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View attachment {i + 1}
                          </a>
                        ))}
                      <small>
                        {displayTime(event.timestamp)}
                        {event.deliveryStatus &&
                          ` · ${event.metadata?.simulated ? "Simulated" : event.deliveryStatus}`}
                      </small>
                      {event.deliveryStatus === "failed" && (
                        <div className="failed-send">
                          <p>
                            {event.failureReason || "Carrier delivery failed"}
                          </p>
                          <button
                            disabled={!canSend || !!busy || optedOut}
                            onClick={() => {
                              void mutate("messages", {
                                content: event.content,
                                authorName: user.name,
                              });
                            }}
                          >
                            Retry SMS
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
              {!thread?.events.length && (
                <div className="empty-state">No conversation events yet.</div>
              )}
              <div ref={end} />
            </div>
            <form
              className={`composer ${noteMode ? "note-composer" : ""}`}
              onSubmit={send}
            >
              {optedOut && (
                <div className="send-blocked">
                  <Icon name="shield" />
                  SMS blocked: this prospect opted out. Internal notes are still
                  available.
                </div>
              )}
              <p className="sender-identity">
                {canSend
                  ? noteMode
                    ? "Internal note · never sent to the customer"
                    : `Sending as ${selected.rooftop}. The backend adds identification, contact details and reply STOP.`
                  : "Read-only conversation access"}
              </p>
              <div className="composer-tabs">
                <button
                  type="button"
                  className={!noteMode ? "active" : ""}
                  onClick={() => setNoteMode(false)}
                >
                  SMS reply
                </button>
                <button
                  type="button"
                  className={noteMode ? "active" : ""}
                  onClick={() => setNoteMode(true)}
                >
                  Internal note
                </button>
              </div>
              <textarea
                aria-label={noteMode ? "Internal note" : "SMS message"}
                disabled={!canSend || !!busy}
                maxLength={noteMode ? 10000 : 1600}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  noteMode
                    ? "Add a note for your team…"
                    : `Message ${selected.name.split(" ")[0]}…`
                }
              />
              <div className="composer-footer">
                <div>
                  <span>
                    {draft.length} characters · {segments} segments (before
                    compliance footer)
                  </span>
                </div>
                <button
                  className="send-button"
                  disabled={
                    !canSend ||
                    !!busy ||
                    !draft.trim() ||
                    (!noteMode && optedOut)
                  }
                >
                  {busy === "messages" || busy === "notes"
                    ? "Saving…"
                    : noteMode
                      ? "Add note"
                      : "Send SMS"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
      <aside className="detail-panel">
        <div className="detail-heading">
          <button
            className="mobile-back"
            aria-label="Back to thread"
            onClick={() => setMobileView("thread")}
          >
            ‹
          </button>
          <h3>Opportunity details</h3>
        </div>
        {selected && (
          <>
            <div className="profile-card">
              <div className="large-avatar">{selected.initials}</div>
              <b>{selected.name}</b>
              <span>{selected.mobile}</span>
            </div>
            <section className="detail-section">
              <h4>DealerSocket opportunity</h4>
              <Detail label="Opportunity ID" value={selected.crmId} />
              <Detail label="Vehicle" value={selected.vehicle} />
              <Detail label="Source" value={selected.source} />
              <Detail
                label="Landed"
                value={displayTime(selected.api.createdAt)}
              />
              <Detail label="Status" value={selected.status} />
            </section>
            <section className="detail-section">
              <h4>Assignment</h4>
              <form
                className="portal-detail-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!assignment.name.trim()) {
                    setError("Enter a salesperson name.");
                    return;
                  }
                  void mutate("assign", {
                    salespersonName: assignment.name.trim(),
                    ...(assignment.email.trim()
                      ? { salespersonEmail: assignment.email.trim() }
                      : {}),
                  });
                }}
              >
                <label>
                  Salesperson name
                  <input
                    required
                    value={assignment.name}
                    disabled={!canAssign || !!busy}
                    onChange={(e) =>
                      setAssignment((a) => ({ ...a, name: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Email (optional)
                  <input
                    type="email"
                    value={assignment.email}
                    disabled={!canAssign || !!busy}
                    onChange={(e) =>
                      setAssignment((a) => ({ ...a, email: e.target.value }))
                    }
                  />
                </label>
                <button disabled={!canAssign || !!busy} type="submit">
                  Save assignment
                </button>
              </form>
            </section>
            <section className="detail-section">
              <h4>Outcome</h4>
              <form
                className="portal-detail-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!outcome) return;
                  void mutate("outcome", {
                    outcome,
                    ...(notes.trim() ? { notes: notes.trim() } : {}),
                  });
                }}
              >
                <select
                  aria-label="Outcome"
                  disabled={!canSend || !!busy || optedOut}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="">Select outcome</option>
                  {outcomes.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <textarea
                  aria-label="Outcome notes"
                  placeholder="Outcome notes (optional)"
                  disabled={!canSend || !!busy || optedOut}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!outcome || !canSend || !!busy || optedOut}
                >
                  Save outcome
                </button>
              </form>
            </section>
            <section className="detail-section">
              <h4>Journey controls</h4>
              <Detail label="Current step" value={selected.step} />
              {selected.api.journey.nextScheduledStepAt && (
                <Detail
                  label="Next scheduled"
                  value={displayTime(selected.api.journey.nextScheduledStepAt)}
                />
              )}
              <div className="thread-journey-controls">
                <button
                  disabled={
                    !canControl ||
                    !!busy ||
                    isEnded ||
                    optedOut ||
                    selected.api.journey.currentStep >= 5
                  }
                  onClick={() => {
                    void mutate("journey", {
                      action: "skip_step",
                      reason: `Skipped by ${user.name}`,
                    });
                  }}
                >
                  Skip current step
                </button>
                <button
                  disabled={!canControl || !!busy || isEnded}
                  onClick={() => {
                    void mutate("journey", {
                      action: "stop",
                      reason: `Stopped by ${user.name}`,
                    });
                  }}
                >
                  Stop journey
                </button>
              </div>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
