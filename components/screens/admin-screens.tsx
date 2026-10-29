"use client";

import type { Role } from "@/lib/types";
import { Icon } from "../icon";
import { canAccessPage } from "@/lib/permissions";
import { AutomationMonitoring } from "./automation-monitoring";
import { UserManagement } from "./user-management";
import { Suppression } from "./suppression";
import { useSession } from "../auth/session-provider";
import { Journeys, Reports, Settings } from "./admin-live";

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

