# md-tabs native checkpoint

Status: **gates 2–3 and accessibility verified on macOS SwiftUI, the iOS simulator and the Android emulator** against
Mac Chrome 153 oracles (2026-10-30), for `md-tabs` and its children `md-tab`, `md-tab-panels` and `md-tab-panel`.
Independent final audit pending. Source contract: [md-tabs-source-review.md](md-tabs-source-review.md); plan:
[md-tabs-native-plan.md](md-tabs-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Tablist, tab, panels and panel nodes (`AWCNativeView` / `AWCComponent`) | dedicated renderers (`NativeTabs.swift`) | dedicated renderers (`AWCTabs.kt`) |
| Hooks: 2 tablist + 9 tab (inherited by every tab, incl. `glideDuration`) | `AWCTabsAppearance` / `AWCTabAppearance` + `.awcTabsAppearance(_:)` / `.awcTabAppearance(_:)` | `AWCTabsAppearance` / `AWCTabAppearance` + `AWCTabsAppearanceScope` / `AWCTabAppearanceScope` |
| `selectTab(index)` | `AWCTabsController` + `.awcTabsController(_:)` | `AWCTabsController` + `AWCTabsControllerScope` |
| Events | `mdTabChange { index, previousIndex }`, `mdTabClick` | same |

Behaviour mirrors the source: primary and secondary tablists with equal, auto or fixed tab widths, the scrolling strip
(the active tab revealed to the nearest edge, edge fades, wheel and drag), the full or per-tab divider and the indicator
glide (a FLIP from the outgoing indicator, held one frame, then 400 ms emphasized-decelerate; `glideDuration` hook);
selection with `activeTabIndex` rounded and clamped past disabled tabs (writes are silent), clicks, Enter/Space, arrows
(automatic activation, wrapping, mirrored in RTL), Home/End and `selectTab(index)`; one Tab stop (the active tab); the
active tab followed by identity across reorders and removals; stacked or inline icons, badges (count or dot), density
0…−4, label truncation; hover/press/focus state layers (8/12 %), the inset 3-point focus ring and the md-ripple wave;
`md-tab-panels` follows its `for` tablist (or the nearest preceding one) with `sizing` stable or active. The system
Reduce Motion setting removes the glide and the state-layer fades as `prefers-reduced-motion` does.

## Evidence

Oracles (`outputs/native-parity/md-tabs/web-oracle-mac/`, Chrome 153, DPR 1, trusted input; job n1-056) are shared by
`packages/native-ios/Tests/Fixtures/tabs-web-*` and the Android assets `TabsWeb*`: 135 paint cases with PNGs, 6
interaction/motion runs and 6 reduced-motion runs.

| Run | Result |
| --- | --- |
| macOS SwiftUI `NativeTabsPaintIntegration` / `NativeTabsStatesIntegration` | 14,297/14,297 · 137,124/137,124 |
| iOS simulator (AWC-n1, iPhone 17 Pro, iOS 26.3.1) paint / states | 14,297/14,297 · 132,004/132,004 (n1-A128) |
| Android emulator `NativeTabsParityTest` paint / states | 11,370/11,370 · 136,956/136,956 (n1-A126) |
| Android `LivePreviewTabsHostTest` | 4/4 (n1-A128) |

Motion samples are compared within Chrome's frame envelope (±50 ms, or interpolated between the nearest native
frames); a sample between two native frames more than 40 ms apart has no native evidence and is counted as uncovered
(bounded per phase). On the iOS simulator a key reaches the app through the HID queue a frame or two after it is sent,
so the first 50 ms after a key are not compared there (30 ms elsewhere, Chrome's own input latency).

## Laboratory (gate 3)

- **Recipe:** a three-tab primary tablist with panels in both fixtures.
- **Styles panel:** the 11 tablist hooks (`tabs-appearance.js`) and the 9 tab hooks on the tab page.
- **Properties:** retained updates for all four tags; **methods:** `selectTab(index)` (events returned).
- **Examples:** 20 SwiftUI examples typecheck and 20 Compose examples compile.

| Run | Result |
| --- | --- |
| Studio `tabs-integration.test.mjs` / all studio suites | 3/3 · 769/769 (n1-A125) |
| SwiftUI live host `test-live-tabs.mjs` | 38/38 |
| Android `LivePreviewTabsHostTest` | 4/4 |

## Accessibility (tools/ax)

Cases `tablist`, `secondary` (md-tabs), `tab`, `disabled` (md-tab), `panels`, `panel`: **0 open findings** on macOS,
iOS and Android (n1-A127, `outputs/native-parity/_ax-n1/`).

- macOS: the tablist is an `AXTabGroup` named by its label whose children are the tabs (`AXRadioButton`/`AXTabButton`,
  selected state); Tab enters at the active tab.
- iOS: tabs are buttons with the selected trait inside a labelled container (no tab-group element in UIKit).
- Android: tabs carry `Role.Tab` and the selected state in a traversal group (collection) labelled by the tablist name.
- Panels have no native tab-panel role: the active panel's content is exposed in place, inactive panels are hidden
  from accessibility (documented expectation).

## Installation

Installed in the canonical tree through the main queue: n1-067 (renderers, Laboratory integration, docs; native compiler, studio tabs + navigation-bar suites 6/6, Swift package build, Android compile, Laboratory APK); every install was applied to a copy of the tree first. Verified on the canonical tree on 2026-10-30 (n1-069): the Laboratory playground rebuilt with SwiftPM's build-manifest cache disabled (n1-067's playground build had reused a manifest from before the install), SwiftUI live host 38/38, studio suite 775/778 (the 3 failures are md-text-field's), Laboratory server restarted, macOS tools/ax on the canonical build 6 cases with 0 open findings (`outputs/native-parity/_ax-n1-canonical/`).

## Gate-7 fixes (d6, 2026-10-31 … 2026-11-05)

Evidence: `work/d6-lab/out/` (jobs d6-002…d6-031, d6-A001…d6-A007, d6b-001…005); canonical installs `d6-install-1` (d6-009),
`d6-install-2` (d6-019) and `d6-install-3` (d6-032), each re-applying the anchored, pre-image-checked patch scripts in
`work/d6-lab/` (r601, r608, r610, r614, r603/*, r611, r609*) with automatic rollback.

### iOS simulator (gate 6, R6-07)

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
| --- | --- | --- | --- |
| `NativeTabsPaintIntegration` | 15379/15379 | 15379/15379 | 15379/15379 |
| `NativeTabsStatesIntegration` | 132004/132004 | 132004/132004 | 132004/132004 |

Xcode 26.3, `apps/native-ios-parity` harness (`work/d6-lab/harness.sh`), d6's own simulators (AWC-d6, AWC-d6-ipad, AWC-d6-18), on the
installed code (job d6-030, logs `work/d6-lab/out/ios-final/console-<simulator>-<suite>.log`).

### Findings

- **R6-08 (tab panel focus).** The active md-tab-panel is a sequential focus stop, as the source's `tabindex` 0 (inactive: -1),
  with the source `:host(:focus-visible)` ring (3 px primary outline, 2 px offset, 4 px radius): SwiftUI through an AWC focus
  surface (macOS key-view loop, iOS UIKit key view; the SwiftUI group stays the panel's accessibility element) and Compose
  through a focusable panel container named by its tab. The tools/ax focus expectation was removed; the macOS walk now
  reaches the panel (`work/d6-lab/out/d6-003/ax`). Tabs paint 14297/14297 and states 137124/137124 (macOS) unchanged.
- **R6-09 (`controls` / aria-controls).** macOS: each tab's AWC focus element reports `AXLinkedUIElements` = its panel's
  element (explicit `controls` id, else md-tab-panels' auto-wiring by index); tools/ax now records Web `controls` and macOS
  linked elements and compares them (finding kind `relation`). Verified through the Accessibility API in the Laboratory host
  (d6-031): scenario `tabs-panels` renders the Studio's composed reference (md-tabs + md-tab-panels for them) and
  `test-live-tabs.mjs` reads the active tab's AXLinkedUIElements — Overview → its panel, after `selectTab(2)` Settings → its
  panel. The lookup walks the window's accessibility tree including SwiftUI's accessibility nodes (they implement the
  NSAccessibility methods without the formal protocol conformance). An inactive tab's panel is hidden from accessibility, so
  only the active tab reports a link (Chrome leaves a hidden aria-controls target out of the relation). tools/ax cases render
  one component each and do not exercise the relation.
  **Exception record for iOS and Android (proposed; reviewer acceptance pending).**
  - *Source behaviour:* `aria-controls` relates a tab to its panel (Chrome: AXLinkedUIElements on macOS).
  - *Platform/API:* UIKit accessibility and Compose semantics.
  - *Technical reason:* neither platform has an element-to-element "controls" relation (UIAccessibility has no linked
    elements; Compose semantics has no relation property; TalkBack/VoiceOver do not offer such a jump).
  - *User impact:* VoiceOver/TalkBack users cannot jump from a tab to its panel with a rotor/relation command.
  - *Tested native equivalent:* the active panel follows the tablist in reading and keyboard order and is named by its tab
    (Compose contentDescription; UIKit container label), checked by tools/ax (`md-tab-panel`, `md-tab-panels` cases).
  - *Evidence:* `work/d6-lab/out/d6-003/ax`, `work/d6-lab/out/d6-A001`.
- **R6-14 (CEM).** `--md-tab-glide-x` / `--md-tab-glide-scale` are annotated `@private` in md-tab.css and no longer listed as
  hooks (the generator skips `@private` names).
- **R6-03 (parts).** Typed: md-tab `AWCTabPartAppearance` (`.awcTabPartAppearance(_:for:)` / `AWCTabPartAppearanceScope`) — state-layer (colour, opacity), icon, label, indicator and divider colours; md-tabs `AWCTabsPartAppearance` (`.awcTabsPartAppearance(_:)` / `AWCTabsPartAppearanceScope`) — the strip's container background. Part rules come from the outer tree, so a typed value wins over the hooks and every internal state rule (a state-layer opacity shows in every state), as `::part()` rules do in Chrome. Oracle: Mac Chrome 153 `::part()` cases (8 cases in `_nav-web-reference/tabs.html?parts`: primary / secondary × light / dark × LTR / RTL, disabled, label-only; job d6-012). SwiftUI: NativeTabsPaintIntegration 15379/15379 (macOS, d6-026); Compose: NativeTabsParityTest paint + states pass (d6-A002). Laboratory: `visualParts` in both support policies and copyable SwiftUI / Compose examples for every typed part (22 SwiftUI examples typecheck (d6-026), 22 Compose examples compile (d6-A007)).

#### Typed box target (gate-7 R6-17): md-tab ::part(content)

`::part(content)` of md-tab is the flex column holding icon, label and badge; its border and padding add to the tab's content height. It is a typed part target, not an exception: `AWCPartBox` (background, border width / colour, border radius, padding shorthand; physical edges, content-box) on `AWCTabPartAppearance(content:)` for SwiftUI and `AWCTabPartAppearance(content:)` for Compose, taking layout space around the wrapper's content as in Chrome (everything inside and after it shifts), and the Laboratory's `visualParts` / copyable examples carry it. Oracle: Mac Chrome 153 `::part(content)` box cases merged into the paint fixtures; paint checks compare the typed box (background, border, radius, padding) and the wrapper geometry, plus flat pixels, on macOS, iOS and Android ([NativeTabsPaintIntegration.swift](../../packages/native-ios/Tests/NativeTabsPaintIntegration.swift), [NativeTabsParityTest.kt](../../apps/native-android-playground/src/androidTest/java/dev/awc/playground/NativeTabsParityTest.kt)).

- **R6-23 (decision, d6, 2026-11-14).** Inherited text in an md-tab-panel (the source sets no colour; the Web page inherits its body colour) is painted in the theme's `on-surface` token colour on SwiftUI and Compose. Compose painted #000000 before; the Laboratory live test now reads the panel copy's glyph ink (expected #1C1B1F in light). Alternative: leave the colour to the host's `LocalContentColor`; revert by removing the panel colour in AWCTabs.kt.

## Remaining

Independent final audit.
