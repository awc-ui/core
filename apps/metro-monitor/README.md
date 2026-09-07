# Metro pulse

A Metro Stations monitoring showcase using the local **AWC UI** web components through the typed React wrappers. The app lives in `apps/metro-monitor` and uses the local library. Shared AWC text and OTP fields support Enter submission across consuming apps.

## Run

From the repository root, with the core, React, and theme packages built:

```sh
pnpm install
pnpm --filter @awc-ui/metro-monitor dev
```

The preview runs at `http://127.0.0.1:4387`. The app uses workspace dependencies on `@awc-ui/core`, `@awc-ui/react`, and `@awc-ui/theme`; the root workspace lockfile owns dependency installation. Run `pnpm --filter @awc-ui/metro-monitor build` for type checking and a production bundle; `pnpm --filter @awc-ui/metro-monitor test` checks authentication, station filtering, export, simulation, incident transitions, and the optional agent-tool contract.

## Try the authentication flow

1. Choose **Use demo credentials**, then **Sign in** or press **Enter** in a credential field.
2. Enter verification code **246810** and press **Enter** or choose **Verify & continue**. Enter also submits signup and recovery-code forms.
3. Alternatively, choose **Use a recovery code** and enter **METR2026**. A recovery code can be used once per account until reload.
4. To try signup, choose **Create an account**, enter a name, email, and matching passwords of at least 12 characters, acknowledge the temporary account, and complete verification.

Demo email: `operator@metropulse.demo`. Demo password: `MetroDemo!2026`.

Authentication is an **in-memory showcase**, not production security. It makes no email/SMS calls, provides no server-side authorization, and uses a fixed visible demo verification code. New account password hashes are kept only in memory; no passwords or accounts are written to browser storage. Accounts and incident changes reset on reload. Only appearance and sidebar layout preferences are stored locally. A real deployment with real telemetry requires a server-side identity provider, actual MFA enrollment, authorized APIs, secure session handling, and role enforcement.

## Explore

- 15 fictional stations on three lines; a keyboard-operable schematic opens station details.
- Network KPIs, passenger-entry/exit charts, occupancy meters, and sparklines.
- AWC route chips filter the network from the toolbar, station table, and station detail panel; station search, status filters, sorting, pagination, and CSV export.
- Incident acknowledgement/resolution, scoped by line, with active/resolved views.
- Light/dark appearance, a collapsible sidebar with remembered layout and fixed navigation icon positions during its width transition, profile/sign-out in one expanded row and centered when collapsed, and pausable simulated updates every 15 seconds.
- Pulsing station status markers, with reduced-motion support, and an incidents panel that fills the content area.
- Six simulated trains moving along the metro lines, with station stops, terminal reversals, pause/play, 1×/2×/4× speeds, and individual train status. Line filters also filter trains. Network pause in Settings stops both telemetry and train movement; reduced-motion preference starts trains paused.
- Login/signup, code expiry, five-attempt cooldown, cancellation, and single-use recovery.

All locations and values are simulation fixtures, not an actual operator feed.

## Component integration

AWC UI provides app bar, navigation rail, cards, buttons, icon buttons, tooltips, chips, text/password fields, checkbox, OTP fields, select/options, table composition, sorting, pagination, line charts, sparklines, meters, avatars, side sheet, switches, and snackbar. The network diagram is custom SVG because the library has no metro schematic component. The account and simulation footer uses the navigation rail’s built-in `footer` slot for bottom anchoring. Arrays and objects use typed properties; actions use the library's `md*` events. Theme roles cover both appearances.

`src/model.mjs` owns telemetry and selectors. `src/auth.mjs` is the replaceable demo authentication adapter. `src/AuthScreen.tsx`, `src/App.tsx`, and `src/NetworkMap.tsx` contain the UI. Vite/TypeScript aliases resolve the local wrapper dependencies without modifying library package folders. `src/awc-compat.mjs` applies an app-local fix for a recursive formatter/parser accessor in the current direct-custom-element text field build. It preserves formatter updates for both direct and lazy components; remove it when the upstream build includes the same fix.

Optional WebMCP tools are registered only while the demo workspace is signed in. Their contract is unit-tested. Browser verification covers rendered AWC inputs, demo login and MFA, signup and MFA enrollment, and responsive authentication layout. Login and signup fit a 1280 × 720 desktop viewport; the form retains an internal overflow fallback for short screens and enlarged text.
