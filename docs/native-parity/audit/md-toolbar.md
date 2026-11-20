# Gate 7 audit — md-toolbar

**Verdict (re-check 2026-11-15): PASS** — gate-7 reviewer s7-10 (previous: re-check 2026-11-09 FAIL (R6-17), gate-7 reviewer r6).

## Re-check 2026-11-15 (gate-7 reviewer s7-10, story 7-10)

Third re-check, independent, of the fixes marked ready for re-check: d6 story 5-1 (R6-17 typed box targets for the five wrapper parts, installed 5-1-100; R6-18 iPad fixture item and R6-22 / R6-23, installed d6-054) and story 5-2 (R6-15 slot refresh, installed 5-2-008). Snapshot `work/audit/s7-10-tree` taken by s7-10-001 (canonical at 2026-11-15 15:16 Mac time, 227 install jobs, latest 1-1-md-transfer-list-finish-and-install-036, 1-2-md-search-finish-and-install-A024, 5-2-010); canonical differs from the snapshot afterwards only in other components' files (s7-10-008: NativeTextField.swift, TextFieldModel.swift, docs and story files). Jobs: Mac lane d6b (s7-10-001 ... 011), Android lane a3 (s7-10-A001 ... A004, emulator-5560), simulators AWC-d6b (iPhone 17 Pro 26.3), AWC-d6b-18 (iPhone 16 Pro 18.6), AWC-d6b-ipad (iPad Pro 26.3), cloned from the d6 simulators and shut down by the harness on exit. Timing suites ran through `tools/slot.sh timing 4`; the iOS harness kept its accessibility runtime on (`ax=1/1/0`). Evidence: `work/audit/s7-10/` (`macos/`, `ios-iphone/`, `ios-ios18/`, `ios-ipad/`, `android/`, `lab/`, `ax/`, `examples/`, `r615/`) and `claude-runner/done/s7-10-*.log`.


### Findings re-checked

| ID | Fix claimed | s7-10 re-check |
| --- | --- | --- |
| R6-17 | 5-1-100: the five wrapper parts are typed `AWCPartBox` targets (background, border, radius, padding with layout shift) on SwiftUI and Compose; the exception records are removed | **VERIFIED** — `AWCPartBox` is in the SwiftUI and Compose sources; the Mac Chrome `::part()` box cases are in the shared fixtures (toolbar fab-container box cases); paint passes on macOS, iPhone 26.3, iOS 18.6 and Android (counts below, higher than the 2026-11-09 counts by the box cases); the part examples of the family compile on both platforms (27 + 27). The rejected exception was implementable and is now implemented. |
| R6-18 (iPad) | d6-054: the helper buttons of the states fixtures are drawn at 5 % opacity so the iPad focus engine keeps them | **VERIFIED** — iPad Pro 26.3 `NativeToolbarStatesIntegration` 2396/2396 in 3 of 3 runs and `NativeNavigationBarStatesIntegration` 189386/189386 (s7-10-005); macOS 2396/2396 in 3 of 3 full runs and 66/66 in 2 of 2 `fab-light-ltr` runs, FRAMEWAIT 0; iPhone 26.3 and iOS 18.6 2396/2396. Together with r6's 30 earlier runs there is no recurrence of the r6-017 signature. |

### Re-runs (s7-10, own runs on the fresh snapshot)

| Suite | Claimed by d6 (5-1) | s7-10 | Job |
| --- | --- | --- | --- |
| macOS `NativeToolbarPaintIntegration` / `StatesIntegration` | 8416 / 2396 | 8416/8416 / 2396/2396 in 3 of 3 full runs; `fab-light-ltr` only 66/66 in 2 of 2; FRAMEWAIT 0 in every run | s7-10-002 |
| iPhone 17 Pro 26.3 paint / states | 8416 / 2396 | 8416/8416 / 2396/2396 | s7-10-005 |
| iPhone 16 Pro 18.6 paint / states | 8416 / 2396 | 8416/8416 / 2396/2396 | s7-10-005 |
| iPad Pro 26.3 states (R6-18 iPad item) | 2396 x6 | 2396/2396 in 3 of 3 runs | s7-10-005 |
| Android `NativeToolbarParityTest` paint / states + `LivePreviewNavHostTest` toolbar tests | 7816 / 1904 | 7816 / 1904, 0 failures; `toolbarLifecycle`, `toolbarHooksUpdatesAndSetFocus` ok | s7-10-A001 |
| SwiftUI live host + Laboratory inspection schema | 29 checks | 29 checks (test-live-nav toolbar part), frames pass the schema | s7-10-004 |
| Laboratory 4177 probes (SwiftUI + Android: typed hooks, retained update, methods, events; standalone crumb inks, panel default / active) | pass | probe-lab2 18/18 sessions; probe-lab4/5/6 pass | s7-10-004 |
| tools/ax macOS / Web / iOS / Android + compare | 0 open | 0 open findings (4 cases (docked, generic, vertical, ...)); expectations file unchanged for these tags (only other components' records added) | s7-10-006, s7-10-A004 |
| Copyable examples | 27 SwiftUI part examples typecheck | SwiftUI: 12 + 51 shared views + 27 part views typecheck exit 0; Compose: 12 + 51 + 27 part composables compile (classes produced, clean recompile leaves 0) | s7-10-004, s7-10-007, s7-10-A002 |
| Checkpoint pins | - | stale pins (see hygiene finding S7-10-01); the evidence above was produced on code identical to canonical for this family | s7-10-008 |

Contract matrix (gate 1): the inventory was regenerated on canonical (s7-10-010) and compared with r6's of 2026-11-09. Property / event / method / slot sets of the family are unchanged. Differences: md-breadcrumbs gains the documented `separator` part (R6-14, typed on both platforms); md-tab drops the two `@private` glide variables from the hooks; md-navigation-tab lists its ten colour hooks as documented custom properties (they were already exercised by the shared paint oracles); md-tab-panel's source changed by the slot refresh (R6-15). No row without SwiftUI, Compose, Laboratory exposure and a test.

Evidence-currency check: the Mac Chrome 153 `::part()` box oracles are in the shared paint fixtures, byte-identical between the iOS and the Android copy (md5 equal for tabs, navbar, breadcrumbs, toolbar); the counts above are from my runs, not from the claim.

### Exception decisions

No exception (md-toolbar.md: "None"; the R6-17 `fab-container` record is gone, typed target). tools/ax expectations for md-toolbar (Separator text-extra, Android touch target and text-extra) are unchanged conventions.

### Verdict

**PASS** — gate-7 reviewer s7-10, 2026-11-15. All seven gates are met by current evidence for md-toolbar. No blocking finding is open. Non-blocking: S7-10-01 (checkpoint pins stale, DEFECTS.md), S7-10-02 (informational, Android md-navigation-rail capture flake outside this family).

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
| R6-18 | d6-049: capture-window test defect — the off-screen window's frame clock stalled, so the bitmap was the frame of the input itself; the fixture now counts `TimelineView(.animation)` frames and reads a phase only after three frames following its input (≤ 1 s; a phase without frames fails as such; waits logged as FRAMEWAIT) | **VERIFIED on macOS, iPhone 26.3 and iOS 18.6** — fix reviewed (test-harness only; the wait applies only when fewer than three frames were drawn since the input, so it cannot hide a late native transition, and it was never needed here). `NativeToolbarStatesIntegration` 2396/2396 in 5 of 5 full runs and 66/66 in 6 of 6 `fab-light-ltr`-only runs (r6-025, load 6–20), FRAMEWAIT 0 in every run; with d6-048's 17 and d6-049's 2 runs, 30 runs without the r6-017 signature (it hit 1 of 7 runs in r6's 11-07 re-check, 2 of 16 in d6-044). iPad Pro 26.3 2396/2396 in 3 of 3 runs, but di's iPad Shift+Tab fixture item (edge helpers at 1 % opacity, `work/di-lab/patch/r618-ipad-edge-opacity.py`) is not installed: that part stays open with d6 / di. |
| R6-17 | — | open (no fix yet) |

### Re-runs

| Suite | r6 (r6-024 snapshot) | Job |
| --- | --- | --- |
| macOS `NativeToolbarPaintIntegration` | 8006/8006 | r6-025 |
| macOS `NativeToolbarStatesIntegration` | 2396/2396 ×5 full, 66/66 ×6 fab-only; FRAMEWAIT 0 | r6-025 |
| iOS harness paint — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 8006/8006 · 8006/8006 | r6-027 |
| iOS harness states — iPhone 26.3 / iOS 18.6 / iPad Pro 26.3 | 2396/2396 · 2396/2396 · 2396/2396 ×3 | r6-027 |
| Android `NativeToolbarParityTest` paint / states | 7459/7459 · 1904/1904 | r6-A010 |
| Android `LivePreviewNavHostTest` (md-toolbar tests) | pass | r6-A010 |
| SwiftUI live host `test-live-nav.mjs` — md-toolbar part | 29/29 checks in 2 of 2 runs; all 29 frames of the r6-026 run pass the server schema (the file's md-app-bar part, n5's, failed 1 of 2 runs — reported for routing) | r6-026, r6-A012 |
| Laboratory 4177 (SwiftUI + Android): hooks, `variant` update, `setFocus()` | pass (probe-lab2, probe-lab6) | r6-026, r6-A013 |
| tools/ax macOS / Web / iOS / Android | 4 cases, 0 open findings | r6-028, r6-A015 |
| Copyable examples (11-07 sets) | SwiftUI typecheck 12 + 51 shared views; Compose 12 + 51 composables compile | r6-026, r6-A011 |

### Open findings

- **R6-17** — Layout-wrapper parts (md-breadcrumbs `overflow`, md-tab `content`, md-navigation-tab `container` / `icon-container`, md-toolbar `fab-container`): exception records rejected as implementable (2026-11-07); no fix yet.
- R6-18, iPad part — di's fixture edge-opacity item, not installed yet (d6 / di).

## Re-check 2026-11-07

Re-check of the fixes d6 (R6-01…03, 07…12, 14) and di (R6-16) installed for this family, independently, on a fresh snapshot:
`work/audit/r6-tree` refreshed by r6-016 (canonical at 2026-11-07 01:19 EET; 87 install jobs, the latest r2-044, d4-064, d6-038, r4-063,
di-045, d6-037; build products rebuilt incrementally). Jobs: r6-016…r6-020, r6-0185…r6-0188 (Mac lane r6), r6-A006…r6-A008 (Android lane
a6, emulator-5566). Timing-sensitive runs went through `tools/slot.sh timing 4`; simulators and Chrome were shut down on exit. Evidence:
[`work/audit/r6/recheck/`](../../../../audit/r6/recheck/) (`macos/`, `ios-iphone/`, `ios-ios18/`, `android/`, `lab/`, `ax/`, `examples/`, `gate1/`).

### Findings of 2026-10-31

| ID | Finding | Fix claimed | r6 re-check |
| --- | --- | --- | --- |
| R6-01 | Laboratory SwiftUI preview rejected | schema-conforming metrics; frames validated | VERIFIED — 10/10 live-host frames pass the server schema (r6-018); through 4177 the SwiftUI and Android sessions open, update `variant` and `setFocus()` (r6-018 probe) |
| R6-03 | parts without native target | 1 typed part (container) + 1 exception (fab-container) | typed `container` VERIFIED (paint 8006/8006 incl. 10 `::part()` cases, Android parity, example compiles); `fab-container` exception **rejected** → R6-17 |
| R6-07 | iOS gate-6 rows missing | rows in md-toolbar.md (d6-030) | VERIFIED — logs match; r6 re-ran iPhone 26.3 and iOS 18.6 |

### Re-runs

| Suite | Claimed (d6 / di) | r6 re-check | Job |
| --- | --- | --- | --- |
| macOS `NativeToolbarPaintIntegration` | 8006/8006 (d6-026) | 8006/8006 | r6-017 |
| macOS `NativeToolbarStatesIntegration` | 2255/2255 | **2254/2255** in r6-017 (`fab-light-ltr shiftTab` flat pixels, FAB area 3299 px, worst 26 levels: native [210,195,236] vs Chrome [234,221,255], load 6–9); then 2255/2255 in 4 full reruns and 61/61 in 2 focused reruns (R6-18) | r6-017, r6-0185, r6-0188 |
| iOS harness paint — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 8006/8006 each (d6-030) | 8006/8006 · 8006/8006 | r6-019 |
| iOS harness states — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 2255/2255 each (d6-030) | 2255/2255 · 2255/2255 | r6-019 |
| iPad Pro 11-inch (M5) 26.3 paint / states | 8006 / 2255 (d6-030) | not re-run; d6 logs read: 8006/8006, 2255/2255 | — |
| Android `NativeToolbarParityTest` paint / states | pass (d6-A005/A007) | 7459/7459 · 1904/1904 | r6-A006 |
| Android `LivePreviewNavHostTest` | 2/2 | 2/2 | r6-A006 |
| SwiftUI live host `test-live-nav.mjs` | 10/10 frames | 29/29 checks; 10/10 frames | r6-018 |

Shared fixtures (paint / states / reduced JSON and paint PNGs) are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets; the new `::part()` and hook cases come from Mac Chrome 153 (`oracle.browser`).

### Gate 1 — matrix

Re-built on the snapshot ([`recheck/gate1/matrix.md`](../../../../audit/r6/recheck/gate1/matrix.md), helper `matrix2.mjs`; part rows read the policies' `visualParts`). Every property, event, method, slot and hook row has SwiftUI, Compose, Laboratory and test coverage (the remaining "none" cells are the ones reviewed on 2026-10-31: frame events, `#symbol` slot children, trail-managed `itemIndex` / `itemTotal`, `@private` glide variables) or an accepted exception (`rel`; md-tab `controls` on iOS / Android). Parts: see the table above.

### Gate 3 — Laboratory

Through 4177 (r6-018): the SwiftUI session now opens (hooked and plain), update `variant: docked` (changed), `setFocus()`; Android the same. Examples: 12 + 12 (fork set) and the slot / method / typed-part examples compile (r6-018, r6-A007).

### Gate 6 — accessibility

tools/ax (r6-020, r6-A008): 0 open on macOS, iOS, Android (accepted: separator text, Android label / ATF target-size conventions).

### Exception decisions

| Exception | Record | Decision |
| --- | --- | --- |
| md-toolbar `::part(fab-container)` | all fields present | **Rejected** — gate-7 reviewer r6, 2026-11-07. Every field of the record is present, but the gap is implementable: the record's
reason is that "a wrapper box model is not interpreted", which is a renderer choice, not a platform limit. The same renderers already
implement box styling of wrapper parts through typed part targets (md-breadcrumbs `list`: background and physical padding;
md-tabs / md-navigation-bar / md-toolbar `container`: fill), so a typed target with the wrapper's box properties (background, border width /
colour, corner radius, padding with the layout shift, as `list` does) and Mac Chrome `::part()` oracle cases is the implementable approach
(AUDIT.md: "Do not waive implementable gaps as platform differences"; consistent with r3-18 and R5-06). → R6-17. |

### Open findings

- **R6-17** — Layout-wrapper parts (md-breadcrumbs `overflow`, md-tab `content`, md-navigation-tab `container` / `icon-container`, md-toolbar `fab-container`): exception records rejected as implementable — typed box targets needed, as `list` / `container` already have.
- **R6-18** — macOS `NativeToolbarStatesIntegration` failed 1 check in 1 of 5 full runs at low load (`fab-light-ltr shiftTab` FAB area darker natively); cause unknown — a timing defect until shown otherwise (PARALLEL.md load discipline).

## Initial audit (2026-10-31)

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-toolbar`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

### Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix 8/0/1/4/11 + 2 parts. Gap: parts `container`, `fab-container` (the component doc says "no parts"; R6-03). |
| 2 Implementation | Pass | Dedicated renderers; decisions accepted. |
| 3 Laboratory | **FAIL** | The SwiftUI preview never opens through the Laboratory server: every frame is rejected as invalid layout measurements (R6-01). Android: session, hook, update, setFocus() pass. 11+11 examples compile. |
| 4 Behaviour | Pass | States suites (roving focus, re-sync, pointer, RTL) and host tests pass. |
| 5 Visual | Pass | Rendered views measured against Chrome 153 (116 paint cases + 3 aria-labelledby checks). |
| 6 Runtime + a11y | Pass (doc R6-07) | macOS, iOS (3 runtimes, r6) and Android pass; tools/ax 0 open with accepted expectations. |
| 7 Independent audit | This document | FAIL until R6-01 and R6-03 are resolved. |

### Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeToolbarPaintIntegration` | 7,466/7,466 | 7466/7466 | r6-003 |
| macOS `NativeToolbarStatesIntegration` | 2,255/2,255 | 2255/2255 | r6-003 |
| iOS harness `NativeToolbarPaintIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 7,466/7,466 (iPhone only) | 7466/7466 / 7466/7466 / 7466/7466 | r6-005 / r6-011 |
| iOS harness `NativeToolbarStatesIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 2,255/2,255 (iPhone only) | 2255/2255 / 2255/2255 / 2255/2255 | r6-005 / r6-011 |
| Android `NativeToolbarParityTest` paint / states | 6,999/6,999 · 1,904/1,904 | 6999/6999 · 1904/1904 | r6-A001 |
| Android `LivePreviewNavHostTest` | 2/2 | 2/2 | r6-A001 |
| SwiftUI live host `test-live-nav.mjs` | 29 checks | 29/29 (**10/10 frames fail the server schema**, R6-01) | r6-008, r6-010 |

### Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

### Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| session (recipe: floating "Formatting") with and without `containerColor` | **502 INVALID_LIVE_FRAME** — `padding` / `margin` / `gap` reported as numbers (R6-01) | ok |
| update `variant: docked`, `setFocus()` | not reachable | ok, frame changed |

Examples: 11 SwiftUI + 11 Compose (incl. the leading / trailing / fab slots): SwiftUI typecheck exit 0 (r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

### Gate 6 — accessibility

tools/ax (cases `default`, `docked`, `vertical`, `generic`): 0 open on macOS (1 accepted) and iOS (4 accepted). Android: 0 open (10 accepted).

### Exceptions and expectations

No exception records (the doc states none). Expectations reviewed: the divider exposed as "Separator" text, Android label and
divider as text, Android ATF touch-target size (44 dp pitch equals the Web geometry) — accepted.

### Findings

| ID | Summary |
| --- | --- |
| R6-01 | md-toolbar SwiftUI Laboratory preview rejected (inspection metrics schema) |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |

### Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
