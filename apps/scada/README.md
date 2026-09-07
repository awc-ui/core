# Sentinel — SCADA monitoring with AWC UI

Sentinel is a working frontend showcase for a fictional water-treatment plant. It uses 45 AWC UI component types from this core checkout, with self-hosted Roboto and Material Symbols. It follows the repository's `main-llm.md`, component manuals, and dashboard/authentication recipes.

## Run in the core monorepo

Requires Node 22.13+ and the built library at `packages/core/dist/md3`.

```sh
pnpm --filter @awc-ui/scada dev
```

Open [Sentinel locally](http://127.0.0.1:4495). Set `PORT=4496` if the default port is occupied. The server binds only to loopback.

```sh
pnpm --filter @awc-ui/scada build
pnpm --filter @awc-ui/scada lint
pnpm --filter @awc-ui/scada test
```

The app adds no bundler or framework. Its build copies the existing AWC runtime and lazy chunks into `dist/awc`, then includes the application and fonts. In a standalone copy, use:

```sh
AWC_CORE_ROOT=/absolute/path/to/core node scripts/build.mjs
node scripts/serve.mjs
```

The account footer uses the library’s `footer-leading` and `footer-content` slots. The component source change is also included in `library-patches/navigation-rail-footer.patch` for standalone copies; the core checkout already contains it. Rebuild the library after applying the patch to another checkout.

To preview updated source, run the build again and refresh. The server serves the built output; it does not provide hot module replacement.

## What works

- Overview with simulated four-second telemetry, coherent KPI/chart endpoints, equipment health, and a process path.
- Asset filtering by name/tag and process area, sorting, pagination, and inspection side sheets.
- Alarm severity and acknowledgment filters, operator notes, acknowledgment confirmation, and reset confirmation.
- Flow, pressure, and power trends over 1/6/24 hours, chart zoom, pressure advisory line, and CSV downloads.
- Login, signup, six-digit MFA, recovery-code verification, expiry/error states, and sign-out.
- Native skeletons for route content and equipment inspection, table skeleton rows, chart loading overlays, and button progress for submissions, CSV exports, acknowledgment, reset, and sign-out.
- Dark/light themes, compact density, paused/resumed simulation, an expandable native navigation rail, native mobile bottom navigation, library breadcrumbs, and a component explorer.

## Component coverage

The app-wide component audit is recorded in [COMPONENT-AUDIT.md](COMPONENT-AUDIT.md). Status markers use `md-status-dot inline size="small"`, and native AWC components own list rows, table toolbars and empty states, badges, disclosure surfaces, and account-verification progress.

## Authentication demo

Select **Sign in → Use demo credentials → Continue to verification**.

| Field             | Sample                  |
| ----------------- | ----------------------- |
| Email             | `operator@example.test` |
| Password          | `DemoPass!2026`         |
| Verification code | `482916`                |
| Recovery code     | `AWCDEMO1`              |

Signup validates a full name, email, a password of at least 12 characters, matching confirmation, and acknowledgment that this is a demo. It creates an in-memory challenge, then a tab-scoped demo profile after successful verification. Challenges expire in five minutes and reject verification after five failed attempts; sign in again to start a new challenge.

**This is not production authentication.** No identity provider, credential database, email/SMS delivery, real authenticator enrollment, or SCADA backend is connected. The sample codes are public. The showcase does not protect data behind its demo login. Passwords and codes are never saved. Only demo name/email/MFA state are stored in sessionStorage, cleared by sign-out or closing the tab. Signup does not create a reusable account.

The hosted preview's owner-only access is enforced separately by Sites, not by the demo forms.

## Data and state

All plants, assets, addresses, events, and observations are simulated. No physical devices are contacted or controlled. The historian uses a labeled fictional session beginning on 7 September 2026 at 14:36 UTC; it advances by four seconds per simulation tick.

Offline signals retain a missing value; they never become zero. Standby pump flow remains zero. Alarm acknowledgment records operator review without changing or claiming to resolve the equipment condition. Alarms and notes live only in page memory and reset on reload. Theme and density are device-local preferences.

CSV exports label every record as simulated and escape formula-leading text.

## Structure

- `src/app.js`: routes, monitoring UI, charts, alarms, exports, and overlays.
- `src/auth.js`: login/signup/MFA views and form handling.
- `src/loading.js`: shared pending-action guards and native skeleton compositions.
- `src/model.js`: fixtures, selectors, telemetry, validation, and challenge checks.
- `src/styles.css`: theme roles, responsive layout, and documented component styling.
- `src/webmcp.js`: optional read-snapshot and open-asset tools, feature-detected.
- `scripts/`: Node-only build, server, and regression tests.
- `public/`: icon, self-hosted fonts, and their licenses.

Charts receive array/object properties directly. The table renders its own rows in response to the documented sorting and pagination events. Forms use named, form-associated AWC controls. Dialogs/sheets use the library's focus management. Hash routes support static hosting under a path prefix.

## Validation

Automated tests cover selection/filtering, immutable alarm acknowledgment, signup validation, MFA correctness/expiry/attempt limits, offline and standby values, historian ranges, consistent chart endpoints, escaping, and rendering all authentication screens.

Syntax checks and the deployment build pass. All 45 emitted component tags have manuals in the local library. The primary body/secondary text and primary button color pairs exceed 4.5:1 in both themes.

A component browser regression measured zero avatar anchor drift while expanding, collapsing, and reversing direction across LTR, RTL, custom sizing, and modal rails. It also checked horizontal footer visibility and suppression of focus in collapsed text. The full application’s browser interactions and keyboard-only flows have not been independently exercised. Optional WebMCP support has not been validated in a supporting browser context; it is not required for any ordinary UI flow.


“Make it yours” opens beside the sidebar account avatar, from the app bar when the rail is collapsed, and from Settings. The native color picker uses `@awc-ui/theme` to derive complete light/dark palettes; five density levels and RTL update the whole document. Preferences persist locally, and Reset defaults restores Sentinel's original teal theme, cozy density, and LTR. No account is required.


English and Arabic are available under **Make it yours → Language**. Selecting Arabic sets `lang="ar"` and RTL; selecting English restores LTR. Language is saved locally. Translation updates text and accessible component labels in place, preserving fields, filter values, routes, equipment IDs, and verification codes. Equipment search accepts English or Arabic names. The standalone top-bar theme button was removed; theme selection remains in Make it yours and Settings.

## Loading and action feedback

Route changes and equipment inspection use `md-skeleton` in the existing card/grid layout. The asset route uses the native table's skeleton loading mode. Signal and range changes use `md-line-chart.loading`; the chart is temporarily inert while its data changes, with an external localized status. Routine telemetry ticks and immediate filters/preferences remain uninterrupted.

Authentication, MFA/recovery, CSV preparation, alarm acknowledgment/reset, and sign-out use `md-button.loading` and its built-in AWC loading indicator. The native loader retains foreground contrast, density, and reduced-motion behavior. One shared runner prevents duplicate work, snapshots inputs before disabling fields, restores controls in `finally`, and cancels stale actions after navigation or dismissal. MFA and recovery share a verification lock. Errors preserve entered fields.

Because this is a local simulation, these flows include a brief 450 ms demo loading phase. Indicators remain indeterminate; exports report only that the browser download has started. English and Arabic status labels are announced outside busy regions. No network service or device operation is implied.
