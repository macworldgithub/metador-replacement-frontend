# Updated user roles

The MD and DOCX scope files dated 9 October 2026 both list Salesperson, BDC, Sales manager, Group admin and Read only. The user's latest proposed roles supersede the earlier Sales / Service / Admin frontend model.

| Role | Access | Permissions |
| --- | --- | --- |
| Super Admin | All three rooftops | All pages and actions, including user access, dealership and integration settings, suppression/audit, automation configuration and monitoring |
| Dealership Manager | Assigned dealerships, all owners | Review conversations and follow-ups, send SMS, takeover/pause/resume/close, outcomes, reassignment and dealership performance; no system or journey-copy configuration |
| Sales Consultant / Staff | Own and unassigned prospects in assigned dealerships | SMS, notes, outcomes, takeover, pause/resume/skip/close; no reassignment, global reporting or administration |
| Automation / System Administrator | Granted rooftops; all three in this preview | Journey configuration, templates, message schedules, triggers, failures, execution history, performance and journey controls; customer communication is read only; no users, integrations or system settings |

Automation administration is a separate role; Super Admin inherits its permissions. No Service role remains. Manager sending and reassignment retain the sales-manager capabilities in section 9 of the supplied scope.

`lib/permissions.ts` is the shared UI policy for navigation, screen access, rooftop filtering and action availability. Demo profiles assign the manager and consultant to Cranbourne Kia; system roles are assigned all three rooftops. Live identity and rooftop assignments must come from authenticated backend responses. The workspace role selector is a frontend demonstration control, not authentication or permission elevation in a production account.

Sign-up does not offer self-selected roles. Super Admin assigns roles and rooftop access through user administration. Backend enforcement is required on every read, send and administrative mutation.
