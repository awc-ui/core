# AWC UI Data Grid waitlist operations

The landing page remains static Astro on Netlify. Three Netlify Functions provide
signup, unsubscribe, and queued SMTP delivery. PostgreSQL stores subscribers,
versioned offer eligibility, rate budgets, and separate welcome/admin delivery
jobs. The sender is `waitlist@awc-ui.dev`; owner notifications go to
`ionut-valentin.mitrache@awc-ui.dev`.

This is single opt-in: a successful form submission joins immediately. Turnstile
reduces automated abuse but does not establish ownership of the submitted email.
There is no payment, license issuance, public discount code, or commerce account
creation in this feature.

## Activation is deliberately separate from deploying code

The form and server start disabled. Creating the mailbox and Turnstile widget does
not activate them. Complete these steps in order before opening registration:

1. Finalize the personal controller's public identification/contact details and
   review the English privacy notice against the actual database provider,
   hosting regions, retention/deletion procedure, and processors. Do not publish
   placeholder identity details. Record an enrollment closing date; the launch
   and redemption-window dates are not yet known.
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
| `PUBLIC_TURNSTILE_SITE_KEY`       | The public site key for the production widget             |
| `PUBLIC_WAITLIST_CONTROLLER_NAME` | The controller's confirmed public full name               |
| `PUBLIC_WAITLIST_CONTACT_ADDRESS` | The controller's confirmed public contact address         |

Runtime values belong in **Netlify, Production context, Functions scope**. Do not
use an “all deploy contexts” default for any of them.

| Variable                 | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `WAITLIST_ENABLED`       | `true` opens new signup; `false` closes it without breaking unsubscribe            |
| `WAITLIST_EMAIL_ENABLED` | Independent SMTP delivery switch; `false` pauses sending                           |
| `WAITLIST_PRIVACY_READY` | `true` only after the final notice and operational data handling are ready         |
| `WAITLIST_CLOSES_AT`     | Explicit future ISO 8601 timestamp in UTC for enrollment closure                   |
| `WAITLIST_HMAC_SECRET`   | Random secret containing at least 32 bytes; keep a recoverable secret-manager copy |
| `TURNSTILE_SECRET_KEY`   | Secret from the production Turnstile widget                                        |
| `WAITLIST_SMTP_PASSWORD` | Password for the dedicated mailbox                                                 |
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

## Abuse limits and delivery behavior

The initial conservative limits are 1,000 signup attempts/day globally and
30/IP/day, 100 new registrations/day globally and 5/IP/day, and a queue of at most
400 jobs. Each new registration creates two independent jobs. SMTP attempts are
capped at **300 in a trailing 24 hours**, below the documented **500 SMTP sends/day
per mailbox** limit for this GoDaddy plan. Do not share this mailbox with another
sending application or assume the unused capacity guarantees deliverability.

PostgreSQL transactions enforce the application budgets and duplicate constraints
across simultaneous requests. Netlify edge rate limits provide another layer;
their enforcement can lag, so they are not the authoritative quota. A valid
Turnstile challenge does not exempt a request from application limits. A provider
outage must not bypass verification.

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
Netlify's generated manifest for all three functions, API routes, edge rate
limits, schedule, and Node runtime. It does not contact Netlify or send email.

`Deploy` calls the reusable `Waitlist` workflow before building or deploying,
including manual deploys. Existing CI-success, same-repository, main-branch and
commit-matching checks remain in place. Site builds and dependency installation
receive no runtime secrets. Production checks out the verified main commit and
uses the pinned Netlify CLI with `--no-build` to upload the built static artifact
and bundle the three source functions. PR previews retain the static deploy action
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
reservations older than eight days. It never deletes subscribers or outbox jobs,
and it preserves every reservation in the current 24-hour quota window. Do not
manually erase recent reservations or today's budgets while the application is
active. Deletion requests and suppression are separate operations; retain only
the minimum justified suppression/offer records described in the final notice.
Subscriber, outbox, provider-log and backup retention still require the reviewed
operational deletion procedure.

## Provider references

- [Netlify Database SDK and transactions](https://docs.netlify.com/build/data-and-storage/netlify-database/api/)
- [Netlify Database migrations at publication](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/)
- [Netlify function deployment via CLI](https://cli.netlify.com/commands/deploy/)
- [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Netlify rate limiting and enforcement delay](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [GoDaddy website SMTP settings](https://www.godaddy.com/help/set-up-third-party-plugins-or-websites-using-smtp-settings-42788)
- [GoDaddy Professional Email limitations](https://www.godaddy.com/en-ph/help/professional-email-powered-by-titan-account-limitations-31970)
