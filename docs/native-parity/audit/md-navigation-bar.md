# Gate 7 audit — md-navigation-bar (+ md-navigation-tab)

**Verdict (re-check 2026-11-15): PASS** — gate-7 reviewer s7-10 (previous: re-check 2026-11-09 FAIL (R6-17), gate-7 reviewer r6).

## Re-check 2026-11-15 (gate-7 reviewer s7-10, story 7-10)

Third re-check, independent, of the fixes marked ready for re-check: d6 story 5-1 (R6-17 typed box targets for the five wrapper parts, installed 5-1-100; R6-18 iPad fixture item and R6-22 / R6-23, installed d6-054) and story 5-2 (R6-15 slot refresh, installed 5-2-008). Snapshot `work/audit/s7-10-tree` taken by s7-10-001 (canonical at 2026-11-15 15:16 Mac time, 227 install jobs, latest 1-1-md-transfer-list-finish-and-install-036, 1-2-md-search-finish-and-install-A024, 5-2-010); canonical differs from the snapshot afterwards only in other components' files (s7-10-008: NativeTextField.swift, TextFieldModel.swift, docs and story files). Jobs: Mac lane d6b (s7-10-001 ... 011), Android lane a3 (s7-10-A001 ... A004, emulator-5560), simulators AWC-d6b (iPhone 17 Pro 26.3), AWC-d6b-18 (iPhone 16 Pro 18.6), AWC-d6b-ipad (iPad Pro 26.3), cloned from the d6 simulators and shut down by the harness on exit. Timing suites ran through `tools/slot.sh timing 4`; the iOS harness kept its accessibility runtime on (`ax=1/1/0`). Evidence: `work/audit/s7-10/` (`macos/`, `ios-iphone/`, `ios-ios18/`, `ios-ipad/`, `android/`, `lab/`, `ax/`, `examples/`, `r615/`) and `claude-runner/done/s7-10-*.log`.


### Findings re-checked

| ID | Fix claimed | s7-10 re-check |
| --- | --- | --- |
| R6-17 | 5-1-100: the five wrapper parts are typed `AWCPartBox` targets (background, border, radius, padding with layout shift) on SwiftUI and Compose; the exception records are removed | **VERIFIED** — `AWCPartBox` is in the SwiftUI and Compose sources; the Mac Chrome `::part()` box cases are in the shared fixtures (navbar `box-container-ltr`, `box-container-dark-rtl`, `box-icon-container-ltr`, `box-icon-container-dark-rtl`); paint passes on macOS, iPhone 26.3, iOS 18.6 and Android (counts below, higher than the 2026-11-09 counts by the box cases); the part examples of the family compile on both platforms (27 + 27). The rejected exception was implementable and is now implemented. |
| R6-18 (iPad) | d6-054 patch installed in the navigation-bar states test | **VERIFIED** — iPad Pro 26.3 `NativeNavigationBarStatesIntegration` 189386/189386 (s7-10-005) |

### Re-runs (s7-10, own runs on the fresh snapshot)

| Suite | Claimed by d6 (5-1) | s7-10 | Job |
| --- | --- | --- | --- |
| macOS `NativeNavigationBarPaintIntegration` / `StatesIntegration` | 17429 / 189386 | 17429/17429 / 189386/189386 | s7-10-002 |
| iPhone 17 Pro 26.3 paint / states | 17429 / 189386 | 17429/17429 / 189386/189386 | s7-10-005 |
| iPhone 16 Pro 18.6 paint / states | 17429 / 189374 | 17429/17429 / 189362/189362 in 3 of 3 runs | s7-10-005 |
| iPad Pro 26.3 states | 189386 | 189386/189386 | s7-10-005 |
| Android `NativeNavigationBarParityTest` paint / states + `LivePreviewNavigationBarHostTest` | 15777 / 189338, 0 failures | 15777 / 189338, 0 failures; host tests ok (`barHooksSelectAndUpdates`, `destinationPage`) | s7-10-A001 |
| SwiftUI live host + Laboratory inspection schema | 27 checks | 27 checks, 12 frames pass the schema | s7-10-004 |
| Laboratory 4177 probes (SwiftUI + Android: typed hooks, retained update, methods, events; standalone crumb inks, panel default / active) | pass | probe-lab2 18/18 sessions; probe-lab4/5/6 pass | s7-10-004 |
| tools/ax macOS / Web / iOS / Android + compare | 0 open | 0 open findings (navigation-bar 2, navigation-tab 2); expectations file unchanged for these tags (only other components' records added) | s7-10-006, s7-10-A004 |
| Copyable examples | 27 SwiftUI part examples typecheck | SwiftUI: 17 + 51 shared views + 27 part views typecheck exit 0; Compose: 17 + 51 + 27 part composables compile (classes produced, clean recompile leaves 0) | s7-10-004, s7-10-007, s7-10-A002 |
| Checkpoint pins | - | stale pins (see hygiene finding S7-10-01); the evidence above was produced on code identical to canonical for this family | s7-10-008 |

Contract matrix (gate 1): the inventory was regenerated on canonical (s7-10-010) and compared with r6's of 2026-11-09. Property / event / method / slot sets of the family are unchanged. Differences: md-breadcrumbs gains the documented `separator` part (R6-14, typed on both platforms); md-tab drops the two `@private` glide variables from the hooks; md-navigation-tab lists its ten colour hooks as documented custom properties (they were already exercised by the shared paint oracles); md-tab-panel's source changed by the slot refresh (R6-15). No row without SwiftUI, Compose, Laboratory exposure and a test.

Evidence-currency check: the Mac Chrome 153 `::part()` box oracles are in the shared paint fixtures, byte-identical between the iOS and the Android copy (md5 equal for tabs, navbar, breadcrumbs, toolbar); the counts above are from my runs, not from the claim.

### Exception decisions

No new exception. R6-17 `container` / `icon-container` exception records are gone (typed targets). tools/ax expectations for md-navigation-bar (iOS/Android landmark `navigation`) are platform conventions: unchanged since r6. The ten `--md-navigation-tab-*` colour hooks that moved from "additional own CSS references" to documented custom properties in the regenerated inventory were already exercised by the paint oracles (`navbar-web-paint.json`, Android `NavigationBarWebPaint.json`), so no gate-1 gap.

### Verdict

**PASS** — gate-7 reviewer s7-10, 2026-11-15. All seven gates are met by current evidence for md-navigation-bar and md-navigation-tab. No blocking finding is open. Non-blocking: S7-10-01 (checkpoint pins stale, DEFECTS.md), S7-10-02 (informational, Android md-navigation-rail capture flake outside this family).

## Re-check 2026-11-09

Second re-check of the fixes for r6's 2026-11-07 findings — d6's R6-18 (d6-049), R6-20 (d6-047, with a tools/ax change) and
R6-21 (d6-047), di's R6-19 (di-049) — independently, on a fresh snapshot: `work/audit/r6-tree` refreshed by r6-024 (canonical at
2026-11-09 17:49 EET; 106 install jobs, the latest r1-028, n5-057, n5-056, n2-082, d6-049, d6-047; build products rebuilt incrementally;
the navigation-family, tools/ax and Laboratory files changed since the 11-07 snapshot are kept as diffs in `recheck3/diffs/nav.diff`).
Jobs: r6-023…r6-028 (Mac lane r6), r6-A009…r6-A015 (Android lane a6, emulator-5566), written as files and committed into the lanes (the Mac
device shell was unavailable). Timing-sensitive runs went through `tools/slot.sh timing 4`; the iOS harness ran with its default
accessibility runtime (`ax=1/1/0`, ios-harness item 39); simulators were shut down and Chrome killed on exit. Evidence: [`work/audit/r6/recheck3/`](../../../../audit/r6/recheck3/)
(`macos/`, `ios-iphone/`, `ios-ios18/`, `ios-ipad/`, `android/`, `lab/`, `ax/`, `examples/`, `diffs/`).

### Findings re-checked

| ID | Fix claimed | r6 re-check |
| --- | --- | --- |
| R6-19 | di-049: on iOS a tab's state transitions start one 60 Hz frame after the input (`inputFrameDelay` in `NativeNavigationBar.swift`; Chrome computes style once per frame after the input); macOS unchanged | **VERIFIED** — change reviewed (iOS only, every track of the tab, reduced motion included, as md-breadcrumbs / list / colour picker already do). iPhone 16 Pro iOS 18.6 with the accessibility runtime on (`ax=1/1/0`): `NativeNavigationBarStatesIntegration` 189362/189362, 189350/189350, 189374/189374 — 3 of 3 runs, incl. `manual-ltr arrow-forward t+50` and R6-16's `auto-ltr press t+66`; iPhone 17 Pro 26.3 189386/189386; iPad Pro 26.3 189362/189362; macOS 189386/189386; Android 189338/189338. |
| R6-17 | — | open (no fix yet) |

### Re-runs

| Suite | r6 (r6-024 snapshot) | Job |
| --- | --- | --- |
| macOS `NativeNavigationBarPaintIntegration` / `StatesIntegration` | 16159/16159 · 189386/189386 | r6-025 |
| iOS harness paint — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 16159/16159 · 16159/16159 | r6-027 |
| iOS harness states — iPhone 26.3 / iOS 18.6 ×3 / iPad Pro 26.3 | 189386 · 189362, 189350, 189374 · 189362 (all passed) | r6-027 |
| Android `NativeNavigationBarParityTest` paint / states | 14615/14615 · 189338/189338 | r6-A010 |
| Android `LivePreviewNavigationBarHostTest` | pass (30/30 tests of the nine classes run) | r6-A010 |
| SwiftUI live host `test-live-navbar.mjs` | 27/27 checks; 12/12 frames | r6-026 |
| Laboratory 4177 (SwiftUI + Android): hooks, updates, `select(1)` → mdChange, `focusTab(2)`, md-navigation-tab `focusEl()` | pass (probe-lab2, probe-lab6) | r6-026, r6-A013 |
| tools/ax macOS / Web / iOS / Android | 0 open findings (md-navigation-bar 2, md-navigation-tab 2 cases) | r6-028, r6-A015 |
| Copyable examples (11-07 sets) | SwiftUI typecheck 17 + 51 shared views; Compose 17 + 51 composables compile | r6-026, r6-A011 |

### Open findings

- **R6-17** — Layout-wrapper parts (md-breadcrumbs `overflow`, md-tab `content`, md-navigation-tab `container` / `icon-container`, md-toolbar `fab-container`): exception records rejected as implementable (2026-11-07); no fix yet.

## Re-check 2026-11-07

Re-check of the fixes d6 (R6-01…03, 07…12, 14) and di (R6-16) installed for this family, independently, on a fresh snapshot:
`work/audit/r6-tree` refreshed by r6-016 (canonical at 2026-11-07 01:19 EET; 87 install jobs, the latest r2-044, d4-064, d6-038, r4-063,
di-045, d6-037; build products rebuilt incrementally). Jobs: r6-016…r6-020, r6-0185…r6-0188 (Mac lane r6), r6-A006…r6-A008 (Android lane
a6, emulator-5566). Timing-sensitive runs went through `tools/slot.sh timing 4`; simulators and Chrome were shut down on exit. Evidence:
[`work/audit/r6/recheck/`](../../../../audit/r6/recheck/) (`macos/`, `ios-iphone/`, `ios-ios18/`, `android/`, `lab/`, `ax/`, `examples/`, `gate1/`).

### Findings of 2026-10-31

| ID | Finding | Fix claimed | r6 re-check |
| --- | --- | --- | --- |
| R6-03 | parts without native target | 6 typed parts + 2 exceptions (container, icon-container) | typed parts VERIFIED (paint 16159/16159 incl. 6 `::part()` cases, Android parity, 6 part examples compile); both exceptions **rejected** → R6-17 |
| R6-07 | iOS gate-6 rows missing | rows in md-navigation-bar.md (d6-030, di) | VERIFIED — logs match; r6 re-ran iPhone 26.3 and iOS 18.6 |
| R6-11 | `--md-navigation-tab-slotted-icon-font` untested | family-list handling + 3 Mac Chrome cases | VERIFIED — `slotted-text-icon`, `hook-tab-slotted-icon-font(-dark-rtl)` in the shared fixture; SwiftUI and Compose paint pass |
| R6-14 | CEM drift | 10 destination hooks described | VERIFIED — 22 md-navigation-tab hooks in custom-elements.json |
| R6-16 | iOS 18.6 press state layer ahead of Chrome | di: press from the raw UIKit touch on iOS 18+ | VERIFIED — the R6-16 check (`auto-ltr press t+66`) passes on iOS 18.6 in 3 of 3 runs (189374, 189362, 189372 of 189374 / 189362); run 3 failed two other checks on a keyboard path (`manual-ltr arrow-forward t+50`, native one frame ahead) → R6-19 |

### Re-runs

| Suite | Claimed (d6 / di) | r6 re-check | Job |
| --- | --- | --- | --- |
| macOS `NativeNavigationBarPaintIntegration` | 16159/16159 (d6-026) | 16159/16159 | r6-017 |
| macOS `NativeNavigationBarStatesIntegration` | 189386/189386 | 189386/189386 | r6-017 |
| iOS harness paint — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 16159/16159 each (d6-030) | 16159/16159 · 16159/16159 | r6-019 |
| iOS harness states — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 (×3 on 18.6) | 189386 / 189374 (d6-030, di) | 189362/189362 · 189374/189374, 189362/189362, **189372/189374** (R6-19) | r6-019 |
| iPad Pro 11-inch (M5) 26.3 paint / states | 16159 / 189386 (d6-030) | not re-run; d6 logs read: 16159/16159, 189386/189386 | — |
| Android `NativeNavigationBarParityTest` paint / states | pass (d6-A007/A008) | 14615/14615 · 189338/189338 | r6-A006 |
| Android `LivePreviewNavigationBarHostTest` | 2/2 | 2/2 | r6-A006 |
| SwiftUI live host `test-live-navbar.mjs` | pass | 27/27 checks; 12/12 frames | r6-018 |

Shared fixtures (paint / states / reduced JSON and paint PNGs) are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets; the new `::part()` and hook cases come from Mac Chrome 153 (`oracle.browser`).

### Gate 1 — matrix

Re-built on the snapshot ([`recheck/gate1/matrix.md`](../../../../audit/r6/recheck/gate1/matrix.md), helper `matrix2.mjs`; part rows read the policies' `visualParts`). Every property, event, method, slot and hook row has SwiftUI, Compose, Laboratory and test coverage (the remaining "none" cells are the ones reviewed on 2026-10-31: frame events, `#symbol` slot children, trail-managed `itemIndex` / `itemTotal`, `@private` glide variables) or an accepted exception (`rel`; md-tab `controls` on iOS / Android). Parts: see the table above.

### Gate 3 — Laboratory

Through 4177 (r6-018): session + hook, `labelBehavior: selected` (frame changed after 700 ms), `select(1)` → mdChange `{1, 0}`, `focusTab(2)`; md-navigation-tab hook, `badge`, `focusEl()` — SwiftUI and Android. Examples: 17 + 17 and every slot / method / event / typed-part example (6 parts) compile (r6-018, r6-A007).

### Gate 6 — accessibility

tools/ax (r6-020, r6-A008): 0 open on macOS, iOS, Android (accepted: landmark on iOS / Android).

### Exception decisions

| Exception | Record | Decision |
| --- | --- | --- |
| md-navigation-tab `::part(container)` | all fields present | **Rejected** — gate-7 reviewer r6, 2026-11-07. Every field of the record is present, but the gap is implementable: the record's
reason is that "a wrapper box model is not interpreted", which is a renderer choice, not a platform limit. The same renderers already
implement box styling of wrapper parts through typed part targets (md-breadcrumbs `list`: background and physical padding;
md-tabs / md-navigation-bar / md-toolbar `container`: fill), so a typed target with the wrapper's box properties (background, border width /
colour, corner radius, padding with the layout shift, as `list` does) and Mac Chrome `::part()` oracle cases is the implementable approach
(AUDIT.md: "Do not waive implementable gaps as platform differences"; consistent with r3-18 and R5-06). → R6-17. |
| md-navigation-tab `::part(icon-container)` | all fields present | **Rejected** — gate-7 reviewer r6, 2026-11-07. Every field of the record is present, but the gap is implementable: the record's
reason is that "a wrapper box model is not interpreted", which is a renderer choice, not a platform limit. The same renderers already
implement box styling of wrapper parts through typed part targets (md-breadcrumbs `list`: background and physical padding;
md-tabs / md-navigation-bar / md-toolbar `container`: fill), so a typed target with the wrapper's box properties (background, border width /
colour, corner radius, padding with the layout shift, as `list` does) and Mac Chrome `::part()` oracle cases is the implementable approach
(AUDIT.md: "Do not waive implementable gaps as platform differences"; consistent with r3-18 and R5-06). → R6-17. |

### Open findings

- **R6-17** — Layout-wrapper parts (md-breadcrumbs `overflow`, md-tab `content`, md-navigation-tab `container` / `icon-container`, md-toolbar `fab-container`): exception records rejected as implementable — typed box targets needed, as `list` / `container` already have.
- **R6-19** — iOS 18.6: `NativeNavigationBarStatesIntegration` 189372/189374 in 1 of 3 runs at load 8–12 — `manual-ltr arrow-forward t+50` tab2 / tab3 state layers one frame ahead of Chrome after an arrow key (keyboard path; the R6-16 press check passes in all runs).

## Initial audit (2026-10-31)

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-navigation-bar`, `md-navigation-tab`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

### Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix bar 4/1/2/1/7 + 1 part, destination 13/1/1/3/22 + 7 parts (the stylesheet's 22 hooks; the CEM lists 12). Gaps: parts (R6-03); `--md-navigation-tab-slotted-icon-font` has no test (R6-11); CEM drift (R6-14). |
| 2 Implementation | Pass | Dedicated renderers; decisions (22 hooks, FILL 0, zIndex, authored labelBehavior override, macOS landmark) accepted. |
| 3 Laboratory | Pass | Both renderers: hooks, labelBehavior update, select(1) → mdChange `{1, 0}`, focusTab(2), focusEl(); 12/12 live frames valid; 17+17 + 9 extra examples compile. |
| 4 Behaviour | Pass | States suites and host tests pass on all platforms. |
| 5 Visual | Pass (with R6-11) | Rendered views measured against Chrome 153 (77 paint cases incl. slotted icons). |
| 6 Runtime + a11y | **FAIL (iOS 18.6)** | macOS, iPhone / iPad iOS 26.3 and Android pass; iPhone 16 Pro iOS 18.6 fails one press check deterministically (3/3 runs, R6-16); tools/ax 0 open with accepted landmark expectations; gate-6 rows missing from ios-harness.md (R6-07). |
| 7 Independent audit | This document | FAIL until R6-03, R6-11 and R6-16 are resolved. |

### Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeNavigationBarPaintIntegration` | 14,500/14,500 | 14500/14500 | r6-003 |
| macOS `NativeNavigationBarStatesIntegration` | 189,386/189,386 | 189386/189386 | r6-003 |
| iOS harness `NativeNavigationBarPaintIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 14,500/14,500 (iPhone only) | 14500/14500 / 14500/14500 / 14500/14500 | r6-005 / r6-011 |
| iOS harness `NativeNavigationBarStatesIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 189,386/189,386 (iPhone only) | 189338/189338 / 189386/189386 / **189361/189362** (3/3 runs, R6-16) | r6-005 / r6-011 |
| Android `NativeNavigationBarParityTest` paint / states | 13,123/13,123 · 189,338/189,338 | 13123/13123 · 189338/189338 | r6-A001 |
| Android `LivePreviewNavigationBarHostTest` | 2/2 | 2/2 | r6-A001 |
| SwiftUI live host `test-live-navbar.mjs` | 27/27 | 27/27 (12/12 frames valid) | r6-008, r6-010 |

### Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

### Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| md-navigation-bar session + hook, update `labelBehavior: selected` | ok (the label fade lands after the immediate reply frame; the live-host test checks it after 400 ms) | ok, frame changed |
| `select(1)` / `focusTab(2)` | mdChange `{index: 1, previousIndex: 0}` / ok | same |
| md-navigation-tab session + hook, update `badge`, `focusEl()` | ok | ok |

Examples: 17 + 17 (fork set) and 9 extra API examples (`icon` / `active-icon` / default slots, methods, events): SwiftUI typecheck exit 0
(r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

### Gate 6 — accessibility

tools/ax (cases `bar`, `manual`, `destination`, `soft-disabled`): 0 open on macOS and iOS (2 accepted on iOS). Android:
md-navigation-bar 0 open (2 accepted) / md-navigation-tab 0 open.

### Exceptions and expectations

No exception records are proposed. Expectations reviewed: navigation landmark missing on iOS / Android — accepted (container-only
landmarks in UIKit, no landmark role in Compose).

### Findings

| ID | Summary |
| --- | --- |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-11 | hooks without tests; slider value-indicator-reserve not in typed appearance / Laboratory |
| R6-16 | md-navigation-bar states on iOS 18.6: press state layer ahead of Chrome (1 check, 3/3 runs) |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |
| R6-14 | CEM drift not regenerated |

### Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
