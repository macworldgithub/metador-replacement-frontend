"use client";

export type RooftopPerformance = {
  rooftopId: string;
  totalLeads: number;
  replied: number;
  replyRate: number;
  medianFirstSmsSeconds: number | null;
  failedSends: number;
  outcomes: Record<string, number>;
  optedOut: number;
};

export type PerformanceReport = {
  generatedAt: string;
  rooftops: RooftopPerformance[];
  excludedTestRecords: number;
  medianFirstSmsSeconds: number | null;
  daily: { date: string; leads: number; replies: number }[];
};

export async function fetchPerformance(rooftopId?: string): Promise<PerformanceReport> {
  const url = new URL("/api/reports/journey-performance", window.location.origin);
  if (rooftopId) url.searchParams.set("rooftopId", rooftopId);
  const res = await fetch(url.toString(), { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not load journey performance.");
  return res.json();
}
