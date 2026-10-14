import type { Message, Prospect } from "./types";
import { canAccessPage, roleNames } from "./permissions";

export const prospects: Prospect[] = [
  { id: "p1", name: "Olivia Bennett", initials: "OB", mobile: "0412 884 201", rooftop: "Cranbourne Kia", source: "carsales", vehicle: "2026 Kia Sportage GT-Line", owner: "Mia Harris", step: "Paused · reply", lastDirection: "Inbound", lastActivity: "2 min ago", time: "10:06 am", preview: "Saturday morning would be perfect. Do you have…", status: "Waiting on us", unread: 2, crmId: "DS-847291" },
  { id: "p2", name: "Noah Williams", initials: "NW", mobile: "0438 110 492", rooftop: "Cranbourne MG", source: "Website", vehicle: "MG ZS Hybrid+ Essence", owner: "Unassigned", step: "Qualify · 2 of 5", lastDirection: "Outbound", lastActivity: "18 min ago", time: "9:50 am", preview: "Hi Noah, are you looking to purchase in the next…", status: "In journey", unread: 0, crmId: "DS-847288" },
  { id: "p3", name: "Amelia Singh", initials: "AS", mobile: "0451 322 774", rooftop: "Geely Cranbourne", source: "Facebook", vehicle: "Geely EX5 Complete", owner: "Daniel Lee", step: "Book · 3 of 5", lastDirection: "Inbound", lastActivity: "31 min ago", time: "9:37 am", preview: "Can someone call me after 2 today?", status: "Waiting on us", unread: 1, crmId: "DS-847280" },
  { id: "p4", name: "Ethan Walker", initials: "EW", mobile: "0409 621 188", rooftop: "Cranbourne Kia", source: "Kia Australia", vehicle: "Kia Sorento Hybrid", owner: "Mia Harris", step: "Nudge · 4 of 5", lastDirection: "Outbound", lastActivity: "1 hr ago", time: "9:08 am", preview: "Just checking in about your Sorento enquiry…", status: "Waiting on customer", unread: 0, crmId: "DS-847249" },
  { id: "p5", name: "Sophie Martin", initials: "SM", mobile: "0426 903 155", rooftop: "Cranbourne MG", source: "AutoTrader", vehicle: "MG4 Essence 64", owner: "Liam Chen", step: "Completed", lastDirection: "Inbound", lastActivity: "Yesterday", time: "4:28 pm", preview: "Thanks, see you at 4:30 tomorrow.", status: "Closed", unread: 0, crmId: "DS-847105" },
  { id: "p6", name: "Jack Thompson", initials: "JT", mobile: "0418 726 330", rooftop: "Geely Cranbourne", source: "Website", vehicle: "Geely Starray EM-i", owner: "Unassigned", step: "Suppressed", lastDirection: "Inbound", lastActivity: "Yesterday", time: "2:14 pm", preview: "STOP", status: "Opted out", unread: 0, crmId: "DS-847044" },
];

export const initialMessages: Record<string, Message[]> = {
  p1: [
    { id: "m1", kind: "system", body: "New carsales lead received and matched to opportunity DS-847291", time: "9:59 am" },
    { id: "m2", kind: "outbound", label: "Ack · Journey v3", sender: "Automation", body: "Hi Olivia, it’s Cranbourne Kia. Thanks for your enquiry about the Kia Sportage GT-Line. Are you looking to purchase soon, or just exploring options? Call 03 5991 5500 or reply here. Reply STOP to opt out.", time: "9:59:38 am", state: "Delivered" },
    { id: "m3", kind: "outbound", sender: "Mia Harris", body: "Hi Olivia, Mia here from Cranbourne Kia. We have a Sportage available to view this week. Would Saturday suit for a test drive? Call 03 5991 5500 or reply here. Reply STOP to opt out.", time: "10:04 am", state: "Delivered" },
    { id: "m4", kind: "system", body: "Journey paused · staff takeover by Mia Harris", time: "10:04 am" },
    { id: "m5", kind: "inbound", sender: "Olivia Bennett", body: "Saturday morning would be perfect. Do you have anything around 10:30?", time: "10:06 am" },
    { id: "m6", kind: "note", sender: "Mia Harris", body: "Sportage demonstrator confirmed with stock. Hold keys at front desk.", time: "10:08 am" },
  ],
};

export const navGroups = [
  { label: "Workspace", items: [
    { id: "overview", label: "New-lead overview", icon: "home", roles: roleNames.filter((role) => canAccessPage(role, "overview")) },
    { id: "conversations", label: "Conversation portal", icon: "message", badge: "3", roles: roleNames.filter((role) => canAccessPage(role, "conversations")) },
    { id: "prospects", label: "Prospect list", icon: "users", roles: roleNames.filter((role) => canAccessPage(role, "prospects")) },
  ]},
  { label: "Manage", items: [
    { id: "journeys", label: "Automated journey", icon: "route", roles: roleNames.filter((role) => canAccessPage(role, "journeys")) },
    { id: "templates", label: "Template library", icon: "template", roles: roleNames.filter((role) => canAccessPage(role, "templates")) },
    { id: "reports", label: "Journey performance", icon: "chart", roles: roleNames.filter((role) => canAccessPage(role, "reports")) },
    { id: "suppression", label: "Suppression & audit", icon: "shield", roles: roleNames.filter((role) => canAccessPage(role, "suppression")) },
  ]},
  { label: "Administration", items: [
    { id: "automation", label: "Automation monitoring", icon: "route", roles: roleNames.filter((role) => canAccessPage(role, "automation")) },
    { id: "team", label: "Users & rooftop access", icon: "team", roles: roleNames.filter((role) => canAccessPage(role, "team")) },
    { id: "settings", label: "Dealership settings", icon: "settings", roles: roleNames.filter((role) => canAccessPage(role, "settings")) },
  ]},
];
