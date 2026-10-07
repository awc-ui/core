# AWC UI Data Grid waitlist operations

The landing page remains static Astro on Netlify. Four Netlify Functions provide
signup, unsubscribe, advertising-consent withdrawal, and queued delivery. PostgreSQL stores subscribers,
versioned offer eligibility, rate budgets, and separate welcome/admin delivery
jobs. The sender is `waitlist@awc-ui.dev`; owner notifications go to
`ionut-valentin.mitrache@awc-ui.dev`.

This is single opt-in: a successful form submission joins immediately. Turnstile
reduces automated abuse but does not establish ownership of the submitted email.
There is no payment, license issuance, public discount code, or commerce account
creation in this feature.

## Optional advertising measurement

Measurement is separate from email consent. The browser asks before loading the
existing Google Ads tag or retaining enabled Meta, Reddit, or Google click attribution. Rejecting advertising
does not affect signup or the launch offer. No browser signup conversion fires:
the public API deliberately gives identical replies for new, duplicate,
suppressed, and honeypot requests.

Google's tag is intentionally not loaded on URLs containing query parameters or
fragments, including `gclid`, UTM links, and `/#pro-tier`, to avoid a third-party
script seeing potentially private URL data. Google measurement is therefore
incomplete on those entry points. This does not prevent separately enabled, consented server click attribution
for Meta, Reddit, or Google on the waitlist landing URL. The server adapters do
not load Google or Reddit browser scripts on campaign URLs.

The optional server Meta `Lead` is inserted in the **same transaction as a new
subscriber**, in `waitlist_advertising_outbox`, only with explicit current
advertising consent and usable attribution. A unique subscriber/provider constraint and
stable random event ID prevent duplicate jobs. The ID and original event time
remain unchanged across at most six attempts within 24 hours; network ambiguity
is retried using Meta's event deduplication. Provider failure does not delay the
signup response or change the email outbox. Existing `waitUntil` and hourly
recovery deliver the events, with bounded worker time.

The Meta payload contains `Lead`, its event ID/time, the fixed public landing URL,
the browser User-Agent required for website events, and only valid `_fbp`/`_fbc`
identifiers available after consent. It contains no name, email, email hash,
subscriber ID, raw IP address, unsubscribe token, or arbitrary URL parameters.
The identifiers and User-Agent are personal/pseudonymous data, not anonymous.
Attribution may be lower than an integration sharing email/IP. No Meta browser
SDK or automatic request-context extraction is used.

The consent capability is random per grant and stored server-side only as a
SHA-256 hash. Withdrawal cancels queued work and clears its match data, including
when it races ahead of signup. A worker checks consent again before contacting
Meta; requests already in flight or accepted cannot be recalled by a preference
change. Browser withdrawal stops new local measurement and retains a pending
capability until the server acknowledges cancellation. Re-granting creates a new
capability; it never resurrects cancelled jobs or creates Leads for existing
subscribers. Email unsubscribe and advertising preferences remain separate.

The withdrawal endpoint requires the exact origin/path and a 43-character
random capability, limits its body to 256 bytes, and has independent edge and
30/IP/day persisted limits. It accepts no email address. The per-IP key is a
daily HMAC, not a stored raw address. Unknown-capability records have short
retention; distributed traffic can still consume platform invocations, so the
existing usage/edge monitoring remains necessary.

Match payloads are removed on successful delivery, permanent failure, withdrawal,
or expiry (at most 24 hours plus the hourly maintenance cadence). Terminal job
metadata is deleted after 30 days. Active consent records expire after 90 days;
withdrawals of previously recorded grants remain for 180 days to prevent late
requests from restoring consent, without extending on repeated withdrawal.
An unknown-capability withdrawal is retained
for only 24 hours to cover in-flight signup races, without extending its lifetime
on repeat requests. Browser choices and attribution expire after 90 days.
Deletion requests must include these advertising records and, where applicable,
provider records. Delete the subscriber's `waitlist_advertising_outbox` rows before
deleting `waitlist_subscribers`; both the advertising and email outboxes have
foreign keys. Never remove subscribers using a cascade that skips review of
pending deliveries or provider records.

For an approved erasure, pause both delivery switches and wait for active leases
to settle before a single reviewed database transaction cancels/deletes the
target advertising jobs, deletes that subscriber's SMTP send-attempt rows and
email jobs, then deletes the subscriber. Remove only unreferenced consent rows
whose retention is no longer justified; one consent capability may cover several
signups. Commit these changes together. Already transmitted provider events and
mailbox/backups require their separate erasure process. These are operator
instructions; no public erasure endpoint or automatic subscriber deletion is
introduced by this feature.

### Review and activation

The new Meta path is **off by default**. Deploying code does not activate it.

1. Review the privacy notice and consent UI, then deploy the additive
   `202610060001_advertising_measurement.sql` migration with reviewed code.
   Existing Netlify migration staging applies it before publishing the functions.
   It does not alter email subscription or SMTP-outbox records.
2. Configure the intended Meta Dataset/Pixel and a Conversions API access token.
   Put runtime settings only in **Netlify Production / Functions**, never build
   variables, source, logs, or chat:

   | Variable | Setting |
   | --- | --- |
   | `META_CAPI_ENABLED` | Absent/`false` until explicitly activating delivery |
   | `META_DATASET_ID` | Numeric Dataset/Pixel ID |
   | `META_GRAPH_API_VERSION` | Explicit supported Graph version, e.g. `v24.0`; verify support before activation |
   | `META_CAPI_ACCESS_TOKEN` | Secret token authorized for that dataset |
   | `META_TEST_EVENT_CODE` | Optional temporary Meta Test Events code; remove after verification |

3. Only after the backend configuration and migration are ready, set public
   GitHub repository variable `PUBLIC_META_MEASUREMENT_ENABLED=true` and rebuild
   the production site. PR builds force it off. This flag controls consented
   browser attribution; it contains no dataset credential and sends no event by
   itself. The backend independently requires `META_CAPI_ENABLED=true`, a valid
   ID/token/version, trusted production metadata, and privacy readiness.
4. Before normal delivery, verify a consented **new** operator signup in Meta
   Test Events using `META_TEST_EVENT_CODE`. Check that the minimal fbp/fbc +
   User-Agent payload is accepted by the actual configured dataset. Repeat the
   signup to confirm no second Lead, test Reject, and test withdrawal before a
   queued delivery. Local tests stub Meta and cannot prove real attribution,
   match quality, or Ads Manager reporting. Do not optimize a campaign for website
   Leads until this check succeeds.
5. Remove the test-event code, review the final configuration, and enable normal
   delivery. To pause, set `META_CAPI_ENABLED=false` and turn off the public flag.
   Withdrawal and scheduled retention still work; pending events expire without
   being replayed beyond their 24-hour window.

Primary implementation references: [Google basic consent integration](https://developers.google.com/tag-platform/security/guides/consent),
[Meta server event parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event/),
[Meta fbp/fbc parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc/),
and [Meta's first-party parameter-builder examples](https://github.com/facebook/capi-param-builder/tree/main/nodejs).

## Reddit and Google signup measurement

The additional providers start **disabled**, independently of the working Meta
integration. Their public flags also start false in preview and production
builds. Missing or malformed provider configuration disables only that provider.
No provider receives email, email hashes, subscriber IDs, raw IP addresses, or
private URLs from these server adapters. The Google tag remains a separate,
consented browser integration with the limitations described above.

Consent wording is `advertising-2026-10-07-v2`. Previously accepted versions are
not silently expanded to cover Reddit or the new Google server integration:
the browser withdraws the old capability and asks again. Declining does not
change signup, early-offer eligibility, or transactional email. After consent,
the browser retains only valid click IDs in secure first-party cookies whose
expiry is bounded by the original 90-day grant. Duplicate/conflicting Google
click parameters are ignored. Sensitive/private-link pages never capture them.

New subscriber registration creates at most one outbox row **per provider** in
its transaction. Returning, suppressed and duplicate addresses do not create
new rows, even after re-granting consent. Existing Meta rows and event IDs are
preserved by `202610070001_advertising_providers.sql`; no historic subscriber
is backfilled. Reddit and Google destinations are bound when queued. Changing
a pixel, conversion action, owner or login routing fails pending work closed
instead of sending an old conversion to a new destination. Credential rotation
does not change that destination identity.

Each enabled provider has a separate bounded background worker so a slow
Reddit endpoint or Google OAuth exchange cannot starve Meta. Delivery checks
consent/lease immediately before dispatch; Google checks again after OAuth
refresh and before ingestion. Withdrawal during token refresh therefore stops
the conversion request before it starts. Once an ingestion request is in flight
or accepted, neither local cancellation nor Google diagnostics can recall it.

### Runtime configuration

Set only in **Netlify Production / Functions**, never repository files, public
build variables, chat, or logs. All examples below name fields, not credentials.

| Variable | Purpose |
| --- | --- |
| `REDDIT_CAPI_ENABLED` | `true` for an approved controlled validation after setup, then normal delivery only after validation passes; absent/false otherwise |
| `REDDIT_PIXEL_ID` | Intended account Pixel ID, such as `a2_...` |
| `REDDIT_CAPI_ACCESS_TOKEN` | Secret conversion access token for that pixel |
| `GOOGLE_CONVERSIONS_ENABLED` | `true` for an approved controlled validation after setup, then normal delivery only after validation passes; absent/false otherwise |
| `GOOGLE_CONVERSION_CUSTOMER_ID` | Ten-digit customer ID owning the conversion action, without hyphens |
| `GOOGLE_CONVERSION_ACTION_ID` | Numeric conversion action ID of type `UPLOAD_CLICKS`, not the AW tag ID |
| `GOOGLE_LOGIN_CUSTOMER_ID` | Optional ten-digit manager ID, only for manager-routed access; otherwise omit |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth client authorized for the Data Manager API |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Secret for that OAuth client |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Secret production offline refresh grant for the authenticating account |

Public GitHub build variables are `PUBLIC_REDDIT_MEASUREMENT_ENABLED` and
`PUBLIC_GOOGLE_MEASUREMENT_ENABLED`. They control only consented attribution
capture and disclosure; they contain no credentials and cannot enable backend
transmission alone. Both use the existing release-readiness gate: production,
public signup, valid Turnstile configuration and complete privacy identity.
A flag change requires a production rebuild. Backend credentials never enter
build/preview scope. Keep the new flags off during code review and deployment.

### Reddit setup and delivery

Verify the account's Pixel ID and create a conversion access token through its
Events Manager. Review any newly displayed terms before enabling the integration.
The adapter calls Reddit CAPI v3 at the fixed `/pixels/{pixel_id}/conversion_events`
endpoint with one `SIGN_UP`, action source `WEBSITE`, original timestamp, stable
random conversion ID, the consented `rdt_cid`, and the fixed public site URL.
It does not install the Reddit browser pixel. No click ID means no Reddit event;
no substitute email/IP matching is attempted.

A successful API acknowledgement is not proof of campaign attribution or an
impression-based match. Confirm a genuine authorized new signup in Events
Manager before using SignUp for optimization. Network ambiguity and retryable
errors reuse the same conversion ID/time, with at most six send attempts inside
24 hours. No response payload or token is logged.

### Google setup and asynchronous verification

Enable **Data Manager API** in the intended Google Cloud project. Grant the
OAuth principal access to the Google Ads conversion-owner account and request
`https://www.googleapis.com/auth/datamanager` with offline access. Configure
production OAuth lifecycle deliberately: external apps in Testing commonly
issue refresh grants that expire after seven days. This adapter supports plain
refresh-token OAuth, not DPoP-bound grants, service-account keys, or API keys.
Invalid/revoked grants require reconnection; do not repeatedly regenerate events.

Create or verify a dedicated signup action of type `UPLOAD_CLICKS` (Website /
Import from clicks), then select it as the campaign signup goal. The adapter uses
Google's supported Data Manager `POST /v1/events:ingest` API, not the restricted
legacy Google Ads upload endpoint. Its minimal payload uses one consented
`gclid`, `gbraid`, or `wbraid`, `WEB`, the signup time, stable transaction ID,
configured destination, granted ad-user-data consent and denied personalization.
It does not send a browser conversion or enhanced email match. This is
**click-based measurement**; it does not establish view-through or engaged-view
coverage for Demand Gen/YouTube video impressions.

First validate the configured payload/destination using the API's
`validateOnly: true` facility with an authorized test procedure. Validation does
not send a conversion and does not prove matching. Then use an explicitly
approved, unused operator email for the genuine signup test; never manufacture
an ad click ID or generate fake production conversions.

HTTP 200 with a request ID is only an ingestion acknowledgement. The job stays
`processing`; attribution data is cleared immediately and only its opaque
request ID remains for diagnostics. The first diagnostic check is due after
30 minutes; further checks back off to at most one hour, with at most 48 polls
and a 24-hour total lifetime. The hourly worker performs recovery. Only `SUCCESS`
for exactly one record in the intended destination with no errors/warnings
becomes `sent`. `FAILED`/partial success or warnings fail conservatively. An
expired diagnostic window is **unverified**, not proof that Google rejected or
did not count the original conversion. Never replay it under a new ID.

Preserve destination, ID, time and payload on retries: Google treats an existing
transaction ID as an adjustment rather than a duplicate error. Credential
refresh uses only Google's fixed OAuth endpoint; account endpoints cannot be
provided by visitors. Provider failure does not change the public signup reply
or the email queue. Withdrawal cancels pending work for every provider and
prevents later polls, but cannot remove already ingested conversions.

Check duplicate signup (no second job), Reject, withdrawal before dispatch,
malformed/absent identifiers, and provider diagnostics before enabling either
campaign. Tests stub provider calls; local success does not establish real
account permission, provider attribution or billing readiness.

References: [Reddit direct integration](https://ads-api.reddit.com/docs/v3/guides/programs/capi/direct-integration),
[Reddit click-ID persistence](https://ads-api.reddit.com/docs/v3/guides/programs/capi/click-id-persistence),
[Google offline event requirements](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/send-events),
[Google OAuth setup](https://developers.google.com/data-manager/api/devguides/quickstart/set-up-access),
[Google refresh protocol](https://developers.google.com/identity/protocols/oauth2/web-server#offline),
[Google ingestion REST](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest),
[Google asynchronous diagnostics](https://developers.google.com/data-manager/api/devguides/diagnostics),
[Google transaction ID semantics](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/upgrade).

## Activation is deliberately separate from deploying code

The form and server start disabled. Creating the mailbox and Turnstile widget does
not activate them. Complete these steps in order before opening registration:

1. Finalize the personal controller's public identification/contact details and
   review the English privacy notice against the actual database provider,
   hosting regions, retention/deletion procedure, and processors. Do not publish
   placeholder identity details. Enrollment closes at Data Grid's commercial
   launch; the launch and redemption-window dates are not yet known. Close signup
   with `WAITLIST_ENABLED=false` when launching, or schedule the same deadline
   with `WAITLIST_CLOSES_AT` once the launch date is fixed.
2. The selected production service is Netlify Database; its empty database has
   been provisioned separately. Review the initial migration in
   `apps/docs/netlify/database/migrations/202610020001_create_waitlist.sql`, configure
   backups/restore procedures, and restrict Netlify team access. The production
   deploy uploads migrations for Netlify to apply immediately before publication;
   a migration failure blocks publication. Do not grant a personal access token
   full production database write access merely to run this application.
3. Set the production runtime values below in Netlify's environment-variable UI.
   Use **Production** context and **Functions** scope only. Never place passwords,
   database URLs, or signing secrets in repository files, GitHub variables,
   browser code, build logs, or chat messages. Leave signup and delivery disabled.
4. Verify SMTP authentication for the dedicated mailbox and SPF/DKIM/DMARC for
   the actual GoDaddy service. A mailbox appearing in the dashboard does not
   prove SMTP authentication or inbox delivery. Monitor the mailbox for replies,
   bounces, and complaints; there is no automatic bounce/complaint webhook here.
5. Run the tests below and deploy reviewed main with the form disabled. Inspect
   the deployed function list, routes, runtime, hourly recovery schedule, and edge
   rate rules. Confirm preview deployments have no waitlist functions or form.
6. After privacy, provider configuration, and the offer text are approved, enable
   the backend, then set the GitHub public variables and deploy the visible form.
   Complete one real signup using an address controlled by the operator. Confirm
   one stored subscriber, one welcome email, one owner email, duplicate behavior,
   and unsubscribe. Confirm the receipt appears in the inbox, not merely in an
   SMTP acceptance log. This live verification has not been done by local tests.

The launch offer is **20% off the first annual Data Grid invoice**, redeemable
within 30 days of commercial launch. Renewals are at the then-disclosed standard
price. The stored offer version is `datagrid-early-20-v1`; preserve the original
join date and version. A join is not proof that the visitor owns the email or
qualifies for a purchase. The future commerce service must verify customer
identity and enforce redemption rules. Unsubscribing from announcements does not
by itself remove recorded early-offer eligibility.

The separate `consent_version` records the signup wording shown when joining:
`waitlist-2026-10-02-v1`. Preserve this value on duplicate submissions. At first
publication, record the deployed source commit alongside this wording version;
retain that historical source when later wording changes require a new version.

## Configuration

Only these **public** values belong in GitHub repository variables; the production
docs build receives them. Pull request builds force the waitlist off.

| Variable                          | Value                                                     |
| --------------------------------- | --------------------------------------------------------- |
| `PUBLIC_WAITLIST_ENABLED`         | `true` only after the activation steps; otherwise `false` |
| `PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED` | Temporary operator page; `false` by default and for every preview |
| `PUBLIC_TURNSTILE_SITE_KEY`       | The public site key for the production widget             |
| `PUBLIC_WAITLIST_CONTROLLER_NAME` | The controller's confirmed public full name               |
| `PUBLIC_WAITLIST_CONTACT_ADDRESS` | The controller's confirmed public contact address         |

Runtime values belong in **Netlify, Production context, Functions scope**. Do not
use an “all deploy contexts” default for any of them.

The non-secret `AWS_LAMBDA_JS_RUNTIME=nodejs22.x` setting must also be present in
the **Local development** context, Functions scope. Netlify CLI 27.10.2 reads that
context when bundling functions with `deploy --no-build`, even with `--prod`.
Keep all credentials and activation switches production-only. `--prod` selects
production publication; `--context` is a build option and cannot be combined with
`--no-build`.

| Variable                 | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `WAITLIST_ENABLED`       | `true` opens new signup; `false` closes it without breaking unsubscribe            |
| `WAITLIST_EMAIL_ENABLED` | Independent SMTP delivery switch; `false` pauses sending                           |
| `WAITLIST_PRIVACY_READY` | `true` only after the final notice and operational data handling are ready         |
| `WAITLIST_CLOSES_AT`     | Optional UTC ISO 8601 launch timestamp; omit until known. Empty/invalid values close signup. |
| `WAITLIST_HMAC_SECRET`   | Random secret containing at least 32 bytes; keep a recoverable secret-manager copy |
| `TURNSTILE_SECRET_KEY`   | Secret from the production Turnstile widget                                        |
| `WAITLIST_SMTP_PASSWORD` | Password for the dedicated mailbox                                                 |
| `WAITLIST_SMTP_CHECK_ENABLED` | Temporary operator-only email check; default absent/`false`                     |
| `WAITLIST_SIGNUP_CHECK_ENABLED` | Temporary real Turnstile/signup check while public signup and general mail are off |
| `WAITLIST_SIGNUP_CHECK_EMAIL` | One operator-controlled test mailbox; keep secret-valued, Production / Functions only |
| `AWS_LAMBDA_JS_RUNTIME`  | `nodejs22.x`, matching the tested/bundled runtime                                  |

The server reads the trusted invocation metadata `context.deploy.context` and
requires `production`. The build-only `CONTEXT` environment variable is not a
runtime security signal; do not set it manually to promote a preview. The code
also requires configuration before it creates production database or SMTP
connections. The official
`@netlify/database` client receives `NETLIFY_DB_URL` and `NETLIFY_DB_DRIVER` from
Netlify. Do not manually expose or override these platform credentials in GitHub,
preview builds, or browser code. Its pool is passed into the transactional store;
local integration tests use a disposable `pg` pool instead.

The SMTP host, port, TLS mode, username, sender, and owner recipient are fixed in
server code: `smtpout.secureserver.net`, **465**, implicit TLS,
`waitlist@awc-ui.dev`. Request bodies cannot override recipients or templates.
The generic `smtp.titan.email` host is not this GoDaddy reseller account's
documented endpoint. Certificate verification must stay enabled; production SQL connections use the Netlify Database SDK's managed transport.

The production Turnstile widget is **AWC UI Waitlist - Production**, Managed, with
hostname `awc-ui.dev` and no pre-clearance. Its public site key is
`0x4AAAAAAFMA9reZtyiUb2Pf`. Keep the secret server-side. Server verification must
accept the expected hostname and action; the endpoint is not protected merely by
rendering the widget. Local and automated tests use injected test dependencies
and must never send mail or write to the production list.

## Private operator email check before opening signup

With the operator's authorization to receive both templates, set
`WAITLIST_PRIVACY_READY=true`, leave both `WAITLIST_ENABLED=false` and
`WAITLIST_EMAIL_ENABLED=false` explicitly set, and temporarily set
`WAITLIST_SMTP_CHECK_ENABLED=true` in Production / Functions. Redeploy reviewed
main, then use **Functions → waitlist-delivery → Run now** in the authenticated
Netlify dashboard. The hourly worker can also run the same check.

This registers only the fixed owner address and sends its real welcome and owner
notification templates. The record uses `operator-email-check-v1` rather than
claiming public-form consent. No HTTP endpoint accepts a recipient or bypasses
Turnstile. The worker claims jobs only for that subscriber, preserving the shared
300-attempt budget. Repeated/concurrent runs retain the existing record and never
reset delivered, failed, uncertain, or suppressed jobs. Existing pending jobs may
continue under their normal bounded retry rules.

Keep `PUBLIC_WAITLIST_ENABLED=false` throughout. Privacy readiness keeps the
welcome email's unsubscribe link usable; public signup still remains closed.
Check for two `waitlist_delivery_accepted` log entries and actual inbox receipt.
Run again to check for `waitlist_delivery_idle` without duplicate mail. Restore
`WAITLIST_SMTP_CHECK_ENABLED=false` and redeploy after the check. This verifies
SMTP/database delivery, not the public browser/Turnstile signup flow, which still
needs its separate launch check.

## Real browser check while public signup stays closed

The operator can verify production Turnstile, persistence, and email delivery
without opening signup for other addresses. Keep `WAITLIST_ENABLED=false`,
`WAITLIST_EMAIL_ENABLED=false`, and `WAITLIST_SMTP_CHECK_ENABLED=false` explicitly
set. With privacy ready, configure `WAITLIST_SIGNUP_CHECK_ENABLED=true` and one
valid `WAITLIST_SIGNUP_CHECK_EMAIL` in Netlify Production / Functions. Never put
the private mailbox in GitHub variables, source, build artifacts, or logs.

Set the public GitHub build variable `PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED=true`
and leave `PUBLIC_WAITLIST_ENABLED=false`, then deploy reviewed main. Open
`https://awc-ui.dev/waitlist-check/` and submit the real shared form using the
configured operator-controlled address. This page is excluded from the sitemap,
has `noindex, nofollow`, and is not linked from the landing page. These are
discovery controls, not authentication: the server-side address restriction and
normal Turnstile/IP/quota checks enforce the closed rollout. Preview builds never
enable the page or backend.

Every other address is rejected before verification, registration, or delivery.
The approved mailbox still requires a genuine, unexpired, single-use Turnstile
token for `awc-ui.dev` and `waitlist_join`. A new verified registration defers
delivery of only that subscriber's two jobs through `waitUntil`; it cannot drain
the general queue despite the explicit operator-only SMTP exception. Duplicate
or suppressed records never create or resend jobs. Use a previously unused
operator mailbox to test a new registration; do not delete/unsuppress an old one.

Check the page's success result and both inboxes, then repeat signup with a fresh
challenge to confirm no duplicate messages. Test unsubscribe from the receipt.
The general scheduled worker stays paused; if operator delivery fails or is
uncertain, inspect its bounded outbox states rather than resetting/replaying it.
Turn off both signup-check flags and redeploy after verification, or move to the
approved public activation settings. Public activation must leave the operator
flags off. A missing/invalid target or conflicting switches fails the check
closed. If a temporary operator page remains cached, the backend switch still
prevents registration.

## Abuse limits and delivery behavior

Before Turnstile verification, signup attempts are limited to 30/IP/day. There is
no shared pre-verification daily budget: invalid tokens from one set of IPs must
not exhaust signup capacity for other visitors. Only verified new registrations
spend the global budget of 100/day and the per-IP budget of 5/day. The queue holds
at most 400 jobs. Each new registration creates two independent jobs. SMTP attempts are
capped at **300 in a trailing 24 hours**, below the documented **500 SMTP sends/day
per mailbox** limit for this GoDaddy plan. Do not share this mailbox with another
sending application or assume the unused capacity guarantees deliverability.

PostgreSQL transactions enforce the application budgets and duplicate constraints
across simultaneous requests. Netlify edge rate limits provide another layer;
their enforcement can lag, so they are not the authoritative quota. A valid
Turnstile challenge does not exempt a request from application limits. A provider
outage must not bypass verification.

These limits do not cap all costs from a distributed request flood. Rotating IPs
can increase function invocations, verification calls, and per-IP budget rows.
Monitor platform usage and edge protection as well as signup and SMTP counters;
do not reintroduce a shared daily cutoff for unverified requests. Expired attempt
rows are removed by the existing maintenance schedule.

A new signup queues its two messages durably, then uses Netlify `context.waitUntil` for bounded delivery after the HTTP response. The scheduled worker runs hourly for recovery; this cadence lets Netlify Database sleep between activity instead of waking it every five minutes. SMTP acceptance records each job
independently. A welcome failure does not cause a delivered owner notification to
be sent again, or vice versa. Delivery attempts are bounded and old jobs expire.
The system cannot promise exactly-once email: if a connection disappears after
SMTP may have accepted the message, or a worker dies while sending, the job is
**uncertain** and is not automatically resent. This prioritizes avoiding duplicate
mail over automatically recovering every receipt.

Inspect counts by state without exporting subscriber addresses:

```sql
SELECT kind, state, count(*)
FROM waitlist_outbox
GROUP BY kind, state
ORDER BY kind, state;
```

Review uncertain/failed delivery using the mailbox/provider evidence and the job
identifier. Do not bulk-reset all jobs to pending, erase send reservations, or
automatically clear email suppression. Suppress confirmed complaints and hard
bounces before any further messages. The manual handling process and owner
monitoring are launch prerequisites, not a claim of automatic bounce processing.

## Tests and deployment

Use Node 22.13+ and the repository's pinned pnpm. Tests do not load a production
`.env` file. For real SQL/concurrency tests, point `TEST_DATABASE_URL` at a disposable
PostgreSQL 16 database; the suite creates and drops its own random schema. Never
point it at production. CI provides a disposable PostgreSQL service automatically.

```sh
pnpm install --frozen-lockfile
node --test apps/docs/waitlist/*.test.mjs scripts/check-waitlist-release.test.mjs scripts/stage-waitlist-migrations.test.mjs
node scripts/build-waitlist-functions.mjs
node scripts/stage-waitlist-migrations.mjs
```

Without `TEST_DATABASE_URL`, the SQL integration suite reports **skipped**, not
passed. The bundling check creates real temporary ZIP archives and inspects
Netlify's generated manifest for all four functions, API routes, edge rate
limits, schedule, and Node runtime. It does not contact Netlify or send email.

`Deploy` calls the reusable `Waitlist` workflow before building or deploying,
including manual deploys. Existing CI-success, same-repository, main-branch and
commit-matching checks remain in place. Site builds and dependency installation
receive no runtime secrets. Production checks out the verified main commit and
uses the pinned Netlify CLI with `--no-build` to upload the built static artifact
and bundle the four source functions. PR previews retain the static deploy action
with no functions input. Runtime secrets are configured on Netlify, not copied
into the downloaded static artifact.

Database migrations are immutable after publication. Add a new numbered SQL
file for each later change, and test it against existing data before rollout.
`stage-waitlist-migrations.mjs` copies the reviewed SQL files into Netlify's
`.netlify/internal/db/migrations/<name>/migration.sql` format outside the public
static directory. This is necessary because `--no-build` skips Netlify Build's
migration-copy step. The CLI uploads that internal directory; Netlify applies it
at publication. The PostgreSQL integration tests read the same canonical initial
migration. PR previews do not stage or upload production migrations.

Do not replace that production command with a static-only upload: the form could
ship while its backend remains absent. Do not upload raw ZIPs without their
function metadata: routes, scheduling, or rate limits can be lost. Netlify CLI's
cached function manifests expire quickly, so this workflow deliberately rebundles
the same trusted source at deployment.

## Closing, incidents, and data lifecycle

At commercial launch, close early enrollment by setting `WAITLIST_ENABLED=false`
and redeploying before opening sales. If the date is fixed ahead of time, setting
`WAITLIST_CLOSES_AT` schedules that same closure. This value is intentionally
absent while the launch date is unknown; do not substitute an arbitrary date.

To stop new registrations, set `WAITLIST_ENABLED=false`; to stop mail, separately
set `WAITLIST_EMAIL_ENABLED=false`, then redeploy so the runtime picks up the new
values. Disable/rebuild the public form too when closure is intentional. Keep
unsubscribe working for past recipients. Do not turn off privacy/database
configuration as a signup kill switch.

Back up the database before migrations. Keep a recoverable copy of the HMAC
secret and plan its rotation through a managed deployment. Rotation changes
pseudonymous email/IP keys, including the current per-IP rate-limit identity.
The unique normalized email and fallback lookup preserve deduplication and
suppression across rotations. Unsubscribe token hashes are independent of the
HMAC secret, so existing unsubscribe links remain valid.

Before launch, document an explicit retention period and run a reviewed deletion
procedure on schedule. Subscriber records, outbox payloads, provider logs, backup
copies, IP-derived budget keys, and send-attempt history all need coverage.
Hourly maintenance deletes UTC budget buckets older than seven days and SMTP
reservations older than eight days. It never deletes subscribers or email outbox jobs,
and it preserves every reservation in the current 24-hour quota window. Do not
manually erase recent reservations or today's budgets while the application is
active. Deletion requests and suppression are separate operations; retain only
the minimum justified suppression/offer records described in the final notice.
Subscriber, outbox, provider-log and backup retention still require the reviewed
operational deletion procedure. Advertising match data, consent records and
terminal advertising jobs use the separate bounded cleanup described above.

## Provider references

- [Netlify Database SDK and transactions](https://docs.netlify.com/build/data-and-storage/netlify-database/api/)
- [Netlify Database migrations at publication](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/)
- [Netlify function deployment via CLI](https://cli.netlify.com/commands/deploy/)
- [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Netlify rate limiting and enforcement delay](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [GoDaddy website SMTP settings](https://www.godaddy.com/help/set-up-third-party-plugins-or-websites-using-smtp-settings-42788)
- [GoDaddy Professional Email limitations](https://www.godaddy.com/en-ph/help/professional-email-powered-by-titan-account-limitations-31970)
