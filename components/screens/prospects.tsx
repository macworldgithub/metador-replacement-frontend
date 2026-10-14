"use client";

import { useEffect, useMemo, useState } from "react";
import { useProspects } from "../conversations/prospect-provider";
import {
  conversationRequest,
  mapProspect,
  displayTime,
  prospectStatuses,
  type ApiProspect,
  type LiveProspect,
} from "@/lib/conversations";
import type { Role } from "@/lib/types";

import { Icon } from "../icon";
import { useSession } from "../auth/session-provider";

type Props = {
  role: Role;
  openConversation: (id: string) => void;
  notify: (message: string) => void;
};

export function Prospects({ openConversation }: Props) {
  const user = useSession();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [rooftop, setRooftop] = useState("All rooftops");
  const [status, setStatus] = useState("All statuses");
  const [owner, setOwner] = useState("All owners");
  const [source, setSource] = useState("All sources");
  const [landed, setLanded] = useState("All dates");
  const { prospects, loading, error: listError, refresh } = useProspects();
  const [serverResult, setServerResult] = useState<LiveProspect[] | null>(null);
  const [filterError, setFilterError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (rooftop !== "All rooftops") {
        const id = user.rooftopIds.find(
          (id) =>
            ({
              cranbourne_kia: "Cranbourne Kia",
              cranbourne_mg: "Cranbourne MG",
              geely_cranbourne: "Geely Cranbourne",
            })[id as "cranbourne_kia"] === rooftop,
        );
        if (id) params.set("rooftopId", id);
      }
      if (status !== "All statuses") {
        const value = Object.entries(prospectStatuses).find(
          ([, label]) => label === status,
        )?.[0];
        if (value) params.set("status", value);
      }
      if (owner !== "All owners" && owner !== "Unassigned")
        params.set("ownerName", owner === "Mine" ? user.name : owner);
      try {
        const data = await conversationRequest<ApiProspect[]>(`?${params}`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setServerResult(data.map(mapProspect));
          setFilterError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setFilterError(
            cause instanceof Error
              ? cause.message
              : "Could not filter prospects.",
          );
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, rooftop, status, owner, user, prospects]);
  const allowed = serverResult ?? prospects;
  const filtered = useMemo(
    () =>
      allowed
        .filter(
          (p) =>
            (rooftop === "All rooftops" || p.rooftop === rooftop) &&
            (status === "All statuses" || p.status === status) &&
            (owner === "All owners" ||
              (owner === "Mine" ? p.owner === user.name : p.owner === owner)) &&
            (source === "All sources" || p.source === source) &&
            (landed === "All dates" ||
              new Date(p.api.createdAt).toLocaleDateString("en-CA", {
                timeZone: "Australia/Melbourne",
              }) ===
                new Date(
                  now - (landed === "Yesterday" ? 86400000 : 0),
                ).toLocaleDateString("en-CA", {
                  timeZone: "Australia/Melbourne",
                })) &&
            `${p.name} ${p.mobile} ${p.vehicle}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(b.lastDirection === "Inbound") -
            Number(a.lastDirection === "Inbound"),
        ),
    [allowed, query, rooftop, status, owner, source, landed, user, now],
  );
  function reset() {
    setQuery("");
    setRooftop("All rooftops");
    setStatus("All statuses");
    setOwner("All owners");
    setSource("All sources");
    setLanded("All dates");
  }
  return (
    <div className="page-wrap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CONVERSATION PORTAL</span>
          <h2>Prospect list</h2>
          <p>
            New leads received from DealerSocket. Default sort: last inbound
            first.
          </p>
        </div>
        <button className="btn secondary" onClick={reset}>
          <Icon name="filter" />
          Reset filters
        </button>
      </div>
      {(listError || filterError) && (
        <div className="portal-api-error" role="alert">
          {listError || filterError}
          <button onClick={refresh}>Retry</button>
        </div>
      )}
      {loading && (
        <div className="scope-note" role="status">
          Loading prospects…
        </div>
      )}
      <div className="card prospect-filters">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Search prospects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, mobile or vehicle"
          />
        </label>
        <div className="filter-fields">
          <label>
            Rooftop
            <select
              value={rooftop}
              onChange={(e) => setRooftop(e.target.value)}
            >
              <option>All rooftops</option>
              {Array.from(new Set(allowed.map((p) => p.rooftop))).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Owner
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option>All owners</option>
              <option>Mine</option>
              <option>Unassigned</option>
              {Array.from(new Set(allowed.map((p) => p.owner)))
                .filter((o) => o !== "Unassigned")
                .map((o) => (
                  <option key={o}>{o}</option>
                ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {[
                "All statuses",
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
          </label>
          <label>
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option>All sources</option>
              {Array.from(new Set(allowed.map((p) => p.source))).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Date landed
            <select value={landed} onChange={(e) => setLanded(e.target.value)}>
              <option>All dates</option>
              <option>Today</option>
              <option>Yesterday</option>
            </select>
          </label>
        </div>
      </div>
      <div className="prospect-table card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Customer",
                  "Mobile",
                  "Rooftop",
                  "Source",
                  "Vehicle of interest",
                  "Owner",
                  "Journey step",
                  "Last message direction",
                  "Last activity time",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="customer-cell">
                      <div className="avatar">{p.initials}</div>
                      <span>
                        <b>
                          {p.name}
                          {p.unread ? <em>{p.unread}</em> : null}
                        </b>
                        <small>{p.crmId}</small>
                      </span>
                    </div>
                  </td>
                  <td className="nowrap">{p.mobile}</td>
                  <td>{p.rooftop}</td>
                  <td>{p.source}</td>
                  <td>{p.vehicle}</td>
                  <td>
                    <b>{p.owner}</b>
                  </td>
                  <td>{p.step}</td>
                  <td>
                    <span
                      className={`direction-pill ${p.lastDirection.toLowerCase()}`}
                    >
                      {p.api.lastMessageDirection ? p.lastDirection : "—"}
                    </span>
                  </td>
                  <td>
                    <b>{p.lastActivity}</b>
                    <small>Landed {displayTime(p.api.createdAt)}</small>
                  </td>
                  <td>
                    <span
                      className={`status-pill status-${p.status.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Open thread for ${p.name}`}
                      onClick={() => openConversation(p.id)}
                    >
                      <Icon name="chevron" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Icon name="search" />
            <b>No matching prospects</b>
            <span>Adjust the filters to see more results.</span>
          </div>
        )}
        <div className="table-footer">
          <span>
            {filtered.length} of {allowed.length} authorised prospects
          </span>
          <span>
            DealerSocket is authoritative for customer and opportunity fields.
          </span>
        </div>
      </div>
    </div>
  );
}
