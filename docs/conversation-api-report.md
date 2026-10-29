# Conversation Portal integration and validation report

Date: 14 October 2026.

## Integrated endpoints

All browser requests use the Next.js `/api/prospects` proxy. The server uses `API_BASE_URL`, defaulting to `https://www.cranbourne-backend.omnisuiteai.com/api`, and forwards the HTTP-only session cookie as `Authorization: Bearer <token>`. Tokens are not exposed in browser storage. Frontend defaults to port 3001.

| Backend endpoint | Method | Frontend module / action | Payload | Verification |
| --- | --- | --- | --- | --- |
| `/api/prospects` | GET | Inbox, Prospect list, dashboard and unread counts | Query: `rooftopId`, `status`, `ownerName`, `search` | Real MongoDB list/filter/permission tests; Next proxy workflow; browser inbox |
| `/api/prospects/:id` | GET | Opening a prospect / Opportunity details | No body | Details mapped correctly; returned unread count clears to zero |
| `/api/prospects/:id/thread` | GET | Unified thread and five-second refresh | No body | Chronological SMS, notes and system events; rendered in desktop/mobile browser |
| `/api/prospects/:id/messages` | POST | SMS composer and retry button | `content`, optional legacy `authorName` | Simulated carrier success/failure, persistence, compliant footer, pause and browser send |
| `/api/prospects/:id/notes` | POST | Internal note composer | `content`, optional legacy `authorName` | Team-only event, authenticated author, opt-out-compatible notes and browser note |
| `/api/prospects/:id/journey` | PATCH | Pause, Resume, Skip current step, Stop journey | `action`: `pause`, `resume`, `skip_step`, `stop`; optional `reason` | All four transitions, ended/suppressed restart rejection, browser pause/resume/skip |
| `/api/prospects/:id/outcome` | PATCH | Outcome and outcome notes form | `outcome`, optional `notes` | Enum validation, journey completion, write-back records and browser appointment outcome |
| `/api/prospects/:id/assign` | PATCH | Assignment form in Opportunity details | `salespersonName`, optional `salespersonEmail` | Role/rooftop enforcement, email validation, persistence, write-back and browser reassignment |

Inbox, list, dashboard and conversation records no longer import mock prospects or initial messages. The backend supplies latest-message direction/preview, unread counts, customer/vehicle details, owner, source, timestamps, status, journey state, outcomes, attachments and carrier failure reasons. Media are rendered as safe HTTP(S) attachment links. Browser state refreshes after accepted mutations. Carrier simulation is explicitly labelled; failed sends stay in the thread and retry creates a new event without editing the original.

## Tests completed

| Layer | Result | Scope |
| --- | --- | --- |
| Backend HTTP/JWT/services/MongoDB suite | 13 passed | 11 endpoint/error workflows, one complete Next proxy → Nest HTTP → MongoDB workflow covering all eight APIs, one headless browser workflow |
| Frontend proxy/auth/user-management/permission tests | 28 passed; 1 optional live-auth test skipped | Six new conversation proxy/mapping tests, plus authentication, user administration and role regression checks |
| Headless Edge | Passed, zero runtime errors | Invalid/successful sign-in, real inbox/detail/thread, staff SMS, internal note, pause/resume/skip, assignment, appointment outcome; mobile details/back navigation; no horizontal overflow |
| Frontend production build and TypeScript | Passed | Conversation route generation and UI compilation |
| Backend production build | Passed | Controllers, services, DTOs and database code |
| Frontend ESLint | Passed | Application, components, libraries and test code |

Test fixtures run in a verified `portal_e2e_…` database. Twilio and DealerSocket credentials are disabled in the test process; no real customer SMS or CRM activity is dispatched. Application databases and accounts are not used as mutation fixtures. Synthetic records are cleared after each suite; the database account cannot drop databases, so empty test collection/index shells may remain. Temporary frontend servers and browser processes are closed.

## Errors found and fixes

| Finding / error | Root cause | Fix and retest |
| --- | --- | --- |
| Cross-rooftop thread/mutation access | Only list endpoint applied partial rooftop scope | Every endpoint receives authenticated actor; service checks rooftop and ownership before reading, clearing unread or mutating; 403 regression tests pass |
| Inbox filter bypass / empty rooftop access | Explicit `rooftopId` bypassed scoping; an empty scope omitted Mongo restrictions | Reject foreign rooftop filters; query an empty `$in` scope; salesperson sees own/unassigned only |
| Read-only users could mutate; staff could reassign | No per-action permission checks | Read-only mutations and unauthorised reassignment return 403 |
| Forged staff name in SMS/notes | Author trusted from request DTO | Author comes from validated JWT/database profile; spoofed author test passes |
| 500 for missing journey prospect | Generic `Error` in journey service | `NotFoundException`; now 404 |
| Blank/oversized text and invalid email accepted | Missing whitespace/length/email DTO checks | SMS up to 1600 input characters; notes up to 10000; nonblank text; valid optional assignment email; 400 tests pass |
| Regex search could error or interpret input as regex | User strings passed directly to Mongo `$regex` | Escape regex metacharacters; literal `[` search returns 200 |
| Unread response remained stale | Updated database but returned pre-update prospect | Return updated prospect when clearing count |
| Thread ties had no deterministic order | Timestamp-only sort | Timestamp then Mongo `_id` ordering |
| Ended/suppressed journeys could restart | Journey transitions lacked terminal/suppression checks | Restart returns 400; stop closes prospect; resume restores active scheduling; step-zero handling corrected |
| Carrier failure reason was lost | SMS service caught error without persisting reason | Save `failureReason`; mark simulated delivery; failed staff send leaves customer waiting on us; UI shows failure/retry |
| Missing assignment CRM activity | Assignment only updated portal record | Queue assignment write-back alongside thread system event |
| Staff SMS lacked enforced rooftop/contact/STOP footer | Compliance copy left entirely to composer | Backend appends missing identification, contact path and opt-out wording using rooftop configuration |
| Test runner could not load installed Nest ESM packages | Jest 29 CJS transform skipped dependencies | Targeted JS transformer for installed Nest JWT/Passport/Mongoose/Schedule/Swagger packages |
| Test cleanup failed; repeated new databases hit collection quota | Mongo account lacks `dropDatabase`; shared cluster has collection cap | Clear only records in a verified isolated database, close connection in `finally`, support explicit reuse of that test database |

## Limits and tests not completed

- Real Twilio delivery, real carrier delivery-receipt timing, MMS retrieval and real DealerSocket partner write-back were not exercised. Their credentials/external systems are outside this isolated run. Simulation success and injected carrier failure were tested.
- Browser verification used installed Chromium-based Edge at desktop 1664×1050 and mobile 390×844. Safari, physical mobile devices and broad cross-browser coverage were not tested.
- Production load/concurrency, SMS/webhook race stress and availability targets were not measured.
- The original legacy `test/app.e2e-spec.ts` assumes unauthenticated APIs and application database fixtures. The final run targets the new isolated authenticated conversation suite; it does not claim that legacy suite passes.
- The optional standalone live-auth frontend test was skipped because its credential environment variables were unset. Actual login and profile forwarding were exercised inside the isolated full-stack and browser tests.
- Separate journey configuration, reporting and suppression configuration screens are outside the eight Conversation Portal endpoints and retain their existing configuration previews.

## Reproduce

Build the frontend before browser tests. Run frontend regression tests with `node --test tests/conversations.test.mjs tests/users.test.mjs tests/authentication.test.mjs tests/permissions.test.mjs`.

From the backend, run `npm run test:e2e -- --runInBand --runTestsByPath test/conversation-portal.e2e-spec.ts`. Set `RUN_PORTAL_BROWSER=1` to include the browser workflow. `BROWSER_EXECUTABLE_PATH` can point to an installed Chromium browser. If the cluster cannot create more collections, set `PORTAL_E2E_DB` to an existing cleared, exclusively used test database whose name starts with `portal_e2e_`; never use the application database.

Screenshots: frontend `test-results/conversation-desktop.png` and `test-results/conversation-mobile.png` (generated, gitignored).
