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

## Gate-7 fixes (d6, 2026-10-31 … 2026-11-05)

Evidence: `work/d6-lab/out/` (jobs d6-002…d6-031, d6-A001…d6-A007, d6b-001…005); canonical installs `d6-install-1` (d6-009),
`d6-install-2` (d6-019) and `d6-install-3` (d6-032), each re-applying the anchored, pre-image-checked patch scripts in
`work/d6-lab/` (r601, r608, r610, r614, r603/*, r611, r609*) with automatic rollback.

### iOS simulator (gate 6, R6-07)

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
| --- | --- | --- | --- |
| `NativeNavigationBarPaintIntegration` | 16159/16159 | 16159/16159 | 16159/16159 |
| `NativeNavigationBarStatesIntegration` | 189386/189386 | 189386/189386 | 189374/189374 |

Xcode 26.3, `apps/native-ios-parity` harness (`work/d6-lab/harness.sh`), d6's own simulators (AWC-d6, AWC-d6-ipad, AWC-d6-18), on the
installed code (job d6-030, logs `work/d6-lab/out/ios-final/console-<simulator>-<suite>.log`).

### Findings

- **R6-14 (CEM).** The ten md-navigation-tab hooks without a header description (indicator, icon, label, state-layer and
  badge colours) were invisible to the docs generator; each now has its description and the regenerated CEM lists them.
- **R6-11 (`--md-navigation-tab-slotted-icon-font`).** Fixed (d6). The hook is a CSS family *list*: natively the first available family lays out text slotted as an icon (generic families as Chrome maps them — system-ui → the system font; Apple: sans-serif Helvetica, serif Times, monospace Menlo; Android: the platform sans-serif / serif / monospace; a named family when installed), at the icon size, centred on the 24 px icon box and never truncated (the source's inline-flex box lets the run overflow both sides). Before, SwiftUI passed the raw list to `Font.custom` as one family name (the system font in practice) and truncated runs wider than the box; Compose parsed the hook but never applied it and drew slotted text in the default text style. Oracle: Mac Chrome `navbar.html?slotted-font` (`slotted-text-icon`, `hook-tab-slotted-icon-font`, `-dark-rtl`; `Menlo, monospace`; the run's box from a Range): SwiftUI x / width / centre / size / colour in NativeNavigationBarPaintIntegration (16159/16159, d6-022, d6-026); Compose: the resolved family, the centring and the monospace run width (within 1 px) in NativeNavigationBarParityTest (d6-A006, d6-A007).
- **R6-03 (parts).** Typed: md-navigation-tab `AWCNavigationTabPartAppearance` (`.awcNavigationTabPartAppearance(_:for:)` / `AWCNavigationTabPartAppearanceScope`) — state-layer (colour, opacity), icon, label and indicator colours, badge fill and text; md-navigation-bar `AWCNavigationBarPartAppearance` — the bar's container background. Part rules come from the outer tree, so a typed value wins over the hooks and every internal state rule (a state-layer opacity shows in every state), as `::part()` rules do in Chrome. Oracle: Mac Chrome 153 `::part()` cases (6 cases in `_nav-web-reference/navbar.html?parts`: light / dark × LTR / RTL, selected labels, label-only; job d6-016). SwiftUI: NativeNavigationBarPaintIntegration 16159/16159 (macOS, d6-026); Compose: NativeNavigationBarParityTest pass (d6-A003, d6-A007; the probe's `color` is the host colour, `iconColor` the icon ink). Laboratory: `visualParts` in both support policies and copyable SwiftUI / Compose examples for every typed part (22 SwiftUI examples typecheck (d6-026), 22 Compose examples compile (d6-A007)).

#### Typed box target (gate-7 R6-17): md-navigation-tab ::part(container)

`::part(container)` of md-navigation-tab is the destination's column (indicator, icon, label); it is 100 % of the tab plus its border and padding, so it overflows the tab and the bar ends as in Chrome. It is a typed part target, not an exception: `AWCPartBox` (background, border width / colour, border radius, padding shorthand; physical edges, content-box) on `AWCNavigationTabPartAppearance(container:)` for SwiftUI and `AWCNavigationTabPartAppearance(container:)` for Compose, taking layout space around the wrapper's content as in Chrome (everything inside and after it shifts), and the Laboratory's `visualParts` / copyable examples carry it. Oracle: Mac Chrome 153 `::part(container)` box cases merged into the paint fixtures; paint checks compare the typed box (background, border, radius, padding) and the wrapper geometry, plus flat pixels, on macOS, iOS and Android ([NativeNavigationBarPaintIntegration.swift](../../packages/native-ios/Tests/NativeNavigationBarPaintIntegration.swift), [NativeNavigationBarParityTest.kt](../../apps/native-android-playground/src/androidTest/java/dev/awc/playground/NativeNavigationBarParityTest.kt)).

#### Typed box target (gate-7 R6-17): md-navigation-tab ::part(icon-container)

`::part(icon-container)` of md-navigation-tab is the indicator-sized box around the icon; its border and padding grow it, the badge and the focus ring follow its padding box. It is a typed part target, not an exception: `AWCPartBox` (background, border width / colour, border radius, padding shorthand; physical edges, content-box) on `AWCNavigationTabPartAppearance(iconContainer:)` for SwiftUI and `AWCNavigationTabPartAppearance(iconContainer:)` for Compose, taking layout space around the wrapper's content as in Chrome (everything inside and after it shifts), and the Laboratory's `visualParts` / copyable examples carry it. Oracle: Mac Chrome 153 `::part(icon-container)` box cases merged into the paint fixtures; paint checks compare the typed box (background, border, radius, padding) and the wrapper geometry, plus flat pixels, on macOS, iOS and Android ([NativeNavigationBarPaintIntegration.swift](../../packages/native-ios/Tests/NativeNavigationBarPaintIntegration.swift), [NativeNavigationBarParityTest.kt](../../apps/native-android-playground/src/androidTest/java/dev/awc/playground/NativeNavigationBarParityTest.kt)).

## Remaining

Independent final audit.
