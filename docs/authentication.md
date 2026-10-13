# Authentication integration

Start Nest on `http://localhost:3000` and Next with `npm run dev` on `http://localhost:3001`. Open `/signin` on the frontend. `API_BASE_URL` defaults to `http://localhost:3000/api`; override it in `.env.local` for other environments. It is server-only and must not point at the frontend.

The Next route `POST /api/auth/login` forwards email/password to Nest. Both HTTP 200 and HTTP 201 success responses are accepted. The bearer token is stored in an HTTP-only, same-site cookie, marked secure in production. Passwords and tokens are not stored in browser storage or returned to the frontend UI.

`GET /api/auth/me` reads that cookie and forwards `Authorization: Bearer <token>` to Nest. It supplies the real user's name, email, active status, role and rooftop assignments. The portal waits for this profile before rendering. It rechecks on window focus and every minute. A 401, revoked account or unsupported role clears the session and returns to sign-in; transient service errors display a retry screen. Sign-out clears the cookie through `POST /api/auth/logout`. The supplied backend has no token revocation endpoint, so sign-out removes this browser session rather than revoking the JWT globally.

Backend role mapping: `group_admin` → Super Admin; `sales_manager` → Dealership Manager; `salesperson` → Sales Consultant / Staff. `bdc` has dealership-wide access without manager reporting. `read_only` has conversation viewing without mutation permissions. Supported future aliases include `super_admin`, `dealership_manager`, `sales_consultant`, `staff`, `automation_admin` and `system_admin`. Unknown roles are denied. Assigned rooftop IDs come from the profile even for Super Admin; there is no client role switcher.

Authentication is live. Other feature records remain frontend fixtures; their visibility uses authenticated rooftop assignments and ownership. Sign-up and forgot-password remain previews because no registration/recovery endpoints have been supplied. Backend guards remain authoritative for API access.
