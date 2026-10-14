"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "../auth/session-provider";
import { Icon } from "../icon";
import { roleLabel, rooftopLabel, userRoles, userRooftops, usersRequest, validateUserInput, UsersApiError, type PortalUser, type CreateUserInput, type UserApiRole } from "@/lib/users";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Unable to complete your request."; }
function dateLabel(value: string) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Melbourne" }).format(new Date(value)) : "—"; }

export function UserManagement({ notify }: { notify: (message: string) => void }) {
  const current = useSession();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<{ kind: "create" | "manage" | "deactivate"; user?: PortalUser } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try { const result = await usersRequest<PortalUser[]>("", { signal: controller.signal }); if (!controller.signal.aborted) setUsers(result); }
      catch (cause) { if (!controller.signal.aborted) { setError(errorMessage(cause)); setUsers([]); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [refresh]);
  function saved(user: PortalUser, message: string) {
    setUsers((all) => all.some((u) => u.id === user.id) ? all.map((u) => u.id === user.id ? user : u) : [user, ...all]);
    notify(message);
    if (user.id === current.id) window.dispatchEvent(new Event("booran:session-refresh"));
  }
  const filtered = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()) && (!roleFilter || roleFilter === user.role) && (!status || String(user.isActive) === status));
  return <div className="page-wrap"><div className="section-heading"><div><span className="eyebrow">GROUP ADMIN · USER MANAGEMENT</span><h2>Users, roles and rooftop access</h2><p>Manage portal accounts and the dealerships each user can access.</p></div><div className="intro-actions"><button className="btn secondary" disabled={loading} onClick={() => setRefresh((r) => r + 1)}><Icon name="clock" />Refresh</button><button className="btn primary" onClick={() => setDialog({ kind: "create" })}><Icon name="userplus" />Create user</button></div></div>
    <div className="filter-bar card"><label className="search-field"><Icon name="search" /><input aria-label="Search users" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} /></label><select aria-label="Filter user role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="">All roles</option>{userRoles.map((r) => <option value={r.value} key={r.value}>{r.label}</option>)}</select><select aria-label="Filter account status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select><span className="filter-count">{loading ? "Loading users…" : `${filtered.length} users`}</span></div>
    {error && <div className="users-error" role="alert"><Icon name="alert" /><span>{error}</span><button onClick={() => setRefresh((r) => r + 1)}>Try again</button></div>}
    <section className="card team-table"><div className="table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Rooftop access</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{!loading && filtered.map((user) => <tr key={user.id}><td><div className="customer-cell"><div className="avatar">{user.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("")}</div><span><b>{user.name}{user.id === current.id && <small className="current-user-tag">You</small>}</b><small>{user.email}</small></span></div></td><td><span className="role-pill">{roleLabel(user.role)}</span></td><td><span className="user-rooftop-list">{user.rooftopIds.length ? user.rooftopIds.map(rooftopLabel).join(", ") : "No rooftops assigned"}</span></td><td><span className={`active-badge ${!user.isActive ? "off" : ""}`}><i />{user.isActive ? "Active" : "Inactive"}</span></td><td>{dateLabel(user.createdAt)}</td><td><div className="user-actions"><button className="btn secondary" onClick={() => setDialog({ kind: "manage", user })}>View & manage</button><button className="deactivate-button" disabled={!user.isActive || user.id === current.id} title={user.id === current.id ? "You cannot deactivate your own account" : undefined} onClick={() => setDialog({ kind: "deactivate", user })}>Deactivate</button></div></td></tr>)}</tbody></table></div>
      {loading && <div className="empty-state" role="status"><Icon name="users" /><b>Loading portal users…</b></div>}
      {!loading && !error && !filtered.length && <div className="empty-state"><Icon name="users" /><b>{users.length ? "No matching users" : "No users found"}</b><span>{users.length ? "Adjust your search or filters." : "Create a user to grant portal access."}</span></div>}
    </section><p className="scope-note users-role-note">Roles supported by the current API are shown above. Automation / System Administrator requires a backend role extension. Creating a user sets an initial password; it does not send an invitation email.</p>
    {dialog && <UserDialog key={`${dialog.kind}-${dialog.user?.id ?? "new"}`} kind={dialog.kind} initialUser={dialog.user} currentId={current.id} onClose={() => setDialog(null)} onSaved={saved} notify={notify} />}
  </div>;
}

function UserDialog({ kind, initialUser, currentId, onClose, onSaved, notify }: { kind: "create" | "manage" | "deactivate"; initialUser?: PortalUser; currentId: string; onClose: () => void; onSaved: (user: PortalUser, message: string) => void; notify: (message: string) => void }) {
  const [user, setUser] = useState(initialUser);
  const [values, setValues] = useState<CreateUserInput>({ name: "", email: "", password: "", role: "salesperson", rooftopIds: [] });
  const [role, setRole] = useState(initialUser?.role ?? "salesperson");
  const [rooftops, setRooftops] = useState(initialUser?.rooftopIds ?? []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(kind === "manage");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (kind !== "manage" || !initialUser) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try { const detail = await usersRequest<PortalUser>(`/${initialUser!.id}`, { signal: controller.signal }); if (!controller.signal.aborted) { setUser(detail); setRole(detail.role); setRooftops(detail.rooftopIds); } }
      catch (cause) { if (!controller.signal.aborted) { setUser(undefined); setError(errorMessage(cause)); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [kind, initialUser, retry]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);
  async function submit(event: FormEvent, action: "create" | "role" | "rooftops" | "password" | "deactivate") {
    event.preventDefault(); if (busy) return;
    setError(""); setFields({});
    const body = action === "create" ? values : action === "role" ? { role } : action === "rooftops" ? { rooftopIds: rooftops } : { newPassword: password };
    const invalid = action === "deactivate" ? {} : validateUserInput(action, body);
    if (action === "password" && password !== confirmPassword) invalid.confirmPassword = "Passwords must match.";
    if (Object.keys(invalid).length) { setFields(invalid); return; }
    setBusy(action);
    try {
      if (action === "deactivate") {
        const result = await usersRequest<{ user: PortalUser }>(`/${user!.id}`, { method: "DELETE" }); onSaved(result.user, "User deactivated"); onClose();
      } else if (action === "create") {
        const created = await usersRequest<PortalUser>("", { method: "POST", body: JSON.stringify(values) }); setValues((v) => ({ ...v, password: "" })); onSaved(created, "User created"); onClose();
      } else if (action === "password") {
        await usersRequest(`/${user!.id}/password`, { method: "PATCH", body: JSON.stringify(body) }); setPassword(""); setConfirmPassword(""); notify("Password updated successfully");
      } else {
        const updated = await usersRequest<PortalUser>(`/${user!.id}/${action}`, { method: "PATCH", body: JSON.stringify(body) }); setUser(updated); setRole(updated.role); setRooftops(updated.rooftopIds); onSaved(updated, action === "role" ? "Role updated" : "Rooftop access updated");
      }
    } catch (cause) { setError(errorMessage(cause)); if (cause instanceof UsersApiError) setFields(cause.fields); }
    finally { setBusy(""); }
  }
  const title = kind === "create" ? "Create portal user" : kind === "deactivate" ? "Deactivate user?" : "User details and access";
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}><section className="modal user-dialog" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title"><div className="modal-header"><div><span className="eyebrow">USER MANAGEMENT</span><h3 id="user-dialog-title">{title}</h3></div><button className="icon-button" disabled={!!busy} aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
    {error && <div className="users-error dialog-error" role="alert"><Icon name="alert" /><span>{error}</span>{kind === "manage" && <button disabled={!!busy} onClick={() => setRetry((n) => n + 1)}>Reload details</button>}</div>}
    {loading ? <div className="empty-state" role="status"><b>Loading user details…</b></div> : kind === "deactivate" ? <form onSubmit={(e) => { void submit(e, "deactivate"); }}><p className="deactivate-description">Deactivate <b>{user?.name}</b> ({user?.email})? They will lose access to the portal. Their account record will be retained.</p><div className="modal-actions"><button type="button" className="btn secondary" disabled={!!busy} onClick={onClose}>Cancel</button><SaveButton busy={busy} action="deactivate" label="Deactivate user" /></div></form> : kind === "create" ? <form noValidate onSubmit={(e) => { void submit(e, "create"); }}><fieldset disabled={!!busy} className="user-fieldset">
      <UserField label="Full name" name="name" value={values.name} onChange={(value) => setValues((v) => ({ ...v, name: value }))} error={fields.name} autoComplete="name" />
      <UserField label="Email" name="email" value={values.email} onChange={(value) => setValues((v) => ({ ...v, email: value }))} error={fields.email} type="email" autoComplete="email" />
      <UserField label="Initial password" name="password" value={values.password} onChange={(value) => setValues((v) => ({ ...v, password: value }))} error={fields.password} type="password" autoComplete="new-password" hint="At least 8 characters. Share through your approved onboarding process." />
      <RoleSelect value={values.role} onChange={(value) => setValues((v) => ({ ...v, role: value as UserApiRole }))} error={fields.role} />
      <RooftopSelect value={values.rooftopIds} onChange={(value) => setValues((v) => ({ ...v, rooftopIds: value }))} error={fields.rooftopIds} />
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><SaveButton busy={busy} action="create" label="Create user" /></div></fieldset></form> : user && <>
      <div className="user-detail-summary"><h4>{user.name}</h4><p>{user.email}</p><span className={`active-badge ${!user.isActive ? "off" : ""}`}><i />{user.isActive ? "Active" : "Inactive"}</span><dl><dt>User ID</dt><dd>{user.id}</dd><dt>Created</dt><dd>{dateLabel(user.createdAt)}</dd><dt>Updated</dt><dd>{dateLabel(user.updatedAt)}</dd></dl></div>
      <form className="user-edit-section" noValidate onSubmit={(e) => { void submit(e, "role"); }}><fieldset disabled={!!busy || user.id === currentId} className="user-fieldset"><h4>Role and permissions</h4><RoleSelect value={role} onChange={setRole} error={fields.role} />{user.id === currentId && <small>Another Group Admin must change your own administrator role.</small>}<SaveButton busy={busy} action="role" label="Save role" /></fieldset></form>
      <form className="user-edit-section" noValidate onSubmit={(e) => { void submit(e, "rooftops"); }}><fieldset disabled={!!busy} className="user-fieldset"><h4>Dealership access</h4><RooftopSelect value={rooftops} onChange={setRooftops} error={fields.rooftopIds} /><SaveButton busy={busy} action="rooftops" label="Save rooftop access" /></fieldset></form>
      <form className="user-edit-section" noValidate onSubmit={(e) => { void submit(e, "password"); }}><fieldset disabled={!!busy} className="user-fieldset"><h4>Update password</h4><UserField label="New password" name="newPassword" value={password} onChange={setPassword} type="password" error={fields.newPassword} autoComplete="new-password" hint="At least 8 characters." /><UserField label="Confirm password" name="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} type="password" error={fields.confirmPassword} autoComplete="new-password" /><SaveButton busy={busy} action="password" label="Update password" /></fieldset></form>
    </>}
  </section></div>;
}

function SaveButton({ busy, action, label }: { busy: string; action: string; label: string }) { return <button className="btn primary" type="submit" disabled={!!busy}>{busy === action && <span className="spinner" />}{busy === action ? "Saving…" : label}</button>; }
function UserField({ label, name, value, onChange, error, type = "text", autoComplete, hint }: { label: string; name: string; value: string; onChange: (value: string) => void; error?: string; type?: string; autoComplete?: string; hint?: string }) { return <label htmlFor={name}>{label}<input id={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} required />{hint && <small>{hint}</small>}{error && <span id={`${name}-error`} className="field-error">{error}</span>}</label>; }
function RoleSelect({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) { return <label htmlFor="user-role">Role<select id="user-role" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}>{!userRoles.some((r) => r.value === value) && <option value={value}>{roleLabel(value)} (unsupported)</option>}{userRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>{error && <span className="field-error">{error}</span>}</label>; }
function RooftopSelect({ value, onChange, error }: { value: string[]; onChange: (value: string[]) => void; error?: string }) { return <fieldset className="rooftop-checkboxes"><legend>Rooftop access</legend>{userRooftops.map((r) => <label key={r.value}><input type="checkbox" checked={value.includes(r.value)} onChange={(e) => onChange(e.target.checked ? [...value, r.value] : value.filter((id) => id !== r.value))} />{r.label}</label>)}<small>No selections means no dealership access.</small>{error && <span className="field-error">{error}</span>}</fieldset>; }
