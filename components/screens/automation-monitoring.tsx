"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "../icon";

type ConnectorStatus = {
  workerId?: string;
  workerVersion?: string;
  status: "healthy" | "degraded" | "failed" | "never_connected";
  pollStartedAt?: string;
  pollCompletedAt?: string;
  intervalSeconds?: number;
  filtersRead?: number;
  recordsSeen: number;
  recordsChanged: number;
  recordsSent: number;
  errors: number;
  lastError?: string;
  baselineCompletedAt?: string;
  readOnly: boolean;
};

const emptyStatus: ConnectorStatus = {
  status: "never_connected",
  recordsSeen: 0,
  recordsChanged: 0,
  recordsSent: 0,
  errors: 0,
  readOnly: true,
};

function displayTime(value?: string) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Melbourne",
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(date)
    : "Unavailable";
}

export function AutomationMonitoring({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [connector, setConnector] = useState<ConnectorStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/dealersocket", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "Could not load connector status.");
      setConnector(data as ConnectorStatus);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load connector status.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const label =
    connector.status === "healthy"
      ? "Healthy"
      : connector.status === "degraded"
        ? "Degraded"
        : connector.status === "never_connected"
          ? "Not connected"
          : "Offline / stale";

  return (
    <div className="page-wrap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">DEALERSOCKET / READ-ONLY LIVE SYNC</span>
          <h2>Connector monitoring</h2>
          <p>
            Fresh queue polls detect new or changed opportunities and sync them
            into this portal.
          </p>
        </div>
        <button
          className="btn secondary"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void refresh().then(() => notify("Connector status refreshed"));
          }}
        >
          <Icon name="clock" />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <p className="scope-note">
        DealerSocket access is read-only. Live-sync imports do not enrol SMS
        journeys and DealerSocket write-back is disabled.
      </p>
      {error && <p className="scope-note">{error}</p>}

      <div className="report-stats">
        {[
          {
            name: "Connector",
            value: label,
            detail: connector.workerId || "No worker heartbeat received",
          },
          {
            name: "Records seen",
            value: String(connector.recordsSeen ?? 0),
            detail: `${connector.filtersRead ?? 0} scoped queues in latest poll`,
          },
          {
            name: "Changed",
            value: String(connector.recordsChanged ?? 0),
            detail: "New or changed since the previous fresh poll",
          },
          {
            name: "Sent to portal",
            value: String(connector.recordsSent ?? 0),
            detail: `${connector.errors ?? 0} errors in latest poll`,
          },
        ].map((item) => (
          <article className="card" key={item.name}>
            <span>{item.name}</span>
            <b>{item.value}</b>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>

      <section className="card audit-table">
        <div className="card-header">
          <div>
            <h3>Latest DealerSocket poll</h3>
            <p>
              The prospects and conversation screens refresh automatically
              after successful ingestion.
            </p>
          </div>
          <span className="status-pill">{label}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Completed</th>
                <th>Baseline</th>
                <th>Mode</th>
                <th>Worker</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{displayTime(connector.pollStartedAt)}</td>
                <td>{displayTime(connector.pollCompletedAt)}</td>
                <td>{displayTime(connector.baselineCompletedAt)}</td>
                <td>Read-only</td>
                <td>{connector.workerVersion || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {connector.lastError && (
          <div className="empty-state">
            <Icon name="close" />
            <b>Latest connector error</b>
            <span>{connector.lastError}</span>
          </div>
        )}
      </section>
    </div>
  );
}
