"use client";

export type JourneyStep = {
  name: string;
  template: string;
  delayType: "immediate" | "business_hours" | "next_morning" | "calendar_days";
  delayValue: number;
  requiresMarketingConsent?: boolean;
};

export type JourneyRecord = {
  key: string;
  data: {
    rooftopId: string;
    leadType: string;
    name: string;
    steps: JourneyStep[];
    status: "draft" | "published";
    version?: number;
    isCurrent?: boolean;
    enabled?: boolean;
    publishedAt?: string;
    publishedBy?: string;
  };
};

export async function fetchJourneys(rooftopId?: string): Promise<JourneyRecord[]> {
  const url = new URL("/api/journeys", window.location.origin);
  if (rooftopId) url.searchParams.set("rooftopId", rooftopId);
  const res = await fetch(url.toString(), { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not load journeys.");
  return res.json();
}

export async function activateJourney(id: string): Promise<{ id: string; enabled: boolean }> {
  const res = await fetch(`/api/journeys/${id}/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Could not activate journey.");
  }
  return res.json();
}

export async function pauseJourney(id: string): Promise<{ id: string; enabled: boolean }> {
  const res = await fetch(`/api/journeys/${id}/pause`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Could not pause journey.");
  }
  return res.json();
}
