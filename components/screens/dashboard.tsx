"use client";

import { useProspects } from "../conversations/prospect-provider";
import type { Role } from "@/lib/types";

import { Icon } from "../icon";
import { useSession } from "../auth/session-provider";

type Props = {
  role: Role;
  navigate: (page: string) => void;
  openConversation: (id: string) => void;
};

export function Dashboard({ navigate, openConversation }: Props) {
  const user = useSession();
  const { prospects: leads, loading, error, refresh } = useProspects();
  const waiting = leads.filter((p) => p.status === "Waiting on us");
  const unassigned = leads.filter(
    (p) => p.owner === "Unassigned" && p.status !== "Opted out",
  );
  const inJourney = leads.filter((p) => p.status === "In journey");
  const unread = leads.reduce((sum, p) => sum + (p.unread ?? 0), 0);
  const stats = [
    {
      label: "WAITING ON US",
      value: waiting.length,
      note: "Customer replies requiring attention",
      icon: "message",
      tone: "red",
    },
    {
      label: "UNREAD INBOUND",
      value: unread,
      note: "Replies in the shared conversation thread",
      icon: "bell",
      tone: "pink",
    },
    {
      label: "UNASSIGNED",
      value: unassigned.length,
      note: "New leads awaiting an owner",
      icon: "userplus",
      tone: "blue",
    },
    {
      label: "IN JOURNEY",
      value: inJourney.length,
      note: "Automated new-lead sequence running",
      icon: "route",
      tone: "amber",
    },
  ];
  return (
    <div className="page-wrap dashboard-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">BOORAN MOTOR GROUP · CRANBOURNE</span>
          <h2>
            New-lead SMS journeys
            <br className="desktop-break" /> and conversation portal
          </h2>
          <p>
            One ordered thread per prospect. Every reply, staff SMS and journey
            event in sequence.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => navigate("conversations")}
        >
          <Icon name="message" />
          Open conversation portal
        </button>
      </div>
      {error && (
        <div className="portal-api-error" role="alert">
          {error}
          <button onClick={refresh}>Retry</button>
        </div>
      )}
      {loading && (
        <div className="scope-note" role="status">
          Loading live prospect data…
        </div>
      )}
      <section className="stat-grid" aria-label="New-lead engagement summary">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.note}</p>
            </div>
            <div className={`stat-icon ${stat.tone}`}>
              <Icon name={stat.icon} />
            </div>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Waiting on us</h3>
              <p>
                Latest customer replies first. Opening a prospect shows the full
                thread.
              </p>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("conversations")}
            >
              View threads
            </button>
          </div>
          {waiting.map((p) => (
            <button
              className="reply-row"
              onClick={() => openConversation(p.id)}
              key={p.id}
            >
              <div className="avatar">{p.initials}</div>
              <div>
                <b>{p.name}</b>
                <span>
                  {p.rooftop} · {p.vehicle}
                </span>
                <p>{p.preview}</p>
              </div>
              <div className="reply-meta">
                <time>{p.lastActivity}</time>
                <span className="status-pill status-waiting-on-us">
                  Waiting on us
                </span>
              </div>
              <Icon name="chevron" size={16} />
            </button>
          ))}
          {!waiting.length && (
            <div className="empty-state">
              <Icon name="check" />
              <b>No customer replies waiting</b>
              <span>New inbound replies will appear here.</span>
            </div>
          )}
          <div className="queue-footer">
            <Icon name="pause" size={15} />
            <span>
              A customer reply pauses the automated journey until a user resumes
              it.
            </span>
          </div>
        </section>
        <aside className="side-stack">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Rooftops in scope</h3>
                <p>Separate dealership and sending identities.</p>
              </div>
            </div>
            {[
              {
                n: "Cranbourne Kia",
                a: "209 South Gippsland Hwy",
                i: "KIA",
                c: "#101c2e",
              },
              {
                n: "Cranbourne MG",
                a: "215 South Gippsland Hwy",
                i: "MG",
                c: "#d91824",
              },
              {
                n: "Geely Cranbourne",
                a: "217A South Gippsland Hwy",
                i: "G",
                c: "#17479e",
              },
            ]
              .filter((r) => user.rooftops.some((roof) => roof === r.n))
              .map((r) => (
                <div className="dashboard-rooftop" key={r.n}>
                  <i style={{ background: r.c }}>{r.i}</i>
                  <div>
                    <b>{r.n}</b>
                    <span>{r.a}</span>
                  </div>
                  <span>
                    {leads.filter((p) => p.rooftop === r.n).length} prospects
                  </span>
                </div>
              ))}
          </section>
          <section className="card connection-card">
            <span>DEALERSOCKET WRITE-BACK</span>
            <h3>Opportunity system of record</h3>
            <p>
              Outbound, inbound and outcomes are written back as timestamped
              activities or work notes.
            </p>
            <div className="integration-status">
              Conversation outcomes and staff SMS are queued for CRM write-back
              by the backend.
            </div>
          </section>
        </aside>
      </div>
      <div className="dashboard-secondary">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Unassigned queue</h3>
              <p>Assign new enquiries to an authorised rooftop user.</p>
            </div>
          </div>
          {unassigned.map((p) => (
            <button
              className="unassigned-row"
              key={p.id}
              onClick={() => openConversation(p.id)}
            >
              <div className="avatar">{p.initials}</div>
              <div>
                <b>{p.name}</b>
                <span>
                  {p.rooftop} · {p.source}
                </span>
              </div>
              <span className="status-pill">{p.step}</span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
          {!unassigned.length && (
            <div className="empty-state">
              <b>All active prospects have an owner</b>
            </div>
          )}
        </section>
        <section className="card operational-rules">
          <div className="card-header">
            <div>
              <h3>Default new-lead journey</h3>
              <p>
                Business hours and quiet hours apply to every automated step.
              </p>
            </div>
          </div>
          <div className="journey-summary">
            {["Ack", "Qualify", "Book", "Nudge", "Close loop"].map(
              (step, i) => (
                <div key={step}>
                  <span>{i + 1}</span>
                  <b>{step}</b>
                </div>
              ),
            )}
          </div>
          <p>
            First message within 60 seconds of a qualifying lead. No automated
            sends before 9:00 or after 20:00 AEST/AEDT, or on closed days.
          </p>
          <div className="queue-footer">
            <Icon name="shield" size={15} />
            <span>
              Reply STOP suppresses the mobile across all three rooftops.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
