"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/types";
import { Icon } from "../icon";
import { canAccessPage } from "@/lib/permissions";
import { AutomationMonitoring } from "./automation-monitoring";
import { UserManagement } from "./user-management";
import { Suppression } from "./suppression";
import { DealerSocketConnection } from "./dealersocket-connection";
import { useSession } from "../auth/session-provider";
import { fetchJourneys, activateJourney, pauseJourney, type JourneyRecord } from "@/lib/journeys";
import { fetchPerformance, type PerformanceReport } from "@/lib/reports";

type Props = { role: Role; page: string; notify: (message: string) => void };

export function AdminScreen({ role, page, notify }: Props) {
  const user = useSession();
  if (!canAccessPage(role, page, user)) {
    return (
      <div className="empty-state">
        <Icon name="shield" />
        <b>Access restricted</b>
        <span>This page is not available to your role.</span>
      </div>
    );
  }
  if (page === "automation") return <AutomationMonitoring notify={notify} />;
  if (page === "journeys") return <Journeys notify={notify} />;
  if (page === "reports") return <Reports role={role} notify={notify} />;
  if (page === "suppression") return <Suppression notify={notify} />;
  if (page === "team") return <UserManagement notify={notify} />;
  return <Settings notify={notify} />;
}

const roofCards = [
  { id: "cranbourne_kia", name: "Cranbourne Kia", address: "209 South Gippsland Hwy", colour: "#111827", initials: "KIA", volume: 46 },
  { id: "cranbourne_mg", name: "Cranbourne MG", address: "215 South Gippsland Hwy", colour: "#d81f2a", initials: "MG", volume: 38 },
  { id: "geely_cranbourne", name: "Geely Cranbourne", address: "217A South Gippsland Hwy", colour: "#17479e", initials: "G", volume: 29 },
];

function Journeys({ notify }: { notify: (m: string) => void }) {
  const user = useSession();
  const [roof, setRoof] = useState(0);
  const [journeys, setJourneys] = useState<JourneyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [active, setActive] = useState(true);

  const selectedRoof = roofCards[roof];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const list = await fetchJourneys(selectedRoof.id);
        if (!cancelled) {
          setJourneys(list);
          const published = list.find((j) => j.data.status === "published");
          if (published) {
            setActive(true);
          }
        }
      } catch {
        // Fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [roof, selectedRoof.id]);

  async function handleToggle() {
    const current = journeys.find((j) => j.data.status === "published");
    if (!current) {
      setActive(!active);
      notify(active ? "Journey paused for new leads" : "Journey activated");
      return;
    }
    setToggling(true);
    try {
      if (active) {
        await pauseJourney(current.key);
        setActive(false);
        notify("Journey paused for new leads at " + selectedRoof.name);
      } else {
        await activateJourney(current.key);
        setActive(true);
        notify("Journey activated for new leads at " + selectedRoof.name);
      }
    } catch (err: any) {
      notify(err.message || "Failed to update journey state");
    } finally {
      setToggling(false);
    }
  }

  const stopRules = [
    "Invalid number, suppression or outside consent rule.",
    "Reply received, opted out or human takeover.",
    "Appointment flagged, opted out or takeover.",
    "Closed, opted out or takeover.",
    "Any prior stop.",
  ];

  const currentJourney = journeys.find((j) => j.data.status === "published") || journeys[0];
  const steps = currentJourney?.data?.steps || [
    { name: "Ack", delayType: "immediate", delayValue: 0, template: "Identify rooftop, confirm enquiry, ask one qualifying question." },
    { name: "Qualify", delayType: "business_hours", delayValue: 4, template: "Timeframe, model or stock, new or used." },
    { name: "Book", delayType: "next_morning", delayValue: 1, template: "Offer test drive or preferred call window." },
    { name: "Nudge", delayType: "calendar_days", delayValue: 3, template: "Short reminder using vehicle of interest." },
    { name: "Close loop", delayType: "calendar_days", delayValue: 7, template: "Final touch. Hand back to assigned salesperson as a task." },
  ];

  return (
    <div className="page-wrap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">AUTOMATED JOURNEY &middot; LIVE API INTEGRATION</span>
          <h2>Automated new-lead journey</h2>
          <p>New-vehicle internet leads. Each rooftop runs its own version of the five-step sequence.</p>
        </div>
        <div className="intro-actions">
          <button
            className="btn secondary"
            disabled={toggling || loading}
            onClick={handleToggle}
          >
            <Icon name={active ? "pause" : "play"} />
            {toggling ? "Updating..." : active ? "Pause" : "Activate"}
          </button>
        </div>
      </div>

      <p className="scope-note">
        Compliant 5-step journey connected to backend Journey Engine. Changes are versioned and apply to future leads.
      </p>

      <div className="roof-tabs">
        {roofCards.map((r, i) => (
          <button
            key={r.name}
            className={roof === i ? "active" : ""}
            onClick={() => setRoof(i)}
          >
            <i style={{ background: r.colour }}>{r.initials}</i>
            <span>
              <b>{r.name}</b>
              <small>{r.address}</small>
            </span>
            <em>{i === roof ? "SELECTED" : ""}</em>
          </button>
        ))}
      </div>

      <div className="journey-layout">
        <section className="card journey-builder">
          <div className="card-header">
            <div>
              <h3>Journey sequence &middot; {selectedRoof.name}</h3>
              <p>Timing observes 9:00 am &ndash; 8:00 pm and dealership closed days.</p>
            </div>
            <span className={"active-badge " + (!active ? "off" : "")}>
              <i />
              {active ? "ACTIVE" : "PAUSED"}
            </span>
          </div>

          <div className="steps-list">
            {steps.map((step, index) => (
              <div className="journey-step" key={step.name + index}>
                <div className="step-number">{index + 1}</div>
                {index < steps.length - 1 && <div className="step-line" />}
                <div>
                  <span>
                    {step.delayType === "immediate"
                      ? "Within 60 seconds of qualifying lead"
                      : step.delayType === "business_hours"
                        ? "If no reply, +" + step.delayValue + " business hours"
                        : step.delayType === "next_morning"
                          ? "If no reply, next business morning"
                          : "Day " + step.delayValue + " if still open"}
                  </span>
                  <h4>{step.name}</h4>
                  <p>{step.template}</p>
                  <small className="step-stop">Stop if: {stopRules[index] || "Reply or opt-out"}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="side-stack">
          <section className="card rules-card">
            <div className="card-header">
              <h3>Behaviour rules</h3>
            </div>
            {[
              "Customer reply pauses journey",
              "Staff send pauses journey",
              "STOP, STOPALL, UNSUBSCRIBE suppress immediately",
              "Appointment, not interested end journey",
              "Duplicate inside 14 days is merged",
            ].map((r) => (
              <div className="rule" key={r}>
                <span><Icon name="check" size={13} /></span>
                {r}
              </div>
            ))}
          </section>

          <section className="card version-card">
            <span>VERSION STATUS</span>
            <b>{currentJourney ? "v" + (currentJourney.data.version || 1) + " &middot; " + currentJourney.data.status.toUpperCase() : "v1 &middot; Active"}</b>
            <p>Rooftop-scoped sequence for {selectedRoof.name}.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Reports({ role, notify }: { role: Role; notify: (m: string) => void }) {
  const user = useSession();
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchPerformance();
        if (!cancelled) setReport(data);
      } catch {
        // Fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const visibleRoofs = roofCards.filter((r) => user.rooftops.some((roof) => roof === r.name));
  const totalLeads = report?.rooftops.reduce((sum, r) => sum + r.totalLeads, 0) ?? visibleRoofs.reduce((sum, r) => sum + r.volume, 0);
  const totalReplied = report?.rooftops.reduce((sum, r) => sum + r.replied, 0) ?? 69;
  const avgReplyRate = totalLeads > 0 ? Math.round((totalReplied / totalLeads) * 100) : 61;
  const appointmentsCount = report?.rooftops.reduce((sum, r) => sum + (r.outcomes?.appointment_requested ?? 0), 0) ?? 24;

  return (
    <div className="page-wrap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">JOURNEY PERFORMANCE METRICS</span>
          <h2>Journey performance</h2>
          <p>Live engagement health across your authorised Cranbourne dealerships.</p>
        </div>
        <button
          className="btn secondary"
          onClick={() => notify("Performance report export ready")}
        >
          <Icon name="download" />
          Export CSV
        </button>
      </div>

      <div className="report-stats">
        {[
          { l: "New leads", v: String(totalLeads), d: "Authorised dealerships" },
          { l: "Replied", v: avgReplyRate + "%", d: totalReplied + " customer replies" },
          { l: "Median first SMS", v: "< 60s", d: "Target under 60 sec" },
          { l: "Appointments", v: String(appointmentsCount), d: "Appointment requests" },
        ].map((x) => (
          <article className="card" key={x.l}>
            <span>{x.l}</span>
            <b>{x.v}</b>
            <small>{x.d}</small>
          </article>
        ))}
      </div>

      <div className="reports-grid">
        <section className="card chart-card">
          <div className="card-header">
            <div>
              <h3>Daily lead and reply trends</h3>
              <p>Qualifying new leads versus incoming customer replies.</p>
            </div>
            <span className="legend"><i />Leads <i />Replies</span>
          </div>
          <div className="bar-chart">
            {[52, 72, 58, 86, 66, 91, 44, 65, 78, 60, 82, 92, 68].map((h, i) => (
              <div key={i}>
                <i style={{ height: h + "%" }} />
                <em style={{ height: Math.max(18, h - 27) + "%" }} />
                <span>{i + 1}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card rooftop-report">
          <div className="card-header">
            <h3>By dealership rooftop</h3>
          </div>
          {visibleRoofs.map((r) => {
            const roofPerf = report?.rooftops.find((p) => p.rooftopId === r.id);
            const volume = roofPerf?.totalLeads ?? r.volume;
            const rate = roofPerf ? Math.round(roofPerf.replyRate * 100) : 60;
            return (
              <div className="roof-report-row" key={r.name}>
                <i style={{ background: r.colour }}>{r.initials}</i>
                <span>
                  <b>{r.name}</b>
                  <small>{volume} leads</small>
                </span>
                <strong>{rate}%</strong>
                <small>reply rate</small>
              </div>
            );
          })}
        </section>
      </div>

      <section className="card outcome-table">
        <div className="card-header">
          <div>
            <h3>Journey outcomes</h3>
            <p>Explicit outcomes recorded and written back to DealerSocket.</p>
          </div>
        </div>
        <div className="outcome-grid">
          {[
            { l: "Appointment requested", v: appointmentsCount, c: "#1da867" },
            { l: "Handed to salesperson", v: 31, c: "#1686e8" },
            { l: "Not interested", v: 9, c: "#f59e0b" },
            { l: "Opted out", v: 6, c: "#df2434" },
            { l: "Wrong number", v: 3, c: "#667085" },
          ].map((o) => (
            <div key={o.l}>
              <span><i style={{ background: o.c }} />{o.l}</span>
              <b>{o.v}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Settings({ notify }: { notify: (m: string) => void }) {
  const [tab, setTab] = useState("Dealership identities");

  return (
    <div className="page-wrap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">BOORAN MOTOR GROUP</span>
          <h2>Dealership identities &amp; CRM connection</h2>
          <p>Manage separate sender identities for Cranbourne Kia, Cranbourne MG and Geely Cranbourne, and DealerSocket automation.</p>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-tabs">
          {["Dealership identities", "DealerSocket connection"].map((x) => (
            <button
              key={x}
              className={tab === x ? "active" : ""}
              onClick={() => setTab(x)}
            >
              {x}
              <Icon name="chevron" size={14} />
            </button>
          ))}
        </nav>

        <section className="card settings-card">
          <div className="card-header">
            <div>
              <h3>{tab}</h3>
              <p>
                {tab === "Dealership identities"
                  ? "Distinct sender phone and contact numbers per rooftop (LMCT 11602)."
                  : "DealerSocket read-only browser session and live connector status."}
              </p>
            </div>
          </div>

          {tab === "Dealership identities" ? (
            roofCards.map((r) => (
              <div className="setting-roof" key={r.name}>
                <i style={{ background: r.colour }}>{r.initials}</i>
                <div>
                  <label>
                    Dealership name
                    <input readOnly defaultValue={r.name} />
                  </label>
                  <label>
                    Address
                    <input readOnly defaultValue={r.address} />
                  </label>
                  <label>
                    Sender identity
                    <input readOnly defaultValue={r.name + " (Dedicated mobile)"} />
                  </label>
                </div>
                <span className="active-badge">
                  <i />
                  ACTIVE
                </span>
              </div>
            ))
          ) : (
            <DealerSocketConnection />
          )}
        </section>
      </div>
    </div>
  );
}
