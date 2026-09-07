# Medflow — AWC UI hospital case management

An interactive hospital enterprise UI showcase built directly with the local `@awc-ui/core` web components. The plain JavaScript SPA follows the repository's `main-llm.md` and component APIs. It is a demo, with fictional patients and simulated authentication; it has no medical-record or identity backend.

## Run in the core monorepo

Use the repository's supported Node version (22.13+ or 24+) and pnpm. The existing core and theme packages must be built first.

```sh
pnpm --filter @awc-ui/medflow dev
```

Open `http://127.0.0.1:4397`. Set `PORT` to change the port. The server binds to loopback only. `dev` builds once before serving; after source changes, run `pnpm --filter @awc-ui/medflow build` and reload.

```sh
pnpm --filter @awc-ui/medflow build
pnpm --filter @awc-ui/medflow lint
pnpm --filter @awc-ui/medflow test
```

Build output in `dist/` is self-contained, with bundled local fonts and AWC UI runtime assets. No remote CDN requests or new runtime packages are required. Outside the monorepo, set `AWC_CORE_ROOT` to the existing core checkout.

## Included workflows

- Overview with case counts, fictional patient-flow chart, priority worklist, and recent coordination activity.
- Search, filter, sort, page, and export fictional cases; export respects the current filters.
- Single and bulk clinician assignment, with availability and capacity validation.
- Case details in a side sheet, status progression, coordination notes, and case timelines.
- New patient cases with validated form fields; assignment required before progression beyond New. Discharge requires Ready for discharge. Discharged records are read-only.
- Care team with caseload meters and department chart; clinician cards link to their assigned cases.
- Login, signup, six-digit MFA, one-use recovery, signout, expiry, and attempt-limit feedback.
- A “Make it yours” settings button beside the avatar, matching the Frame showcase’s native side sheet. Includes English/Arabic language selection, a primary color picker with presets and hex entry, five density levels, RTL, light/dark appearance, and reset to defaults. Preferences apply immediately and survive reload.
- Arabic workspace and authentication screens, automatic RTL on language selection, localized Gregorian dates and numerals, and Arabic/Persian digit input for verification. Patient names, identifiers, entered summaries, and notes retain their original content. Language selection is also available on sign-in, signup, and verification screens.
- Native `md-skeleton` placeholders while workspace components initialize, with retry feedback if loading fails. Pending actions use the existing button loader slot and `md-progress-indicator`, block duplicate submissions, and restore controls after success or failure. Loading follows actual readiness/work without fixed demo delays.
- Native collapse/expand desktop navigation with a saved preference, mobile navigation, skip link, keyboard interaction, and modal focus management.
- Full-width activity and department-chart panels that resize with the navigation rail.

## Demo credentials

| Field    | Value                     |
| -------- | ------------------------- |
| Email    | `sarah.chen@medflow.demo` |
| Password | `MedflowDemo!2026`        |
| MFA      | `246810`                  |
| Recovery | `MEDF2026`                |

The sign-in page includes a **Use demo credentials** button. Signup accepts fictional details and a sample password of at least 12 characters, then requires demo verification. A challenge expires in five minutes and locks after five failed attempts. Recovery is consumed for the page lifetime. Passwords are discarded, profiles and case edits live in memory, and only appearance (including the generated color palette), density, language, layout direction, and navigation expansion preferences use localStorage. Reload resets the demo.

The overview is intentionally accessible as a public demo workspace. Successful MFA establishes only an in-memory demo profile. Routes and sample codes are not security boundaries. The activity log is illustrative, not a durable or tamper-evident audit log. Production use requires server-side identity/MFA, authorization, records persistence, and an appropriate operational review; this app must not receive real patient records.

## AWC UI composition

The app uses `md-app-bar`, desktop `md-navigation-rail`, mobile `md-navigation-bar`, `md-card`, `md-list` / `md-list-item`, `md-status-dot`, the `md-table` family (selection, sorting, pagination, bulk-action toolbar), `md-chip` filters and status labels, `md-stepper` / `md-step` for authentication progress, `md-text-field`, `md-number-field`, `md-select`, `md-checkbox`, `md-otp-field`, `md-switch`, `md-avatar`, `md-meter`, `md-sparkline`, `md-line-chart`, `md-bar-chart`, `md-dialog`, `md-side-sheet`, `md-color-picker`, `md-tooltip`, `md-button`, `md-icon-button`, and `md-snackbar`. The local `@awc-ui/theme` package generates matching light/dark palettes from the selected primary color; semantic clinical status colors retain the library’s roles.

Anchored dropdowns use the shared `md-menu` native popover layer, so they can extend beyond clipped dialogs and sheets. They retain their original DOM ownership, localized styles, and option references. Escape closes the innermost popup before its parent overlay; closing an owner also dismisses its popup.

Priority, case status, and clinician availability use the existing `md-chip` with its `appearance="filled"` and semantic `color` API. Activity entries use `md-list` / `md-list-item`, notes and notices use `md-card`, and selection counts use `md-table-toolbar`. The rail uses its built-in `expandable` control and documented events. Keep the workspace shell mounted between routes; update its active destination and counts in place so navigation does not restart hydration or animations. Keep label visibility stable during the native transition and preserve the hospital header footprint when collapsed. Use a single logo slot so the brand mark does not dim during a duplicate-logo crossfade, and keep the rail/toggle at their matching native 80px/40px footprints so compact density cannot shift the focus ring. Array/object APIs are assigned as JavaScript properties. The personalization panel reuses Frame’s existing side-sheet pattern. Color previews use `mdInput`, committed changes use `mdChange`, and the library-generated stylesheet is cached before first paint. The default color preserves Medflow’s authored palette. Density 0 removes `data-density`; RTL sets the document’s logical direction. Actions use documented `md*` events; form-associated components participate in native FormData and constraint validation.

Use the existing library component before adding UI markup. Do not create replacement chips, cards, lists, selection toolbars, or step indicators. Keep application CSS for layout, typography, and supported component tokens; look up the current component manual in `core/packages/core/src/components` before choosing APIs.

## Source map

- `src/app.js`: routing, state orchestration, events, assignments, case forms, CSV export.
- `src/views.js`: application shell and screen composition.
- `src/model.js`: deterministic fictional records and immutable domain transitions.
- `src/auth.js`: authentication view and pure demo challenge logic.
- `src/styles.css`, `src/auth.css`: shared light/dark theme and responsive layouts.
- `src/feedback.js`, `src/bootstrap.js`: native skeleton composition, component readiness, action progress/duplicate guards, and loading recovery.
- `src/i18n.js`, `src/locales/`: English source messages and Arabic translations, localized numbers, and verification-digit normalization. Canonical department/status values remain language-independent; only seeded summaries and notes are translated.
- `src/preboot.js`: restore appearance, density, language, direction, and rail preferences before first paint.
- `scripts/`: zero-install build/preview scripts and Node test suite.

## Verification

40 unit/regression tests, verified on Node 24.19.0, cover immutable transitions, bulk capacity, discharged-case guards, field validation, escaping, challenge expiry/attempt limits/recovery, and consistency between critical counts and queues. Browser checks cover patient search, assignment, note creation, patient creation, table sorting/paging, login, bad-code feedback, successful MFA, signup/recovery, mobile navigation, and light/dark rendering. Desktop and 390px mobile views were inspected. Additional checks verified rail expansion by keyboard, persistence across navigation/reload, full-width panels at 1920px, table selection and filter menus after cell-spacing corrections, persistent rail identity across navigation/reset/assignment, and unchanged tab positions when collapsing/expanding; no console errors were reported in the checked flows. Personalization checks cover native picker presets and hex entry, dark/light color changes, minimum/default density, RTL layout at desktop and 390px, persistence across reload, and focus returning to the settings trigger. Generated palettes passed 88 text-contrast checks across the six presets plus black and white seeds (minimum 6.427:1), including sidebar text and active labels. The 22 original custom light/dark text-color pairs tested exceed 4.5:1 contrast (minimum 5.75:1). Arabic checks cover sign-in and MFA with Arabic numerals, Arabic case creation and clinician assignment, language switching with unchanged entered data and mounted rail/settings elements, saved language, and 390px mobile settings/authentication layouts without document overflow. Some internal AWC screen-reader strings (such as table sort announcements) remain English where the current library exposes no localization API. This is not a full accessibility conformance audit.

The loading/overlay update passed 40 app tests, 228 focused component spec checks (run as separate suites), and live desktop/mobile browser checks for popup selection beyond modal bounds, Escape/focus, language switching, assignment, authentication, and native skeleton/progress rendering. Six automated browser regression cases are included in the core menu suite; this session could not launch its headless Chromium runner because macOS sandbox process permissions blocked it.

Loading feedback hides content in place and preserves connected component instances; it must not reparent initialized charts or form controls. Lifecycle regression tests use the core package’s existing jsdom dependency and cover chart/input identity, prior inert state, and overlapping loading cleanup. Verification and recovery-code rows plus supporting text are centered through the existing OTP component’s CSS part.
