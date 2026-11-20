# FAB Menu and Item migration audit

Status: implementation, available native-runtime checkpoints and focused Laboratory interaction checks passed. iOS simulator execution (iPhone 17 Pro iOS 26.3, iPhone 16 Pro iOS 18.6, gate 6) passed; the independent gate-7 verdict is in AUDIT.md. This record does not mark either component, or the complete 56-component migration, finished.

`md-fab-menu` is the visible Laboratory component. `md-fab-menu-item` is its required supporting component. This audit combines the [source review](md-fab-menu-source-review.md), [Swift runtime record](../../packages/native-ios/audits/md-fab-menu.md), [Android runtime record](../../packages/native-android/audits/md-fab-menu.md) and independently compiled public examples. Their individual commands, raw results and limitations remain authoritative; counts below are separate suites, not an aggregate coverage percentage.

## Contract and integration

| Source surface | Implemented native and shared counterpart |
| --- | --- |
| Menu's seven properties | `open`, `anchor`, `variant`, `placement`, `quick`, `menuLabel`, `density` on a dedicated retained menu |
| Separate authored anchor | `AWCFabMenuScope` resolves the actual ID and measured bounds of a sibling FAB; the renderer does not invent a launcher |
| Menu's structural default slot | Real retained item children, independent values and authored order |
| `show`, `close`, `whenClosed` | Public retained controllers with distinct readiness, close-start and closed-cycle completion |
| `mdOpen`, `mdClose` | Void/null source detail; initial authored open mounts silently |
| Item's six properties | `icon`, `label`, `disabled`, `softDisabled`, `rovingFocusVisible`, `density` |
| Item's default and icon slots | Actual authored text/symbol content, including explicit empty icon elements; masked label content stays mounted |
| Item `mdClick` | Void/null callback and transport detail, with actual activation metadata kept separately |
| Three menu hooks | `AWCFabMenuAppearance`: `itemContainerColor`, `itemLabelColor`, `itemGap` |
| Five item hooks | `AWCFabMenuItemAppearance`: `containerColor`, `labelColor`, `iconColor`, `iconSize`, `cornerRadius` |
| Item's three parts | Actual measured `state-layer`, `icon` and `label` bounds; no fabricated DOM parts |

The shared preview uses a centered 360×480 authored anchor context inside the actual native viewport. The anchor remains separate from the menu. Local item appearance targets the edited child rather than all siblings; inherited defaults remain available. Public usage examples retain the same composition and typed styles.

The [method bridge](native-method-transport.md) separates acceptance from completion. A pending `whenClosed` cannot block the input queue that later sends `close`. Results are correlated by session and call ID, continue while frame streaming is paused, and are acknowledged after consumption. Each host retains at most 32 unacknowledged calls; repeated matching IDs are idempotent, mismatches and unknown IDs reject explicitly, and session replacement rejects browser promises. The FAB setter's immediate acknowledgement remains a separate contract.

Anchor pointer/keyboard capture suppresses the anchor's own action before opening. Fresh pointer opening and keyboard opening have different focus behavior. Disabled items remain in explicit menu traversal but cannot activate. Typeahead uses current trimmed label or authored text. Stopping item propagation prevents dismissal; canceling its notification does not. Closing starts the source's delay while `open` remains true, and reopening retains the pending close cycle. Outside activation remains nonmodal.

## Evidence checkpoints

| Gate | Recorded result | Evidence |
| --- | --- | --- |
| Web source suites | 155 passed, zero failed | Workspace `outputs/native-parity/md-fab-menu/web-tests.log` and `web-evidence.json` |
| Hydrated browser reference | 22 geometry configurations plus separate pointer/Enter/Space anchor-event observations | `web-geometry.json`, `web-anchor-events.json`, fixture sources and screenshot |
| Shared integration | 133 passed at the recorded integration checkpoint | `shared-integration-tests.log`; additional input and method-transport logs retained separately |
| Swift lifecycle/text | 19 contracts passed | Swift platform audit and native test runner |
| Swift actual views/input | 133 checks passed, plus 27 ordinary AppKit event-queue checks | Swift platform audit; includes geometry, palettes, slots, focus, propagation and outside activation |
| Swift live host | 18 checks passed | Actual JSON host input, event identity, result retention and paused-stream completion |
| Android native units | 75 suite cases passed, including six Menu contract cases | Android audit's unit report and exact command |
| Android device | Nine JUnit methods passed: five component methods covering the 22 reference subcases, one live-host method and three affected activation regressions | Android audit's raw XML, logs and 117 unchanged source/build-input hashes |
| Public examples | 21 Swift and 21 Kotlin examples compiled | Workspace `outputs/native-parity/md-fab-menu/examples/verification.json`, exact sources and compiler logs |
| Laboratory | Focused SwiftUI/macOS and Android checks passed | `laboratory-proof.json` and `android-styled.png`; actual methods, input, state and styles |
| iOS execution/final audit | Pending | macOS SwiftUI evidence is not iOS evidence |

The shared Swift focus and FAB regressions also passed in their recorded runs (68 and 94 checks respectively). They remain separate supporting evidence.

The Laboratory checkpoint exercised the seven menu properties and three style
controls, upward placement, density −4, RTL and the authored anchor. On both
platforms, `whenClosed` stayed pending until `close` completed the actual close
cycle, then displayed Done; `show` reopened the menu. Actual item activation
produced null-detail `mdClick` followed by `mdClose`, and the property panel
returned to `open=false`. Closed frames correctly had no popup bounds. The open
menu measures the same on both platforms: `component` is the item stack (152 high
for three items, 168 when item gap became 12) and `component.overlay` the viewport
overlay (Inspector paragraph below; gate-7 R1-06). Assistive-technology and iOS
execution are recorded in their own sections, not by this checkpoint.

Independent review corrected recursive authored-text fallback in Swift and retained masked default content/trimmed-label precedence in Android. Android's original failed run is retained. A real hinted-text width mismatch was corrected using supported linear/subpixel text layout after comparing the bundled font tables; the original 2dp reference bound was preserved. An ordinary AppKit input regression exposed a drag recognizer swallowing native clicks; passive pointer observation replaced it, with separate ordinary-input checks.

## Boundaries and outstanding acceptance

Native coordinates are points/dp and typography is measured by the operating system. Exact cross-platform glyph rasterization and shadows are not asserted. Compose custom compositions provide their searchable text through `AWCSlotText` or `AWCSearchableLabelScope`; they do not expose arbitrary DOM `textContent`. Native viewport scopes, responders and event phases replace browser document lookup, DOM roles and event objects.

Closing restores the anchor's own appearance on every platform: the Web source saves the anchor's prior inline `--md-fab-container-color` / `--md-fab-icon-color` (value and priority) when the open menu overrides them and puts them back on close, removal or anchor change (R1-05, regression specs in `md-fab-menu.spec.ts`); native scoped appearance already restored authored values. Android's scope must contain the relevant viewport for outside input; Swift uses its actual containing window.

Inspector: the open menu's `component` node is the item stack on SwiftUI and Compose, the same surface as the Web md-fab-menu box (3 items: 152 high); the viewport overlay / scope is the separate `component.overlay` part (`md-fab-menu overlay`) (R1-06; `test-live-fab-menu.mjs`, `LivePreviewHostTest`).

Final acceptance still needs independent review of the recorded Laboratory and
runtime evidence, review of the boundaries above, and actual iOS execution with
a suitable SDK/device. OS-level assistive-technology and reduced-motion behavior
must not be inferred from semantic/animation test fixtures alone.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeFabMenuViewIntegration` | **134/134** | **134/134** | **134/134** |
| `NativeFabMenuViewIntegration --native-pointer` | **27/27** | **27/27** | **27/27** |
| `NativeFabMenuLifecycleIntegration` | **19/19** | **19/19** | **19/19** |
| **Total** | **180/180** | **180/180** | **180/180** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
