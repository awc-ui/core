# md-navigation-bar native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against
Mac Chrome 153 oracles (2026-10-30), for `md-navigation-bar` and its child `md-navigation-tab`. Independent final audit
pending. Source contract: [md-navigation-bar-source-review.md](md-navigation-bar-source-review.md); plan:
[md-navigation-bar-native-plan.md](md-navigation-bar-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Bar and destination nodes (`AWCNativeView` / `AWCComponent`) | dedicated renderers (`NativeNavigationBar.swift`) | dedicated renderers (`AWCNavigationBar.kt`) |
| Hooks: 7 bar + 22 destination (passed down to every destination; a destination's own values win) | `AWCNavigationBarAppearance` / `AWCNavigationTabAppearance` + `.awcNavigationBarAppearance(_:)` / `.awcNavigationTabAppearance(_:)` | `AWCNavigationBarAppearance` / `AWCNavigationTabAppearance` + `…Scope` |
| `select(index)`, `focusTab(index)`; `focusEl()` | `AWCNavigationBarController`; `AWCNavigationTabController` | same |
| Events | `mdChange { index, previousIndex }`, `mdTabClick { index }` (cancelable link following) | same |

Behaviour mirrors the source: the full-width row of equal destinations (flex 1 1 0, min 64), surface-container, the
density-tapered 64-point height, the top divider, corners, elevation and z-index hooks; selection with `activeIndex`
truncated and clamped to an activatable destination (forward, then backward; −1 when none), clicks, Enter/Space, arrows
(automatic activation unless `manualActivation`, mirrored in RTL, soft-disabled destinations reachable but never
activated), Home/End; programmatic writes and `select()` announce `mdChange`; one Tab stop (the active destination);
`labelBehavior` (always / selected / none) passed to destinations without their own authored value; the 56 × 32
indicator pill (scaleX 200 ms emphasized-decelerate, opacity 100 ms), active icon and the icon / active-icon slots, the
label (600 active / 500 inactive, hidden but named in selected mode, absent in icon-only mode), dot and capped large
badges (`badgeMax`), hard and soft disabled, hover/press/focus state layers (8/12/10 %), the focus ring and the md-ripple
wave; links follow `href` / `target` through the host URL router unless `mdTabClick` is prevented. Reduced motion removes
the transitions (the ripple stays).

## Evidence

Oracles (`outputs/native-parity/md-navigation-bar/web-oracle-mac/`, Chrome 153, DPR 1, trusted input; job n1-056) are
shared by `packages/native-ios/Tests/Fixtures/navbar-web-*` and the Android assets `NavigationBarWeb*`: 77 paint cases
with PNGs, 7 interaction/motion runs and 7 reduced-motion runs.

| Run | Result |
| --- | --- |
| macOS SwiftUI `NativeNavigationBarPaintIntegration` / `NativeNavigationBarStatesIntegration` | 14,500/14,500 · 189,386/189,386 |
| iOS simulator (AWC-n1, iPhone 17 Pro, iOS 26.3.1) paint / states | 14,500/14,500 · 189,386/189,386 |
| Android emulator `NativeNavigationBarParityTest` paint / states | 13,123/13,123 · 189,338/189,338 (n1-A128) |
| Android `LivePreviewNavigationBarHostTest` | 2/2 (n1-A128) |

## Laboratory (gate 3)

- **Recipe:** a three-destination bar in both fixtures.
- **Styles panel:** the 29 bar hooks (`navbar-appearance.js`) and the 22 destination hooks on the destination page.
- **Properties:** retained updates for the bar (activeIndex, labelBehavior, manualActivation, density) and the
  destination (active, disabled, softDisabled, label, icon, activeIcon, badge, badgeValue, badgeMax, href, target,
  labelBehavior, density); **methods:** `select`, `focusTab`, `focusEl` (events returned).
- **Examples:** 17 SwiftUI examples typecheck and 17 Compose examples compile.

| Run | Result |
| --- | --- |
| Studio `navbar-integration.test.mjs` / all studio suites | 3/3 · 769/769 (n1-A125) |
| SwiftUI live host `test-live-navbar.mjs` | 27/27 (n1-A128) |
| Android `LivePreviewNavigationBarHostTest` | 2/2 |

## Accessibility (tools/ax)

Cases `bar`, `manual` (md-navigation-bar), `destination`, `soft-disabled` (md-navigation-tab): **0 open findings** on
macOS, iOS and Android (n1-A128, `outputs/native-parity/_ax-n1/`).

- macOS: as Chrome, the host is a navigation landmark (`AXGroup`/`AXLandmarkNavigation`, named by the bar's
  `aria-label`) holding an unnamed tablist (`AXTabGroup`) of tabs with their selected state; Tab enters at the active
  destination.
- iOS: destinations are buttons with the selected trait; UIKit exposes landmarks only as containers (documented
  expectation for the navigation landmark).
- Android: destinations carry `Role.Tab` and the selected state in a traversal group (collection); Compose has no
  landmark role (documented expectation).

## Installation

Installed in the canonical tree through the main queue: n1-067 (renderers, Laboratory integration, docs; native compiler, studio tabs + navigation-bar suites 6/6, Swift package build, Android compile, Laboratory APK); every install was applied to a copy of the tree first. Verified on the canonical tree on 2026-10-30 (n1-069): the Laboratory playground rebuilt with SwiftPM's build-manifest cache disabled (n1-067's playground build had reused a manifest from before the install), SwiftUI live host 27/27, studio suite 775/778 (the 3 failures are md-text-field's), Laboratory server restarted, macOS tools/ax on the canonical build 4 cases with 0 open findings (`outputs/native-parity/_ax-n1-canonical/`).

## Gate-7 fixes (d6, 2026-10-31)

Evidence: `work/d6-lab/out/` (jobs d6-002…d6-007, d6-A001; canonical install `d6-install-1`). Re-applied to canonical with the
anchored patch scripts in `work/d6-lab/` (r601, r608, r610, r614).

### iOS simulator (gate 6, R6-07)

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
| --- | --- | --- | --- |
| `NativeNavigationBarPaintIntegration` | 14500/14500 | 14500/14500 | 14500/14500 |
| `NativeNavigationBarStatesIntegration` | 189384/189386 | 189386/189386 | not run |

Xcode 26.3, `apps/native-ios-parity` harness (`work/d6-lab/harness.sh`), d6's own simulators (AWC-d6, AWC-d6-ipad, AWC-d6-18).

### Findings

- **R6-14 (CEM).** The ten md-navigation-tab hooks without a header description (indicator, icon, label, state-layer and
  badge colours) were invisible to the docs generator; each now has its description and the regenerated CEM lists them.
- **R6-11 (`--md-navigation-tab-slotted-icon-font`): open.**
- **R6-03 (parts): open** (see Remaining).

## Remaining

Independent final audit.
