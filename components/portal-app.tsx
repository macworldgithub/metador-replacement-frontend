"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { navGroups } from "@/lib/mock-data";
import { canAccessPage, roleProfiles } from "@/lib/permissions";
import { Icon } from "./icon";
import { Dashboard } from "./screens/dashboard";
import { Conversations } from "./screens/conversations";
import { ProspectWorkspace } from "./screens/prospect-workspace";
import { AdminScreen } from "./screens/admin-screens";
import { SessionProvider, useSession } from "./auth/session-provider";
import { logout } from "@/lib/auth";
import { fetchNotifications, markNotificationRead, type SystemNotification } from "@/lib/notifications";
import {
  ProspectProvider,
  useProspects,
} from "./conversations/prospect-provider";

const pageTitles: Record<string, [string, string]> = {
  overview: [
    "New-lead overview",
    "Live new-lead conversations across your authorised rooftops.",
  ],
  conversations: [
    "Conversation portal",
    "One ordered thread for every new-lead conversation.",
  ],
  prospects: [
    "Prospect list",
    "New leads and their current engagement status.",
  ],
  journeys: [
    "Automated journey",
    "Build, version and control the new-lead SMS sequence.",
  ],
  reports: [
    "Journey performance",
    "New-lead engagement and journey outcomes by rooftop.",
  ],
  suppression: [
    "Suppression & audit",
    "Manage opt-outs and review communication exceptions.",
  ],
  team: [
    "Users, roles and rooftop access",
    "Users, roles and rooftop permissions.",
  ],
  settings: [
    "Sending identity and business hours",
    "Sender identities, business hours and CRM connection.",
  ],
  automation: [
    "Automation monitoring",
    "Journey triggers, execution history and failures.",
  ],
};

export function PortalApp() {
  return (
    <SessionProvider>
      <ProspectProvider>
        <AuthenticatedPortal />
      </ProspectProvider>
    </SessionProvider>
  );
}

function AuthenticatedPortal() {
  const router = useRouter();
  const user = useSession();
  const role = user.role;
  const { prospects } = useProspects();
  const unread = prospects.reduce((n, p) => n + (p.unread ?? 0), 0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState<SystemNotification[]>([]);
  const [page, setPage] = useState("overview");
  const [prospectId, setProspectId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function signOut() {
    try {
      await logout();
      router.replace("/signin");
    } catch {
      setToast("Could not sign out. Please try again.");
    }
  }

  function navigate(next: string) {
    if (!canAccessPage(role, next, user)) {
      setToast("This page is unavailable for your role.");
      return;
    }
    setPage(next);
    setSidebarOpen(false);
  }

  const activePage = canAccessPage(role, page, user) ? page : "overview";
  const title = pageTitles[activePage] ?? pageTitles.overview;
  const profile = {
    ...roleProfiles[role],
    name: user.name,
    rooftops: user.rooftops,
  };

  return (
    <div className="portal-shell">
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark">B</div>
          <div className="brand-copy">
            <strong>
              BOORAN
              <br />
              MOTOR GROUP
            </strong>
            <span>NEW-LEAD SMS PORTAL</span>
          </div>
          <span className="role-chip">{profile.shortLabel}</span>
          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="role-panel">
          <label htmlFor="role">WORKSPACE ROLE</label>
          <div id="role" className="authenticated-role">
            {user.apiRole === "read_only" ? "Read only" : role}
          </div>
          <div className="network-card">
            <span className="live-dot" /> <b>Cranbourne dealerships</b>
            <span>{profile.rooftops.length} ROOFTOPS</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navGroups.map((group) => {
            const visible = group.items.filter((item) =>
              canAccessPage(role, item.id, user),
            );
            if (!visible.length) return null;
            return (
              <div className="nav-group" key={group.label}>
                <p>{group.label}</p>
                {visible.map((item) => (
                  <button
                    key={item.id}
                    className={activePage === item.id ? "active" : ""}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon name={item.icon} size={18} />
                    <span>{item.label}</span>
                    {item.id === "conversations" && unread > 0 && (
                      <em>{unread}</em>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">
            {profile.name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </div>
          <div>
            <button
              className="profile-trigger"
              onClick={() => setProfileOpen(true)}
            >
              {profile.name}
            </button>
            <span>{profile.shortLabel} workspace</span>
          </div>
          <button
            aria-label="Sign out"
            onClick={() => {
              void signOut();
            }}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div>
            <div className="title-line">
              <h1>{title[0]}</h1>
              <span className="portal-chip">
                <i />
                {profile.shortLabel} PORTAL
              </span>
            </div>
            <p>{title[1]}</p>
          </div>
          <div className="top-actions">
            <button className="notification" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}>
              <Icon name="bell" />
              <span>{unread}</span>
            </button>
            <button className="network-button">
              <i /> Cranbourne rooftops
            </button>
          </div>
        </header>
        <main
          className={`main-content ${activePage === "conversations" ? "conversation-content" : ""}`}
        >
          {activePage === "overview" && (
            <Dashboard
              role={role}
              navigate={navigate}
              openConversation={(id) => {
                setProspectId(id);
                navigate("conversations");
              }}
            />
          )}
          {activePage === "conversations" && (
            <Conversations
              key={`${user.id}-${user.apiRole}-${user.rooftopIds.join(",")}-${prospectId}`}
              initialProspectId={prospectId}
              role={role}
              notify={setToast}
            />
          )}
          {activePage === "prospects" && (
            <ProspectWorkspace
              role={role}
              openConversation={(id) => {
                setProspectId(id);
                navigate("conversations");
              }}
              notify={setToast}
            />
          )}
          {[
            "journeys",
            "templates",
            "reports",
            "suppression",
            "team",
            "settings",
            "automation",
          ].includes(activePage) && (
            <AdminScreen role={role} page={activePage} notify={setToast} />
          )}
        </main>
      </div>
      
      {notificationsOpen && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-label="Notifications">
            <div className="modal-header">
              <h3>System Notifications &amp; Alerts</h3>
              <button className="icon-button" aria-label="Close" onClick={() => setNotificationsOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div style={{ maxHeight: "350px", overflowY: "auto", padding: "12px 0" }}>
              {notificationsList.map((n) => (
                <div key={n.key} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <b style={{ display: "block", fontSize: "14px" }}>{n.data.title || "Notification"}</b>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>{n.data.message}</span>
                  </div>
                  <button
                    className="btn secondary"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    onClick={async () => {
                      await markNotificationRead(n.key);
                      setNotificationsList((prev) => prev.filter((item) => item.key !== n.key));
                      setToast("Notification marked as read");
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              ))}
              {notificationsList.length === 0 && (
                <div className="empty-state">
                  <Icon name="check" />
                  <b>No unread notifications</b>
                  <span>Duplicate leads and close-loop handoffs will alert here.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {profileOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Your profile"
          >
            <div className="modal-header">
              <h3>Your profile</h3>
              <button
                className="icon-button"
                aria-label="Close profile"
                onClick={() => setProfileOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="authenticated-profile">
              <h4>{user.name}</h4>
              <p>{user.email}</p>
              <dl>
                <dt>Role</dt>
                <dd>
                  {user.apiRole === "read_only" ? "Read only" : user.role}
                </dd>
                <dt>Account</dt>
                <dd>{user.isActive ? "Active" : "Inactive"}</dd>
                <dt>Dealership access</dt>
                <dd>
                  {user.rooftops.length
                    ? user.rooftops.join(", ")
                    : "No rooftops assigned"}
                </dd>
              </dl>
              <button
                className="btn secondary"
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast">
          <span>
            <Icon name="check" size={15} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
