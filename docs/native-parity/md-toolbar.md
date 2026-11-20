# md-toolbar native checkpoint

Status: **dedicated native renderer (gate 2) and Laboratory integration (gate 3) verified on macOS SwiftUI, the iOS simulator
and the Android emulator** against Mac Chrome 153 oracles (2026-10-31). Accessibility evidence with `tools/ax`: macos 0 open / 1 expected; ios 0 open / 4 expected; android 0 open / 10 expected (4 cases).
Independent final audit pending. Source contract and decisions: [md-toolbar-source-review.md](md-toolbar-source-review.md)
(section "Decisions (autonomous, …, reversible)"). Native plan: [md-toolbar-native-plan.md](md-toolbar-native-plan.md).

## Native API

| Concern | SwiftUI | Compose |
| --- | --- | --- |
| Element | `AWCNativeView` node `md-toolbar` → the dedicated renderer (`NativeToolbar.swift`) | `AWCComponent("md-toolbar", props, onEvent) { slot -> }` → `NativeToolbar` (`AWCToolbar.kt`) |
| Properties (8) | every IR property as `AWCValue` | same |
| Hooks (11 `--md-toolbar-*`) | `AWCToolbarAppearance` (typed, `values:` or `css:`) + `.awcToolbarAppearance(_:)` | `AWCToolbarAppearance` (typed or `fromCSS`) + `AWCToolbarAppearanceScope` |
| Method `setFocus()` | `AWCToolbarController.setFocus() -> Bool` + `.awcToolbarController(_:)` | `AWCToolbarController.setFocus()` + `AWCToolbarControllerScope` |
| Slots (default, `leading`, `trailing`, `fab`) | child nodes with `slot` | the `content` slot lambda |
| `aria-labelledby` (IDREF list) | resolved in the native scope (every node registers its text); unresolved → `aria-label` | the host supplies its texts: `AWCLabelTextsScope(texts)` / `LocalAWCLabelTexts`; unresolved → `aria-label` |

Docked bar and floating pill (horizontal or vertical), standard / vibrant colours, the leading / default / trailing sections with their gaps and alignment (start / center / end; `layout` ignored when docked), the paired FAB (flat on a docked bar), density on the bar or inherited, the opt-in scrolling / wrapping overflow, and the toolbar-only icon-button tints. Roving focus over its icon buttons and buttons: one Tab stop, arrows on the bar's axis (RTL-aware horizontally), wrap, Home / End, modified and off-axis arrows ignored; soft-disabled members reachable, hidden / disabled / aria-hidden ones skipped; other controls keep their own stop; re-synced when the children change; `setFocus()` focuses the roving stop. Inherited like CSS: theme tokens < appearance hooks < the host's inline `style` custom properties.

## Evidence (n5-026…036, n5-A019…A025; canonical install n5-037-install-toolbar)

Oracles: `outputs/native-parity/md-toolbar/web-oracle-mac/` (Chrome 153, DPR 1), converted byte-identically into the Swift fixtures
(`packages/native-ios/Tests/Fixtures/toolbar-web-{paint,states,states-reduced}.json + shot directories`) and the Android assets (`apps/native-android-playground/src/androidTest/assets/ToolbarWeb{Paint,States,StatesReduced}(.json)`).

| Run | Result |
| --- | --- |
| macOS SwiftUI paint (`NativeToolbarPaintIntegration`, 116 cases + 3 `aria-labelledby` checks) | 7466/7466 |
| macOS SwiftUI states (`NativeToolbarStatesIntegration`, 17 runs + reduced motion) | 2255/2255 |
| iOS simulator AWC-n5 (same suites, `apps/native-ios-parity`) | paint 7466/7466, states 2255/2255 |
| Android emulator-5560 (`NativeToolbarParityTest`) | paint 6999/6999 (incl. 3 `aria-labelledby` checks), states 1904/1904 |
| Laboratory | studio `nav-integration.test.mjs` with the method / update / example suites 45/45; SwiftUI live host `test-live-nav.mjs` 29 checks (hooks, retained updates, `setFocus()` result, density, lifecycle); Android `LivePreviewNavHostTest` 2/2; compiled examples 11 Swift (typecheck) + 11 Kotlin (compiled with the androidTest sources) |
| Accessibility (`tools/ax`) | macos 0 open / 1 expected; ios 0 open / 4 expected; android 0 open / 10 expected (4 cases) — `outputs/native-parity/md-toolbar/accessibility/report.md` |

## Accessibility model

role=toolbar named by `aria-label` (or `aria-labelledby`) with its orientation. macOS: an AXToolbar named by the label (Chrome's role) whose children are the members' native responders and text fields in reading order (leading, default, trailing, FAB); dividers are decorative there (Chrome's AXSplitter is optional). iOS: an accessibility container named by the label; a divider is "Separator" with its orientation as the value (the md-divider convention). Android: a traversal group whose content description is the label, read before its controls; a divider is described "Separator". Generic mode (`containerSemantics="generic"`) is a plain group without a name, as ARIA prohibits naming it. Reviewed conventions: `tools/ax/expectations.mjs` (Navigation entries).

## Exceptions

None. `::part(fab-container)` is a typed box target (gate-7 R6-17, below). Every property, event, method, slot and hook is implemented natively (8 properties, 0 events, 1 method, 4 slots, 11 hooks), and the `container` and `fab-container` parts are typed.

## Gate-7 fixes (d6, 2026-10-31 … 2026-11-05)

Evidence: `work/d6-lab/out/` (jobs d6-002…d6-031, d6-A001…d6-A007, d6b-001…005); canonical installs `d6-install-1` (d6-009),
`d6-install-2` (d6-019) and `d6-install-3` (d6-032), each re-applying the anchored, pre-image-checked patch scripts in
`work/d6-lab/` (r601, r608, r610, r614, r603/*, r611, r609*) with automatic rollback.

### iOS simulator (gate 6, R6-07)

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
| --- | --- | --- | --- |
| `NativeToolbarPaintIntegration` | 8006/8006 | 8006/8006 | 8006/8006 |
| `NativeToolbarStatesIntegration` | 2255/2255 | 2255/2255 | 2255/2255 |

Xcode 26.3, `apps/native-ios-parity` harness (`work/d6-lab/harness.sh`), d6's own simulators (AWC-d6, AWC-d6-ipad, AWC-d6-18), on the
installed code (job d6-030, logs `work/d6-lab/out/ios-final/console-<simulator>-<suite>.log`).

### Findings

- **R6-01 (Laboratory SwiftUI preview).** The `md-toolbar` and `container` inspection nodes now report `padding`/`margin` as
  four-edge arrays and `gap` as `{row, column}` (the Laboratory server's schema); the scalar values stay as `itemGap`,
  `paddingValue`, `paddingInline`, `marginInline`. `test-live-nav.mjs` validates every frame with the server's own
  `validateNativeInspection` (10/10 frames).
- **R6-03 (parts).** Typed: `container` — `AWCToolbarPartAppearance(containerColor:)` (`.awcToolbarPartAppearance(_:)` / `AWCToolbarPartAppearanceScope`): the floating pill's fill (its elevation kept) or a fill over the docked content box. Part rules come from the outer tree, so a typed value wins over the hooks and every internal state rule (a state-layer opacity shows in every state), as `::part()` rules do in Chrome. Oracle: Mac Chrome 153 `::part()` cases (10 cases in `md-toolbar/web-reference/paint.html?set=parts`: docked / floating × light / dark × LTR / RTL, vibrant, vertical; job d6-018). SwiftUI: NativeToolbarPaintIntegration 8006/8006 (macOS, d6-026); Compose: NativeToolbarParityTest pass (d6-A005, d6-A007). Laboratory: `visualParts` in both support policies and copyable SwiftUI / Compose examples for every typed part (22 SwiftUI examples typecheck (d6-026), 22 Compose examples compile (d6-A007)).

#### Typed box target (gate-7 R6-17): md-toolbar ::part(fab-container)

`::part(fab-container)` of md-toolbar is the wrapper of the slotted FAB; the bar and the host grow around its border and padding. It is a typed part target, not an exception: `AWCPartBox` (background, border width / colour, border radius, padding shorthand; physical edges, content-box) on `AWCToolbarPartAppearance(fabContainer:)` for SwiftUI and `AWCToolbarPartAppearance(fabContainer:)` for Compose, taking layout space around the wrapper's content as in Chrome (everything inside and after it shifts), and the Laboratory's `visualParts` / copyable examples carry it. Oracle: Mac Chrome 153 `::part(fab-container)` box cases merged into the paint fixtures; paint checks compare the typed box (background, border, radius, padding) and the wrapper geometry, plus flat pixels, on macOS, iOS and Android ([NativeToolbarPaintIntegration.swift](../../packages/native-ios/Tests/NativeToolbarPaintIntegration.swift), [NativeToolbarParityTest.kt](../../apps/native-android-playground/src/androidTest/java/dev/awc/playground/NativeToolbarParityTest.kt)).

## Remaining

Independent final audit.
