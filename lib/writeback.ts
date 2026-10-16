"use client";

export type WritebackLog = {
  id: string;
  prospectId: string;
  opportunityId: string;
  rooftopId: string;
  eventType: string;
  messageBody?: string;
  status: "pending" | "success" | "failed";
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
  createdAt: string;
};

export async function fetchWritebackLogs(status?: "pending" | "success" | "failed"): Promise<WritebackLog[]> {
  const url = new URL("/api/writeback/logs", window.location.origin);
  if (status) url.searchParams.set("status", status);
  const res = await fetch(url.toString(), { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not load CRM write-back logs.");
  return res.json();
}

export async function retryWriteback(id: string): Promise<boolean> {
  const res = await fetch(`/api/writeback/retry/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Write-back retry failed.");
  }
  const data = await res.json();
  return !!data.success;
}
