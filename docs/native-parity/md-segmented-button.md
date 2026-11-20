# Segmented Button and Set migration audit

Status: implementation, available native-runtime checkpoints and focused Laboratory controls/layout checks passed. The twelve narrow-width comparisons pass on Android and SwiftUI (`NativeSegmentedViewIntegration` `narrowOracle`, 370/370 checks). The observed Android Laboratory event-forwarding discrepancy is corrected and its device/Laboratory retests pass. Full integrated acceptance and independent final review remain open; iOS simulator execution is recorded in the gate-6 section. This record does not mark the 56-component migration complete.

`md-segmented-button` is the visible Laboratory entry; `md-segmented-button-set` is its required supporting component. This audit combines the [source review](md-segmented-button-source-review.md), [shared composition contract](segmented-preview-contract.md), [Swift runtime record](../../packages/native-ios/audits/md-segmented-button.md), [Android runtime record](../../packages/native-android/audits/md-segmented-button.md) and compiled public examples. Test suites and fixture subcases are reported separately, without turning them into a coverage percentage.

## Contract and integration

| Source surface | Implemented native and shared counterpart |
| --- | --- |
| Segment's 13 properties | `value`, `selected`, `disabled`, `softDisabled`, `icon`, `label`, `noCheckmark`, `ripple`, `segmentIndex`, `segmentTotal`, `segmentDensity`, `segmentMultiselect`, `density` |
| Set's two properties | `multiselect`, `density`; actual authored descendants receive parent-managed values |
| Standalone activation | Emits `mdSegmentClick: {value, selected}` as a proposal; does not silently change controlled selection |
| Set activation | Commits by child identity, consumes the internal proposal, emits exact ordered `mdChange: string[]` |
| Segment's default/icon slots | Native text/symbol composition; named icon is additional to the property/checkmark reservation |
| Set's default slot | Real ordered children; duplicate/empty values never replace identity |
| Seven hooks | `AWCSegmentedButtonAppearance`: container/selected-container colors, label/selected-label colors, outline color, corner radius and icon size |
| Four parts | Actual state-layer, checkmark, icon and label geometry |
| Methods | None declared by either source component; none invented |

The shared preview explicitly chooses standalone or set mode. In standalone mode all thirteen properties remain editable. In set mode the first authored child (`segment-day`) is the edited target; the panel identifies `segmentIndex`, `segmentTotal`, `segmentDensity` and `segmentMultiselect` as parent-owned. The same Day/Week/Month composition is used on Web and native platforms.

Frames report actual ordered `segmentedSelection` separately from event detail. Its Boolean vector is validated against the configured context and retained across platform/property edits. It is never reconstructed from values, which may be duplicate or empty. Defaults style the set subtree; local appearance targets only the edited child. Swift's modifier uses its authored node ID; Compose scopes that child directly.

Cancellation does not veto the source set's commit; stopping propagation before the set receives the proposal does. Initial multiple selection is not normalized merely on mount. Right/Down advance and Left/Up retreat even in RTL. Hard-disabled segments are skipped; soft-disabled segments can focus but cannot activate. Single-select arrows activate, multiselect arrows only focus, and each non-hard-disabled segment remains a sequential tab stop.

The initial authored-text decision is retained across updates. Label properties mask rather than discard default content. Explicit blank icon elements preserve their source box, while named icon text and symbols participate in initial text detection. Visible ASCII whitespace collapses without removing NBSP; accessible names retain authored text.

## Evidence checkpoints

| Gate | Recorded result | Evidence |
| --- | --- | --- |
| Web source suites | 87 passed, zero failed | Workspace `outputs/native-parity/md-segmented-button/web-tests.log` and `web-evidence.json` |
| Original hydrated reference | 35 configurations | `web-geometry.json`, fixture sources and screenshot; original artifact unchanged |
| Additional narrow reference | 12 configurations, measured separately; Android's dedicated comparison passes | `web-narrow-geometry.json`, `web-narrow-evidence.json`; Android follow-up recorded with the Split Button runtime checkpoint |
| Shared integration | 207 passed at the initial checkpoint; 65 focused example/configuration checks passed after slot fixes | `shared-integration-tests.log`, `shared-examples-tests.log` |
| Source documentation pipeline | Four parts and additive-slot description generated through normal docs/CEM/compiler pipeline; 12 compiler tests passed | Retained docs/CEM/catalog/compiler logs |
| Swift actual views/contracts | 286 checks passed, covering the original 35 reference cases and interaction/state regressions | Swift platform audit and native test runner |
| Swift host/context | 12 actual live-host checks and 33 slot/context contracts passed | Swift platform audit; all three preview products compiled |
| Android native units | 86 cases passed, including seven Segmented contract methods | Android unit report and exact command |
| Android device | Six JUnit methods passed: five renderer methods covering the 35 reference subcases and one actual host method | Android audit's raw XML, logs and 99 unchanged source/build-input hashes |
| Affected Android regressions | Two Menu/Badge slot regression methods passed | Separately retained XML and verification record |
| Public examples | 20 Swift and 20 Kotlin examples compiled | Workspace `outputs/native-parity/md-segmented-button/examples/verification.json`, exact sources and compiler logs |
| Laboratory focused checkpoint | Swift/Android standalone and set-mode controls, all seven styles, actual selection/panel synchronization observed; Android child-event forwarding corrected and retested | `laboratory-proof.json` and platform screenshots |
| iOS simulator | `NativeSegmentedViewIntegration` 370/370 on iPhone 17 Pro · iOS 26.3, iPad Pro 11-inch · iOS 26.3 and iPhone 16 Pro · iOS 18.6 | [iOS simulator execution (gate 6)](#ios-simulator-execution-gate-6) |
| Final audit | Gate 7 reviewer r1 | [audit](audit/md-segmented-button.md); open items in `work/audit/DEFECTS.md` (R1-03e, R1-13) |

The recorded Swift shared Focus68 and Menu19 checks passed separately. Counts above are scoped to their recorded runs and do not assert that unrelated later source changes were tested by an earlier report.

Independent review fixed initial named-slot text detection on Android, and ASCII whitespace plus removed/reinserted identity state on Swift. These corrections have actual lifecycle/input regressions. Android's original failed attempt remains available: assertions initially used unmatched device density, a wrapper semantics locator and a zero-area inspector expectation. The final comparison environment explicitly matches the Web reference's DPR2, targets the real control, and verifies empty content through its retained layout; geometry tolerances were not widened.

## Narrow-width reference added after the main native checkpoint

At width60, density0, LTR, the measured set is60×40. Its grid tracks are24/24/23; all three actual hosts are24×40 at relative x0/24/47. The last host ends at71 and therefore overflows the set. RTL positions are36/12/−11. At density−4 the same60-wide set has20/20/20 tracks, actual widths20/20/21 at x0/20/39 and height24.

The outer first/last corners compute to9999px on only their exterior side. CSS proportional radius reduction applied to the measured24×40 box yields20px for the exterior pair; a generic `min(width,height)/2` would incorrectly yield12px. The20px value is a derivation from the measured bounds/declarations, not a claimed direct DOM measurement of used paint radius. This follow-up reference is separate from the original35 cases. Android's dedicated method now passes all twelve cases, covering padding floors, track water filling, seam overlap, RTL overflow and proportional radii. A complete separately recorded twelve-case Swift comparison remains open.

## Focused Laboratory observations

The recorded standalone edit renders64.5×32 on both Swift and Android. The grouped
configuration renders86.5×24 on Swift and87×24 on Android at their physical-pixel
rounding. All seven style values survive the platform switch. The Android Week
activation emits the actual ordered array `["day","month"]` and the selected
control synchronizes false.

The same event log exposed an Android host discrepancy: direct listeners attached
to each authored child forwarded `mdSegmentClick` even though the set consumes
that proposal. Web's Laboratory listener is above the set, and Swift suppresses
the child forwarding. The native Android dispatcher itself stops propagation;
the preview listener placement is corrected without removing public
target-level child callbacks. The Loading device batch verifies exactly one set
`mdChange` and no leaked child event. The subsequent Laboratory retest records
a Week pointer activation with only `mdChange: ["week"]`, Week selected true and
Day false in the panel. Its 24 px-high control is centered at y38 in the 100 px
capture. Both the runtime and Laboratory regression gates for this issue pass.

## Boundaries and outstanding acceptance

Native text shaping and physical-pixel rounding differ from browser painting. Swift's recorded35-case comparison reports a largest accumulated difference of approximately1.6pt across three columns, while exact equal-track placement and seam overlap are asserted separately. Existing bounds remain explicit rather than being widened to hide a mismatch.

Compose custom content supplies source text semantics through `AWCSlotText`/`AWCSearchableLabelScope`. Native event phases, roles and typed appearances replace DOM objects and CSS selectors. Android's scoped `rawDetail` preserves the exact set array; its older map-shaped `detail` is a compatibility view, with `segmentedSelectionValues` as the typed accessor.

Final acceptance still needs completion of copied-example/default-scope Laboratory checks and review of recorded native boundaries (iOS simulator execution: gate-6 section). macOS SwiftUI checks do not certify iOS or actual screen-reader operation.

<!-- fi:ios-gate6:start -->
## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeSegmentedViewIntegration` | **370/370** | **370/370** | **370/370** |
| **Total** | **370/370** | **370/370** | **370/370** |

The fixture's "Targeted appearance" pixel bound assumed a 2× backing; it now uses the capture's pixel scale (370/370 on 3× iPhones).

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
