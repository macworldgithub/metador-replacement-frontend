# Portal URL navigation

The shared portal shell and session/prospect providers live under `app/(portal)/layout.tsx`. Screens use real App Router pages: `/overview`, `/prospects`, `/conversations`, `/conversations/[id]`, `/journeys`, `/reports`, `/suppression`, `/team`, `/settings` and `/automation`.

Sidebar links support normal browser navigation and opening a screen in a new tab. Selecting a portal conversation updates its URL. Reload and browser Back/Forward reopen the conversation identified by that URL. `/prospects?source=portal` preserves the portal-conversation tab; `/prospects` shows live DealerSocket leads. The root URL redirects to `/overview`; existing CRM links using `/?prospect=ID` redirect to the matching conversation.

Session verification gates the shared UI. Each screen checks its page permission before mounting, including on direct navigation. The existing authenticated API handlers/backend continue to enforce rooftop, owner and mutation permissions; the route itself is not an authorization boundary for data. Restricted threads show the API denial rather than opening a different prospect. Unknown URLs return the standard 404 page.

An unauthenticated visitor is sent to `/signin?next=...`. Successful sign-in returns to a validated internal portal URL. External, malformed and unsupported destinations fall back to `/overview`.

Deploy using a Next.js Node server (`npm run build`, then `npm start`) and forward all page paths to it through your reverse proxy. These pages are not a static-export deployment. Restart the frontend after deployment; no backend route changes, new SMS sends or CRM writes are introduced by frontend routing.

Verification: `tests/portal-routes.test.mjs` checks return-URL validation. `tests/browser-routing.mjs` uses synthetic APIs to exercise refresh, history, direct/new-tab/legacy links, sign-in return, restricted pages/threads, mobile navigation and 404s. Existing connector UI tests use sidebar links.
