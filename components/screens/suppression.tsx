"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { complianceRequest, ComplianceApiError, suppressionSources, validateSuppression, type ComplianceAudit, type Suppression, type SuppressionSource, type RemovalResult } from "@/lib/compliance";
import { Icon } from "../icon";

const date = (value: string) => new Date(value).toLocaleString("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" });
const message = (cause: unknown) => cause instanceof Error ? cause.message : "Unable to complete your request.";

export function Suppression({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<Suppression[]>([]);
  const [audit, setAudit] = useState<ComplianceAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState<SuppressionSource>("manual_admin");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Suppression | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        complianceRequest<Suppression[]>("suppressions", { signal }),
        complianceRequest<ComplianceAudit>("audit", { signal }),
      ]);
      if (signal?.aborted) return;
      setItems(list); setAudit(summary); setError("");
    } catch (cause) { if (!signal?.aborted) setError(message(cause)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const body = { mobile: phone, reason, source };
    const validation = validateSuppression(body);
    setFields(validation); setFormError("");
    if (Object.keys(validation).length) return;
    setSaving(true);
    try {
      await complianceRequest<Suppression>("suppress", { method: "POST", body: JSON.stringify(body) });
      setPhone(""); setReason("");
      notify("Mobile suppressed across all three rooftops.");
      await load();
    } catch (cause) { setFormError(message(cause)); if (cause instanceof ComplianceApiError) setFields(cause.fields); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!selected || !confirmed || removing) return;
    setRemoving(true); setRemoveError("");
    try {
      await complianceRequest<RemovalResult>(`suppress/${encodeURIComponent(selected.mobile)}`, { method: "DELETE" });
      // Confirm against the list: the documented DELETE response has success: {}.
      let list = await complianceRequest<Suppression[]>("suppressions");
      for (let attempt = 0; list.some((item) => item.mobile === selected.mobile) && attempt < 3; attempt++) {
        await new Promise((done) => window.setTimeout(done, 300));
        list = await complianceRequest<Suppression[]>("suppressions");
      }
      setItems(list);
      if (list.some((item) => item.mobile === selected.mobile)) throw new Error("The number is still suppressed. Refresh the list and try again.");
      setSelected(null); setConfirmed(false);
      notify("Suppression removed. Existing journeys were not restarted.");
      await load();
    } catch (cause) { setRemoveError(message(cause)); }
    finally { setRemoving(false); }
  }
  async function exportAudit() {
    if (exporting) return;
    setExporting(true); setError("");
    try {
      const summary = await complianceRequest<ComplianceAudit>("audit");
      setAudit(summary);
      const url = URL.createObjectURL(new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `suppression-audit-${summary.generatedAt.slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Compliance audit downloaded.");
    } catch (cause) { setError(message(cause)); }
    finally { setExporting(false); }
  }
  const query = search.trim().toLowerCase();
  const visible = items.filter((item) => [item.mobile, item.reason, item.source].some((value) => value.toLowerCase().includes(query)));
  return <div className="page-wrap compliance-page">
    <div className="section-heading"><div><span className="eyebrow">COMPLIANCE &amp; SUPPRESSION</span><h2>Suppression &amp; audit</h2><p>Spam Act &amp; ACMA · 3-rooftop global suppression list.</p></div><button className="btn secondary" disabled={exporting} onClick={() => void exportAudit()}><Icon name="download" />{exporting ? "Preparing audit…" : "Export audit"}</button></div>
    {error && <div className="compliance-alert" role="alert"><span>{error}</span><button className="btn secondary" disabled={loading} onClick={() => void load()}>Try again</button></div>}
    <p className="scope-note">An opt-out at any rooftop blocks staff and automated SMS across Cranbourne Kia, Cranbourne MG and Geely Cranbourne.</p>
    <div className="compliance-grid">
      <section className="card suppression-form"><div className="card-header"><div><h3>Add to suppression list</h3><p>Apply a global block with a recorded reason and source.</p></div></div>
        <form onSubmit={submit} noValidate>
          <label>Australian mobile<input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="04xx xxx xxx" disabled={saving} aria-invalid={!!fields.mobile} aria-describedby={fields.mobile ? "suppression-mobile-error" : undefined} />{fields.mobile && <span className="field-error" id="suppression-mobile-error">{fields.mobile}</span>}</label>
          <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Customer requested manual unsubscribe over phone" disabled={saving} aria-invalid={!!fields.reason} aria-describedby={fields.reason ? "suppression-reason-error" : undefined} />{fields.reason && <span className="field-error" id="suppression-reason-error">{fields.reason}</span>}</label>
          <label>Source<select value={source} onChange={(event) => setSource(event.target.value as SuppressionSource)} disabled={saving}>{suppressionSources.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>{fields.source && <span className="field-error">{fields.source}</span>}</label>
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <button className="btn primary" disabled={saving} type="submit">{saving ? "Adding suppression…" : "Add to suppression"}</button>
        </form>
      </section>
      <section className="card compliance-health"><div className="card-header"><div><h3>Global suppression summary</h3><p>Current backend audit snapshot.</p></div></div>
        <div><span><Icon name="shield" size={14} />Suppressed numbers</span><b>{audit ? audit.totalSuppressedNumbers : "—"}</b></div>
        <div><span>Coverage</span><b>All three rooftops</b></div>
        <div><span>Standard reported by API</span><b>{audit?.complianceStandard ?? "—"}</b></div>
        <div><span>Generated (Melbourne)</span><b>{audit ? date(audit.generatedAt) : "—"}</b></div>
        <p className="compliance-hint">This export contains the current suppression list, not historical send activity or proof of consent.</p>
      </section>
    </div>
    <section className="card audit-table" aria-busy={loading}><div className="card-header"><div><h3>Global suppression list</h3><p>{loading ? "Loading current suppressions…" : `${items.length} suppressed ${items.length === 1 ? "number" : "numbers"} across Kia, MG and Geely Cranbourne.`}</p></div><button className="btn secondary" disabled={loading || saving || removing} onClick={() => void load()}>Refresh</button></div>
      <div className="compliance-search"><label>Search suppressions<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mobile, reason or source" /></label></div>
      {loading && !items.length ? <div className="empty-state" role="status">Loading suppressions…</div> : error && !items.length ? <div className="empty-state">The suppression list could not be loaded.</div> : !visible.length ? <div className="empty-state">{query ? "No suppressions match your search." : "No numbers are currently suppressed."}</div> : <div className="table-scroll"><table><thead><tr><th>Mobile</th><th>Reason</th><th>Source</th><th>Added (Melbourne)</th><th>Action</th></tr></thead><tbody>{visible.map((item) => <tr key={item.mobile}><td><b>{item.mobile}</b></td><td className="suppression-reason">{item.reason}</td><td>{suppressionSources.find((source) => source.value === item.source)?.label ?? item.source}</td><td>{date(item.createdAt)}</td><td><button className="btn secondary" disabled={saving || removing || loading} onClick={() => { setSelected(item); setConfirmed(false); setRemoveError(""); }} aria-label={`Remove suppression for ${item.mobile}`}>Remove</button></td></tr>)}</tbody></table></div>}
    </section>
    {selected && <div className="modal-backdrop" onClick={() => { if (!removing) setSelected(null); }}><section className="modal compliance-modal" role="dialog" aria-modal="true" aria-labelledby="remove-suppression-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape" && !removing) setSelected(null); }}><h3 id="remove-suppression-title">Remove global suppression?</h3><p>Remove the SMS block for <b>{selected.mobile}</b> across all three rooftops. Existing opted-out prospects and stopped journeys will not be restarted.</p><label className="consent-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={removing} autoFocus />I have verified that this admin override is authorised and appropriate consent is recorded.</label>{removeError && <p className="field-error" role="alert">{removeError}</p>}<div className="intro-actions"><button className="btn secondary" disabled={removing} onClick={() => setSelected(null)}>Cancel</button><button className="btn primary" disabled={!confirmed || removing} onClick={() => void remove()}>{removing ? "Removing…" : "Remove suppression"}</button></div></section></div>}
  </div>;
}
