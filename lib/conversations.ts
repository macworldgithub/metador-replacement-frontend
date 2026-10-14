import type { Prospect, ProspectStatus } from "./types";
import { rooftopLabel } from "./users";

export type ApiProspect = {
  id: string;
  rooftopId: string;
  dealerSocketOpportunityId: string;
  dealerSocketCustomerId?: string;
  customer: {
    firstName: string;
    lastName?: string;
    mobile: string;
    email?: string;
  };
  normalizedMobile: string;
  vehicle: { year?: number; make?: string; model?: string; comments?: string };
  leadSource: string;
  assignedTo?: { id?: string; name: string; email?: string };
  status: string;
  outcome?: string;
  journey: {
    status: "active" | "paused" | "completed" | "stopped";
    currentStep: number;
    currentStepName: string;
    pausedReason?: string;
    nextScheduledStepAt?: string;
  };
  unreadInboundCount: number;
  createdAt: string;
  lastActivityAt: string;
  lastInboundAt?: string;
  lastMessageDirection?: string;
  lastMessagePreview?: string;
};
export type LiveProspect = Prospect & { api: ApiProspect };
export type ThreadEvent = {
  id: string;
  prospectId: string;
  type:
    | "automated_outbound"
    | "staff_outbound"
    | "customer_inbound"
    | "system"
    | "internal_note";
  direction: string;
  content: string;
  authorName?: string;
  journeyStepName?: string;
  timestamp: string;
  deliveryStatus?: "pending" | "delivered" | "failed";
  failureReason?: string;
  mediaUrls?: string[];
  metadata?: { simulated?: boolean; from?: string; rooftopName?: string };
};
export type ConversationThread = {
  prospect: ApiProspect;
  totalEvents: number;
  events: ThreadEvent[];
};
export const prospectStatuses: Record<string, ProspectStatus> = {
  new: "New",
  in_journey: "In journey",
  waiting_on_us: "Waiting on us",
  waiting_on_customer: "Waiting on customer",
  opted_out: "Opted out",
  closed: "Closed",
};
export const outcomes = [
  { value: "appointment_requested", label: "Appointment requested" },
  { value: "not_interested", label: "Not interested" },
  { value: "already_bought", label: "Already bought" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "handed_to_salesperson", label: "Handed to salesperson" },
];
export function displayTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Melbourne",
        dateStyle: "short",
        timeStyle: "short",
      }).format(date)
    : "—";
}
export function mapProspect(api: ApiProspect): LiveProspect {
  const name = [api.customer.firstName, api.customer.lastName]
    .filter(Boolean)
    .join(" ");
  return {
    id: api.id,
    name,
    initials: name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join(""),
    mobile: api.customer.mobile,
    rooftop: rooftopLabel(api.rooftopId) as Prospect["rooftop"],
    source: api.leadSource,
    vehicle:
      [api.vehicle?.year, api.vehicle?.make, api.vehicle?.model]
        .filter(Boolean)
        .join(" ") || "Vehicle not specified",
    owner: api.assignedTo?.name || "Unassigned",
    step: api.journey.currentStepName,
    lastDirection:
      api.lastMessageDirection === "inbound" ? "Inbound" : "Outbound",
    lastActivity: displayTime(api.lastActivityAt),
    time: displayTime(api.lastActivityAt),
    preview: api.lastMessagePreview || "No SMS messages yet",
    status: prospectStatuses[api.status] ?? "New",
    unread: api.unreadInboundCount,
    crmId: api.dealerSocketOpportunityId,
    api,
  };
}
export class ConversationApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function conversationRequest<T>(
  path = "",
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/prospects${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ConversationApiError(
      "Cannot reach the conversation service. Please try again.",
      503,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("booran:session-refresh"));
    throw new ConversationApiError(
      data.message || "Unable to complete your request.",
      response.status,
    );
  }
  return data as T;
}
