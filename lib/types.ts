export type Role = "Super Admin" | "Dealership Manager" | "Sales Consultant / Staff" | "Automation / System Administrator";
export type Rooftop = "Cranbourne Kia" | "Cranbourne MG" | "Geely Cranbourne";
export type ProspectStatus = "New" | "In journey" | "Waiting on us" | "Waiting on customer" | "Opted out" | "Closed";

export type Prospect = {
  id: string; name: string; initials: string; mobile: string; rooftop: Rooftop;
  source: string; vehicle: string; owner: string; step: string;
  lastDirection: "Inbound" | "Outbound"; lastActivity: string; time: string;
  preview: string; status: ProspectStatus; unread?: number; crmId: string;
};

export type Message = {
  id: string; kind: "inbound" | "outbound" | "system" | "note";
  body: string; time: string; sender?: string; label?: string;
  state?: "Sending" | "Delivered" | "Failed";
};
