# User-management integration

The Users, roles and rooftop access screen uses the existing authenticated session. Next proxies the seven supplied Nest endpoints: list, create, details, deactivate, update role, update rooftops and update password. Every request verifies the session against `/auth/me` and requires the backend `group_admin` role. Bearer tokens and passwords are not included in returned user data.

Creation is account creation with an initial password, not an email invitation. Roles use the backend values `group_admin`, `sales_manager`, `salesperson`, `bdc` and `read_only`. UI labels map the first three to Super Admin, Dealership Manager and Sales Consultant / Staff. The backend does not currently accept Automation / System Administrator. Assign multiple rooftops with checkboxes; an empty selection grants no rooftop access.

User details are loaded from `GET /users/:id`. Role, rooftop and password sections save independently to their respective PATCH endpoints. Passwords require at least eight characters, matching the supplied DTO, and confirmation before submission. Duplicate emails and backend validation errors are shown without closing the form. Mutations update the list using the returned server record; changing the current account's rooftop assignments immediately refreshes the session profile.

DELETE is shown as Deactivate and requires confirmation. The inactive record stays visible and can be filtered. Self-deactivation and self-demotion are blocked. There is no reactivation endpoint in the supplied API, so no reactivation action is offered.

Tests simulate mutations and cover all seven endpoints, role enforcement, session expiry, payload validation, soft deletion, error propagation and removal of password fields. Live mutation verification is intentionally excluded to preserve existing users.
