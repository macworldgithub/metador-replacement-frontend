"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { navGroups } from "@/lib/mock-data";
import type { Role } from "@/lib/types";
import { canAccessPage, roleNames, roleProfiles } from "@/lib/permissions";
import { Icon } from "./icon";
import { Dashboard } from "./screens/dashboard";
import { Conversations } from "./screens/conversations";
import { Prospects } from "./screens/prospects";
import { AdminScreen } from "./screens/admin-screens";

const pageTitles: Record<string, [string, string]> = {
  overview: ["New-lead overview", "Live new-lead conversations across your authorised rooftops."],
  conversations: ["Conversation portal", "One ordered thread for every new-lead conversation."],
  prospects: ["Prospect list", "New leads and their current engagement status."],
  journeys: ["Automated journey", "Build, version and control the new-lead SMS sequence."],
  templates: ["Template library", "Approved responses for consistent, compliant conversations."],
  reports: ["Journey performance", "New-lead engagement and journey outcomes by rooftop."],
  suppression: ["Suppression & audit", "Manage opt-outs and review communication exceptions."],
  team: ["Users, roles and rooftop access", "Users, roles and rooftop permissions."],
  settings: ["Sending identity and business hours", "Sender identities, business hours and CRM connection."],
  automation: ["Automation monitoring", "Journey triggers, execution history and failures."],
};

export function PortalApp() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("Super Admin");
  const [page, setPage] = useState("overview");
  const [prospectId, setProspectId] = useState("p1");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function changeRole(next: Role) {
    setRole(next);
    const allowed = canAccessPage(next, page);
    if (!allowed) setPage("overview");
    setToast(`Workspace changed to ${next}`);
  }

  function navigate(next: string) {
    if (!canAccessPage(role, next)) { setToast("This page is unavailable for your role."); return; }
    setPage(next);
    setSidebarOpen(false);
  }

  const activePage = canAccessPage(role, page) ? page : "overview";
  const title = pageTitles[activePage] ?? pageTitles.overview;
  const profile = roleProfiles[role];


  return (
    <div className="portal-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark">B</div>
          <div className="brand-copy"><strong>BOORAN<br />MOTOR GROUP</strong><span>NEW-LEAD SMS PORTAL</span></div>
          <span className="role-chip">{profile.shortLabel}</span>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <div className="role-panel">
          <label htmlFor="role">WORKSPACE ROLE</label>
          <select id="role" value={role} onChange={(e) => changeRole(e.target.value as Role)}>
            {roleNames.map((name) => <option key={name}>{name}</option>)}
          </select>
          <div className="network-card"><span className="live-dot" /> <b>Cranbourne dealerships</b><span>{profile.rooftops.length} ROOFTOPS</span></div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navGroups.map((group) => {
            const visible = group.items.filter((item) => item.roles.includes(role));
            if (!visible.length) return null;
            return <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {visible.map((item) => <button key={item.id} className={activePage === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
                <Icon name={item.icon} size={18} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}
              </button>)}
            </div>;
          })}
        </nav>
        <div className="sidebar-footer"><div className="user-avatar">{profile.name.split(" ").map((part) => part[0]).join("")}</div><div><b>{profile.name}</b><span>{profile.shortLabel} workspace</span></div><button aria-label="Sign out" onClick={() => router.push("/signin")}><Icon name="logout" /></button></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="menu-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <div><div className="title-line"><h1>{title[0]}</h1><span className="portal-chip"><i />{profile.shortLabel} PORTAL</span></div><p>{title[1]}</p></div>
          <div className="top-actions"><button className="notification" aria-label="Notifications"><Icon name="bell" /><span>3</span></button><button className="network-button"><i /> Cranbourne rooftops</button></div>
        </header>
        <main className={`main-content ${activePage === "conversations" ? "conversation-content" : ""}`}>
          {activePage === "overview" && <Dashboard role={role} navigate={navigate} openConversation={(id) => { setProspectId(id); navigate("conversations"); }} />}
          {activePage === "conversations" && <Conversations key={`${role}-${prospectId}`} initialProspectId={prospectId} role={role} notify={setToast} />}
          {activePage === "prospects" && <Prospects role={role} openConversation={(id) => { setProspectId(id); navigate("conversations"); }} notify={setToast} />}
          {["journeys", "templates", "reports", "suppression", "team", "settings", "automation"].includes(activePage) && <AdminScreen role={role} page={activePage} notify={setToast} />}
        </main>
      </div>
      {toast && <div className="toast"><span><Icon name="check" size={15} /></span>{toast}</div>}
    </div>
  );
}

