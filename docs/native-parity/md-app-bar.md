# md-app-bar native checkpoint

Status: **dedicated native renderer (gate 2) and Laboratory integration (gate 3) verified on macOS SwiftUI, the iOS simulator
and the Android emulator** against Mac Chrome 153 oracles (2026-11-12). Accessibility evidence with `tools/ax`: macos 0 open / 4 expected; ios 0 open / 4 expected; android 0 open / 6 expected (4 cases).
Independent final audit pending. Source contract and decisions: [md-app-bar-source-review.md](md-app-bar-source-review.md)
(section "Decisions (autonomous, …, reversible)"). Native plan: [md-app-bar-native-plan.md](md-app-bar-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Element | `AWCNativeView` node `md-app-bar` → the dedicated renderer (`NativeAppBar.swift`) | `AWCComponent("md-app-bar", props, onEvent) { slot -> }` → `NativeAppBar` (`NativeAppBar.kt`) |
| Properties (12) | every IR property as `AWCValue` | same |
| Hooks (38 `--md-app-bar-*`) | `AWCAppBarAppearance` (typed, `values:` or `css:`) + `.awcAppBarAppearance(_:)` | `AWCAppBarAppearance` (typed or `fromCss`) + `AWCAppBarAppearanceScope` |
| Parts (17 `::part()`) | `AWCAppBarPart` + `.awcAppBarPartAppearance(_:part:)` (`AWCAccordionPartAppearance` vocabulary) | `AWCAppBarPartAppearanceScope(part, appearance)` |
| Events `mdLeadingClick`, `mdSearchActivate`, `mdSearchInput` | `onEvent` (`AWCEvent` name, node id, detail) | `onEvent(name, detail)` |
| Slots (headline, subtitle, search, search-trailing, leading, trailing) | child nodes with `slot` | the `content` slot lambda |

Small, medium and large bars (the expanded headline block below the row, start or centred), the search bar (pill, in-pill trailing actions, slotted search content), the leading icon button (mdLeadingClick), the trailing actions (at most three shown; one warning per new excess), scrolled colours with their transitions, density and the spacing rung. The search input as the source: focus activates (mdSearchActivate), typing emits mdSearchInput (Space announces activation first), Enter activates, Home / End move the caret, keyboard focus selects the text and shows the ring; the pill's hover / press state layer, ripple and focus ring.

## Evidence (n5-033, n5-038, n5-046…064, n5-A023…A044; canonical installs n5-056-install-rail-appbar, n5-063-install-settle)

Oracles: `outputs/native-parity/md-app-bar/web-oracle-mac/` (Chrome 153, DPR 1), converted byte-identically into the Swift fixtures
(`packages/native-ios/Tests/Fixtures/app-bar-web-{paint,paint-parts,states,states-reduced}.json + shot directories`) and the Android assets (`apps/native-android-playground/src/androidTest/assets/app-bar-web-*(.json, shot directories)`).

| Run | Result |
| --- | --- |
| macOS SwiftUI paint (`NativeAppBarPaintIntegration`: variants, search, hooks, typed parts) | 2217/2217 |
| macOS SwiftUI states (`NativeAppBarStatesIntegration`: search pointer / keyboard, scrolled transitions, leading pointer / keyboard, trailing cap, runtime properties; + reduced motion) | 1397/1397 |
| iOS simulator AWC-n5-pad (same suites, `apps/native-ios-parity`) | paint 2217/2217, states 1397/1397 |
| Android emulator-5560 (`NativeAppBarPaintTest`, `NativeAppBarStatesTest`) | paint pass, states 1281/1281 |
| Laboratory | studio `appbar-integration.test.mjs` (38 hooks, retained updates of every source property, typed part examples); SwiftUI live host `test-live-nav.mjs` 19 checks (schema-validated frames; 15 of 15 runs after the timeline fix, 8 of 10 before: n5-062); Android `LivePreviewNavHostTest` app-bar hooks and updates; compiled examples (Swift typecheck + Kotlin compile) |
| Canonical tree after the installs (n5-056, n5-063; macOS) | paint 2217/2217, states 1397/1397; `test-live-nav.mjs` 5/5 runs |
| Accessibility (`tools/ax`) | macos 0 open / 4 expected; ios 0 open / 4 expected; android 0 open / 6 expected (4 cases) — `outputs/native-parity/md-app-bar/accessibility/report.md` |

## Accessibility model

Web: <header role=banner> (unnamed) holding the leading icon button (named by `leadingIconLabel`), the headline / subtitle text, the search input (role=searchbox named by `searchAriaLabel`) and the trailing actions. Native: the same elements, names and Tab order (leading button, search input, actions) without the banner landmark (no platform exposes one here: see the decisions). macOS: AXButtons, static text, the search input an AXTextField with the AXSearchField subrole; Tab from the input goes through the field editor to the next action. iOS: a container (SwiftUI .contain) with the buttons, text and the search field (searchField trait). Android: the controls in layout order, the search input an EditText named by the search label with the Search IME action. Reviewed conventions: `tools/ax/expectations.mjs` (md-app-bar entries).

## Exceptions

None: every property, event, method, slot and hook is implemented natively (12 properties, 3 events, 0 methods, 6 slots, 38 hooks (the stylesheet's; the CEM lists 32), 17 parts).

## Remaining

Independent final audit. Open finding (cause not confirmed): the Android states run `leading-pointer-light-ltr leave` failed twice while the Mac was loaded by other suites (the leading icon button still tinted, alpha ≈ 0.05, in the +384 ms shot; 2026-11-08 n5-A042 first run, n5-A043) and passed in 14 later runs; hypothesis: the test harness's real-time steps (the stitched pixel capture, the hover-exit delivery) against the paused test clock under load.
