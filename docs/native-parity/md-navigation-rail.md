# md-navigation-rail native checkpoint

Status: **dedicated native renderer (gate 2) and Laboratory integration (gate 3) verified on macOS SwiftUI, the iOS simulator
and the Android emulator** against Mac Chrome 153 oracles (2026-11-12). Accessibility evidence with `tools/ax`: macos 0 open / 0 expected; ios 0 open / 4 expected; android 0 open / 8 expected (4 cases).
Independent final audit pending. Source contract and decisions: [md-navigation-rail-source-review.md](md-navigation-rail-source-review.md)
(section "Decisions (autonomous, …, reversible)"). Native plan: [md-navigation-rail-native-plan.md](md-navigation-rail-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Elements | `AWCNativeView` nodes `md-navigation-rail` / `md-navigation-rail-tab` → the dedicated renderer (`NativeNavigationRail.swift`) | `AWCComponent("md-navigation-rail" / "md-navigation-rail-tab", props, onEvent) { slot -> }` → `NativeNavigationRail` / `NativeNavigationRailTab` (`AWCNavigationRail.kt`) |
| Properties (15 + 12) | every IR property as `AWCValue` | same |
| Hooks (19 `--md-navigation-rail-*`, 18 `--md-navigation-rail-tab-*`) | `AWCNavigationRailAppearance` / `AWCNavigationRailTabAppearance` (typed, `values:` or `css:`) + `.awcNavigationRailAppearance(_:)` / `.awcNavigationRailTabAppearance(_:)` | the same types (typed or `fromCss`) + `AWCNavigationRailAppearanceScope` / `AWCNavigationRailTabAppearanceScope` |
| Parts (15 + 7 `::part()`) | `AWCNavigationRailPart` / `AWCNavigationRailTabPart` + `.awcNavigationRailPartAppearance(_:part:)` / `.awcNavigationRailTabPartAppearance(_:part:for:)` (`AWCAccordionPartAppearance` vocabulary) | `AWCNavigationRailPartAppearanceScope(part, appearance)` / `AWCNavigationRailTabPartAppearanceScope(part, appearance, id)` |
| Methods `expand()`, `collapse()`, `toggle()`, `focusTab(i)`; `clearSubmenuSelection()` | `AWCNavigationRailController` + `.awcNavigationRailController(_:)` | `AWCNavigationRailController` + `AWCNavigationRailControllerScope` |
| Events `mdTabChange`, `mdExpand`, `mdCollapse`; `mdTabClick`, `mdSubmenuToggle` | `onEvent` (`AWCEvent` name, node id, detail) | `onEvent(name, detail)` |
| Slots (default, logo, logo-expanded, header, fab, footer-leading, footer-content, footer; icon, submenu) | child nodes with `slot` | the `content` slot lambda |

Standard (80) and expanded (220) rails with the width transition and the destinations' FLIP, the modal overlay with its scrim, the horizontal bar, top / middle / bottom alignment, label visibility all / selected / none, density, overflow into a menu, badges, link destinations, submenus, the logo / header / FAB / footer slots; one roving tab stop with arrows on the visual axis, Home / End, Enter / Space, Escape and the scrim in a modal; a single destination outside a rail renders and activates on its own. A hidden destination keeps its index and takes no box.

## Evidence (n5-038…064, n5-A026…A043; canonical installs n5-056-install-rail-appbar, n5-063-install-settle)

Oracles: `outputs/native-parity/md-navigation-rail/web-oracle-mac/` (Chrome 153, DPR 1), converted byte-identically into the Swift fixtures
(`packages/native-ios/Tests/Fixtures/rail-web-{paint,paint-parts,states,states-reduced}.json + rail-web-paint{,-parts}/`) and the Android assets (`apps/native-android-playground/src/androidTest/assets/rail-web-*(.json, shot directories)`).

| Run | Result |
| --- | --- |
| macOS SwiftUI paint (`NativeNavigationRailPaintIntegration`: the Chrome paint matrix, hooks, typed parts, the hidden destination) | 19563/19563 |
| macOS SwiftUI states (`NativeNavigationRailStatesIntegration`: pointer, keyboard, programmatic, expand / collapse, rapid reverse, modal Escape / scrim; + reduced motion) | 543580/543580 |
| iOS simulator AWC-n5-pad (same suites, `apps/native-ios-parity`) | paint 19563/19563, states 541674/541674 |
| iOS simulator iPhone 26.3 AWC-n5 (states, shim v5 + the `AWCShimTouch.onScreen` fix of story 9-14; the earlier count in this table is the iPad's) | states 542903/542903, 542679/542679, 542503/542503; paint 19563/19563 |
| iOS simulator iOS 18.6 AWC-n5-18 (same) | states 542723/542723, 542619/542619 |
| iOS simulator iPad 26.3 AWC-n5-pad (shim v5 + fix) | states 542367/542367 |
| Members (`toggleLabel`, `disableFocusManagement`, `overflowIcon`, `mdSubmenuToggle`; story 9-14) | macOS `NativeNavigationRailMembersIntegration` 21/21; Android `NativeNavigationRailMembersTest` 1/1; each has a recorded mutation run that fails |
| Android emulator-5560 (`NativeNavigationRailParityTest`, `NativeNavigationRailStatesTest`) | paint 19416/19416, states 542487/542487 |
| Laboratory | studio `rail-integration.test.mjs` with the navigation suites (studio 865 pass / 0 new failures vs canonical); SwiftUI live host `test-live-nav.mjs` 33 checks (every frame validated by the Laboratory inspection schema; 15 of 15 runs after the timelines settle, n5-062 / n5-064); Android `LivePreviewNavHostTest` 7/7 (rail hooks / updates / methods, hidden destination, content inside its destination, a destination alone); compiled examples (97 Swift typecheck + 97 Kotlin compiled with the androidTest sources, across the navigation components) |
| Canonical tree after the installs (n5-056, n5-063; macOS) | paint 19563/19563, states 543650/543650; `test-live-nav.mjs` 5/5 runs |
| Accessibility (`tools/ax`) | macos 0 open / 0 expected; ios 0 open / 4 expected; android 0 open / 8 expected (4 cases) — `outputs/native-parity/md-navigation-rail/accessibility/report.md` |

## Accessibility model

Web: a navigation landmark named by `label` around a tablist of the same name, destinations role=tab (aria-selected), link destinations links, the toggle a button with aria-expanded, badges named in the destination ("N new notifications"). macOS: an AXGroup with the AXLandmarkNavigation subrole named by the label (AppKit landmark bridge) holding the rail's controls and an AXTabGroup of the destinations (selected state) — the Web tree. iOS: a labelled container (SwiftUI .contain) whose destinations VoiceOver reads as tabs (button + selected trait); UIKit has landmarks only as a container type. Android: a traversal group whose contentDescription is the label, read before its destinations (Role.Tab + selected). Same Tab order as the Web on every platform (toggle, then the active destination; arrows move between destinations). Reviewed conventions: `tools/ax/expectations.mjs` (Navigation entries).

## Exceptions

None: every property, event, method, slot and hook is implemented natively (md-navigation-rail: 15 properties, 3 events, 4 methods, 8 slots, 19 hooks, 15 parts; md-navigation-rail-tab: 12 properties, 2 events, 1 method, 2 slots, 18 hooks, 7 parts).

## Remaining

Independent final audit.
