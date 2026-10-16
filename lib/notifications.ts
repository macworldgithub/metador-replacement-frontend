"use client";

export type SystemNotification = {
  key: string;
  data: {
    rooftopId: string;
    title: string;
    message: string;
    kind: "duplicate_lead" | "handoff" | "system";
    read?: boolean;
    createdAt?: string;
  };
};

export async function fetchNotifications(): Promise<SystemNotification[]> {
  const res = await fetch("/api/notifications", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, {
    method: "PATCH",
    credentials: "same-origin",
  });
}
