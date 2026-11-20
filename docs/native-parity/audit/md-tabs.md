# Gate 7 audit — md-tabs (+ md-tab, md-tab-panel, md-tab-panels)

**Verdict (re-check 2026-11-15): PASS** — gate-7 reviewer s7-10 (previous: re-check 2026-11-09 FAIL (R6-17), gate-7 reviewer r6).

## Re-check 2026-11-15 (gate-7 reviewer s7-10, story 7-10)

Third re-check, independent, of the fixes marked ready for re-check: d6 story 5-1 (R6-17 typed box targets for the five wrapper parts, installed 5-1-100; R6-18 iPad fixture item and R6-22 / R6-23, installed d6-054) and story 5-2 (R6-15 slot refresh, installed 5-2-008). Snapshot `work/audit/s7-10-tree` taken by s7-10-001 (canonical at 2026-11-15 15:16 Mac time, 227 install jobs, latest 1-1-md-transfer-list-finish-and-install-036, 1-2-md-search-finish-and-install-A024, 5-2-010); canonical differs from the snapshot afterwards only in other components' files (s7-10-008: NativeTextField.swift, TextFieldModel.swift, docs and story files). Jobs: Mac lane d6b (s7-10-001 ... 011), Android lane a3 (s7-10-A001 ... A004, emulator-5560), simulators AWC-d6b (iPhone 17 Pro 26.3), AWC-d6b-18 (iPhone 16 Pro 18.6), AWC-d6b-ipad (iPad Pro 26.3), cloned from the d6 simulators and shut down by the harness on exit. Timing suites ran through `tools/slot.sh timing 4`; the iOS harness kept its accessibility runtime on (`ax=1/1/0`). Evidence: `work/audit/s7-10/` (`macos/`, `ios-iphone/`, `ios-ios18/`, `ios-ipad/`, `android/`, `lab/`, `ax/`, `examples/`, `r615/`) and `claude-runner/done/s7-10-*.log`.


### Findings re-checked

| ID | Fix claimed | s7-10 re-check |
| --- | --- | --- |
| R6-17 | 5-1-100: the five wrapper parts are typed `AWCPartBox` targets (background, border, radius, padding with layout shift) on SwiftUI and Compose; the exception records are removed | **VERIFIED** — `AWCPartBox` is in the SwiftUI and Compose sources; the Mac Chrome `::part()` box cases are in the shared fixtures (tabs `box-content-primary-ltr`, `box-content-secondary-dark-rtl` and the other `box-content-*` cases); paint passes on macOS, iPhone 26.3, iOS 18.6 and Android (counts below, higher than the 2026-11-09 counts by the box cases); the part examples of the family compile on both platforms (27 + 27). The rejected exception was implementable and is now implemented. |
| R6-23 | d6-054: inherited text in an md-tab-panel paints the theme `on-surface` on both platforms (convention recorded in md-tabs.md) | **VERIFIED** — probe-lab4: the active panel copy paints #1C1B1F on SwiftUI and Android, inactive default unpainted, toggles both ways; `LivePreviewTabsHostTest.tabPanelPage` passes (s7-10-A001). Convention accepted (inherited text takes the theme token; reversible by removing the Compose panel colour). |
| R6-15 | 5-2-008: `refreshNewSlots()` re-inserts each new default slot on the next frame and 250 ms later (md-tab-panel, md-step; breadcrumbs by d6-038) | **VERIFIED** — 24 cold Web tools/ax loads on the installed canonical dist (s7-10-009, `d6-lab/s52/measure.sh`): md-breadcrumbs collapsed 24/24 and trail 24/24 with the crumb text, md-tab-panel 24/24, md-stepper (5 cases) 24/24 each; 12 cold loads of the active `md-tab-panels/panels` case 12/12 with the panel text (s7-10-011). Before the fix d6 measured 5/24 and 3/24 missing; now 0 missing in 216 loads. |
| R6-18 (iPad) | d6-054 fixture patch also installed in the tabs states test | **VERIFIED** for tabs: iPhone 26.3 / iOS 18.6 states 132004/132004 (iPad toolbar and navigation-bar runs cover the same helper-button patch) | |

### Re-runs (s7-10, own runs on the fresh snapshot)

| Suite | Claimed by d6 (5-1) | s7-10 | Job |
| --- | --- | --- | --- |
| macOS `NativeTabsPaintIntegration` / `StatesIntegration` | 16111 / 137124 | 16111/16111 / 137124/137124 | s7-10-002 |
| iPhone 17 Pro 26.3 paint / states | 16111 / 132004 | 16111/16111 / 132004/132004 | s7-10-005 |
| iPhone 16 Pro 18.6 paint / states | 16111 / 132004 | 16111/16111 / 132004/132004 | s7-10-005 |
| Android `NativeTabsParityTest` paint / states + `LivePreviewTabsHostTest` | 12814 / 136956, 0 failures | 12814 / 136956, 0 failures; host tests ok (`tabPanelPage`, `tabPage`, `tabPanelsPage`, `tabsHooksSelectTabAndUpdates`) | s7-10-A001 |
| SwiftUI live host + Laboratory inspection schema | 46 checks | 46 checks, 22 frames pass the schema | s7-10-004 |
| Laboratory 4177 probes (SwiftUI + Android: typed hooks, retained update, methods, events; standalone crumb inks, panel default / active) | pass | probe-lab2 18/18 sessions; probe-lab4/5/6 pass | s7-10-004 |
| tools/ax macOS / Web / iOS / Android + compare | 0 open | 0 open findings (tabs 2, tab 2, tab-panel 1, tab-panels 1); expectations file unchanged for these tags (only other components' records added) | s7-10-006, s7-10-A004 |
| Copyable examples | 27 SwiftUI part examples typecheck | SwiftUI: 20 + 51 shared views + 27 part views typecheck exit 0; Compose: 20 + 51 + 27 part composables compile (classes produced, clean recompile leaves 0) | s7-10-004, s7-10-007, s7-10-A002 |
| Checkpoint pins | - | stale pins (see hygiene finding S7-10-01); the evidence above was produced on code identical to canonical for this family | s7-10-008 |

Contract matrix (gate 1): the inventory was regenerated on canonical (s7-10-010) and compared with r6's of 2026-11-09. Property / event / method / slot sets of the family are unchanged. Differences: md-breadcrumbs gains the documented `separator` part (R6-14, typed on both platforms); md-tab drops the two `@private` glide variables from the hooks; md-navigation-tab lists its ten colour hooks as documented custom properties (they were already exercised by the shared paint oracles); md-tab-panel's source changed by the slot refresh (R6-15). No row without SwiftUI, Compose, Laboratory exposure and a test.

Evidence-currency check: the Mac Chrome 153 `::part()` box oracles are in the shared paint fixtures, byte-identical between the iOS and the Android copy (md5 equal for tabs, navbar, breadcrumbs, toolbar); the counts above are from my runs, not from the claim.

### Exception decisions

No new exception. Standing: md-tab `controls` / aria-controls on iOS and Android (gate-7 reviewer r6, 2026-11-07: UIKit and Compose have no element relation, record complete, macOS implemented and tested) and the narrow tools/ax change for the iOS tab-panel focus stop (accepted r6, 2026-11-09; re-run today: md-tab-panels Tab order records `AWCNativeButtonFocusView`, traits [], containerType semanticGroup). The R6-17 `content` exception record is gone (typed target). tools/ax expectations (`tabpanel` missing, md-tabs Android text-extra) unchanged: conventions.

### Verdict

**PASS** — gate-7 reviewer s7-10, 2026-11-15. All seven gates are met by current evidence for md-tabs, md-tab, md-tab-panel and md-tab-panels. No blocking finding is open. Non-blocking: S7-10-01 (checkpoint pins stale, DEFECTS.md), S7-10-02 (informational, Android md-navigation-rail capture flake outside this family).

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
| R6-20 | d6-047: the iOS focus surface of role tabpanel has no traits and the semantic-group container type, with the panel's name; tools/ax records `containerType` and treats a focused traitless semantic group as a `group` stop equivalent to a Web `tabpanel` stop | **VERIFIED** — tools/ax iOS (r6-028, iPhone 26.3): md-tab-panels Tab order web [tabpanel:] → ios [group: \| ∅], 0 open findings for md-tabs / md-tab / md-tab-panel / md-tab-panels on macOS, iOS and Android; the probe's raw focus record is `AWCNativeButtonFocusView`, traits [], containerType semanticGroup, label "" (the Web panel's name in this case is empty too). tools/ax change **accepted** (below). |
| R6-21 (md-tab-panel page) | d6-047: the LiveRenderer md-tab-panel page takes `active` from the request (absent = inactive) | **VERIFIED** — through 4177 (probe-lab4) the default page is inactive and unpainted on SwiftUI and Android; `active: true` paints the copy at configure and as an update, `active: false` removes it again; `test-live-tabs.mjs` 45/45 (incl. d6's pixel checks), 22/22 frames pass the server schema. |
| R6-17 | — | open (no fix yet) |

### Re-runs

| Suite | r6 (r6-024 snapshot) | Job |
| --- | --- | --- |
| macOS `NativeTabsPaintIntegration` / `StatesIntegration` | 15379/15379 · 137124/137124 | r6-025 |
| iOS harness paint — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 15379/15379 · 15379/15379 | r6-027 |
| iOS harness states — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 132004/132004 · 132004/132004 | r6-027 |
| Android `NativeTabsParityTest` paint / states | 12211/12211 · 136956/136956 | r6-A010 |
| Android `LivePreviewTabsHostTest` | 4/4 | r6-A010 |
| SwiftUI live host `test-live-tabs.mjs` | 45/45 checks; 22/22 frames | r6-026 |
| Laboratory 4177 (SwiftUI + Android): typed hooks, `activeTabIndex` update, `selectTab(2)` → mdTabChange | pass (probe-lab2, probe-lab6) | r6-026, r6-A013 |
| tools/ax macOS / Web / iOS / Android | 0 open findings (md-tabs 2, md-tab 2, md-tab-panel 1, md-tab-panels 1 cases) | r6-028, r6-A015 |
| Copyable examples (11-07 sets) | SwiftUI typecheck 20 + 51 shared views; Compose 20 + 51 composables compile | r6-026, r6-A011 |

Note: the tools/ax `md-tab-panel/panel` case now captures the Studio default (inactive — Web and natives agree; only the Web's empty
`tabpanel` host remains, an accepted expectation), so the active-panel Tab stop is covered by `md-tab-panels/panels` only; an active
standalone case would keep it covered.

### Exception / tooling decision

| Change | Decision |
| --- | --- |
| tools/ax (d6-047): `run.mjs` records a focused iOS element whose probe record has containerType semanticGroup and no traits as a `group` stop; `compare.mjs` `FOCUS_EQUIVALENTS` accepts `group` for a Web `tabpanel` stop on iOS | **Accepted** — gate-7 reviewer r6, 2026-11-09. Narrow: both conditions are read from the real UIKit object (`AccessibilityProbe.swift` now records `accessibilityContainerType`), the equivalence applies only on iOS, only to a Web `tabpanel` stop and only in the Tab-order check, and the stop names are still compared; any other focused role still reports. UIKit has no tab-panel role, and a semantic-group container is its closest container semantics (the SwiftUI group stays the panel's element for VoiceOver). |

### New finding (minor)

- **R6-23** — Laboratory md-tab-panel page: the recipe copy paints #1C1B1F (on-surface) in the SwiftUI preview and #000000 in the Compose preview (probe-lab4). The source sets no colour on the panel (the copy inherits the page's colour; the Studio's Web preview inherits its body `--ink`), and no native convention is recorded. Needs one convention for inherited text in a panel, followed by both previews, with a glyph-ink check. Minor; not blocking on its own.

### Open findings

- **R6-17** — Layout-wrapper parts (md-breadcrumbs `overflow`, md-tab `content`, md-navigation-tab `container` / `icon-container`, md-toolbar `fab-container`): exception records rejected as implementable (2026-11-07); no fix yet.
- R6-23 (minor) — panel copy colour convention (above).

## Re-check 2026-11-07

Re-check of the fixes d6 (R6-01…03, 07…12, 14) and di (R6-16) installed for this family, independently, on a fresh snapshot:
`work/audit/r6-tree` refreshed by r6-016 (canonical at 2026-11-07 01:19 EET; 87 install jobs, the latest r2-044, d4-064, d6-038, r4-063,
di-045, d6-037; build products rebuilt incrementally). Jobs: r6-016…r6-020, r6-0185…r6-0188 (Mac lane r6), r6-A006…r6-A008 (Android lane
a6, emulator-5566). Timing-sensitive runs went through `tools/slot.sh timing 4`; simulators and Chrome were shut down on exit. Evidence:
[`work/audit/r6/recheck/`](../../../../audit/r6/recheck/) (`macos/`, `ios-iphone/`, `ios-ios18/`, `android/`, `lab/`, `ax/`, `examples/`, `gate1/`).

### Findings of 2026-10-31

| ID | Finding | Fix claimed | r6 re-check |
| --- | --- | --- | --- |
| R6-03 | parts without native target | 6 typed parts + 1 exception (md-tab content) | typed parts VERIFIED (paint 15379/15379 incl. 8 `::part()` cases, Android parity, 6 part examples compile); `content` exception **rejected** → R6-17 |
| R6-07 | iOS gate-6 rows missing | rows in md-tabs.md (d6-030) | VERIFIED — logs match; r6 re-ran iPhone 26.3 and iOS 18.6 |
| R6-08 | active panel not a Tab stop | focus surface / focusable panel; expectation removed | macOS and Android VERIFIED (tools/ax: the panel is the Tab stop after the tablist; expectation gone). **iOS not fixed**: Tab lands on the panel's `AWCNativeButtonFocusView`, exposed as an unnamed *button* (`label ""`, trait button) — tools/ax iOS `focus` finding on md-tab-panel and md-tab-panels (r6-020) → R6-20 |
| R6-09 | `controls` / aria-controls | macOS AXLinkedUIElements; iOS / Android exception | macOS VERIFIED (test-live-tabs: the active tab's AXLinkedUIElements = its panel, also after selectTab(2)); iOS / Android exception **accepted** |
| R6-14 | CEM drift | `@private` glide variables | VERIFIED — only `--md-tab-glide-duration` remains a hook |
| R6-15 | Chrome drops slotted panel text (Web) | open (d6 bisecting) | md-tab-panel Web capture clean in this run (r6-020); still open in DEFECTS.md (d6 bisecting). |

### Re-runs

| Suite | Claimed (d6 / di) | r6 re-check | Job |
| --- | --- | --- | --- |
| macOS `NativeTabsPaintIntegration` | 15379/15379 (d6-026) | 15379/15379 | r6-017 |
| macOS `NativeTabsStatesIntegration` | 137124/137124 | 137124/137124 | r6-017 |
| iOS harness paint — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 15379/15379 each (d6-030) | 15379/15379 · 15379/15379 | r6-019 |
| iOS harness states — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 132004/132004 each (d6-030) | 132004/132004 · 132004/132004 | r6-019 |
| iPad Pro 11-inch (M5) 26.3 paint / states | 15379 / 132004 (d6-030) | not re-run; d6 logs read: 15379/15379, 132004/132004 | — |
| Android `NativeTabsParityTest` paint / states | pass (d6-A002, d6-A008) | 12211/12211 · 136956/136956 | r6-A006 |
| Android `LivePreviewTabsHostTest` | 4/4 | 4/4 | r6-A006 |
| SwiftUI live host `test-live-tabs.mjs` (incl. AXLinkedUIElements) | 43 checks | 43/43 checks (incl. AXLinkedUIElements before / after selectTab(2)); 20/20 frames | r6-018 |

Shared fixtures (paint / states / reduced JSON and paint PNGs) are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets; the new `::part()` and hook cases come from Mac Chrome 153 (`oracle.browser`).

### Gate 1 — matrix

Re-built on the snapshot ([`recheck/gate1/matrix.md`](../../../../audit/r6/recheck/gate1/matrix.md), helper `matrix2.mjs`; part rows read the policies' `visualParts`). Every property, event, method, slot and hook row has SwiftUI, Compose, Laboratory and test coverage (the remaining "none" cells are the ones reviewed on 2026-10-31: frame events, `#symbol` slot children, trail-managed `itemIndex` / `itemTotal`, `@private` glide variables) or an accepted exception (`rel`; md-tab `controls` on iOS / Android). Parts: see the table above.

### Gate 3 — Laboratory

Through 4177 (r6-018): md-tabs session + hook, update `activeTabIndex: 1` (changed), `selectTab(2)` → mdTabChange `{2, 1}` on SwiftUI and Android; md-tab hook and `disabled` update repaint on both; md-tab-panel(s) sessions and updates pass. The SwiftUI md-tab-panel page shows the panel active although the request (and the Studio control) says `active: false` — its sample node sets `active: true` (`Examples.swift`), so the SwiftUI and Android previews of the same request differ (part of R6-21). Examples: 20 + 20 and every slot / method / event / typed-part example (6 parts) compile (r6-018, r6-A007).

### Gate 6 — accessibility

tools/ax (r6-020, r6-A008): md-tabs, md-tab 0 open everywhere; md-tab-panel and md-tab-panels: macOS 0 open (the panel is the Tab stop), Android 0 open, **iOS 1 open each: `focus` — Tab order web [tabpanel] → ios [button (unnamed)]** (R6-20). The R6-09 relation is verified through test-live-tabs (tools/ax cases render one component).

### Exception decisions

| Exception | Record | Decision |
| --- | --- | --- |
| md-tab `controls` on iOS and Android (R6-09) | source behaviour, platform/API, technical reason, user impact, tested native equivalent, evidence — all present | **Accepted** — gate-7 reviewer r6, 2026-11-07. UIKit accessibility has no element-to-element relation (no linked elements) and Compose semantics has none; VoiceOver iOS and TalkBack offer no jump for aria-controls in Chrome / Safari content either. macOS implements it. Tested equivalent: the active panel follows the tablist in reading and Tab order and is named by its tab (tools/ax `md-tab-panel(s)` cases, r6-020 / r6-A008). |
| md-tab `::part(content)` | all fields present | **Rejected** — gate-7 reviewer r6, 2026-11-07. Every field of the record is present, but the gap is implementable: the record's
reason is that "a wrapper box model is not interpreted", which is a renderer choice, not a platform limit. The same renderers already
implement box styling of wrapper parts through typed part targets (md-breadcrumbs `list`: background and physical padding;
md-tabs / md-navigation-bar / md-toolbar `container`: fill), so a typed target with the wrapper's box properties (background, border width /
colour, corner radius, padding with the layout shift, as `list` does) and Mac Chrome `::part()` oracle cases is the implementable approach
(AUDIT.md: "Do not waive implementable gaps as platform differences"; consistent with r3-18 and R5-06). → R6-17. |

### Open findings

- **R6-17** — Layout-wrapper parts (md-breadcrumbs `overflow`, md-tab `content`, md-navigation-tab `container` / `icon-container`, md-toolbar `fab-container`): exception records rejected as implementable — typed box targets needed, as `list` / `container` already have.
- **R6-20** — iOS: the active md-tab-panel's Tab stop is the `AWCNativeButtonFocusView` exposed as an unnamed button (trait button, empty label) — VoiceOver / keyboard users meet "button" for a panel; macOS (group) and Android (focusable named panel) are right.
- **R6-21** — SwiftUI Laboratory preview: a standalone md-breadcrumb-item does not repaint for the link-colour hook or `disabled` (frame byte-identical, label #1C1B1F although the inspection reports the link / hook / disabled colour); no paint case covers a standalone crumb and the live-host test reads only the inspection. Also the md-tab-panel page renders `active` from its sample node, not from the request.
- R6-15 (Web source) is tracked in DEFECTS.md.

## Initial audit (2026-10-31)

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-tabs`, `md-tab`, `md-tab-panel`, `md-tab-panels`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

### Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix md-tabs 6/1/1/1/2 + 1 part, md-tab 9/1/0/2/9 (+2 runtime-internal glide variables) + 6 parts, md-tab-panel 1/0/0/1/0, md-tab-panels 2/0/0/1/0. Gaps: parts (R6-03), md-tab `controls` / aria-controls (R6-09); CEM drift (R6-14). |
| 2 Implementation | Pass (with R6-08) | Dedicated renderers; source decisions reproduced (silent writes, modifier-agnostic arrows, colour fades under reduced motion). |
| 3 Laboratory | Pass | Both renderers: sessions, hooks, retained updates for all four tags, selectTab(2) → mdTabChange `{index: 2, previousIndex: 1}`; 18/18 live frames valid; 20+20 + 8 extra examples compile. |
| 4 Behaviour | Pass | States suites and host tests pass on all platforms. |
| 5 Visual | Pass | Rendered views measured against Chrome 153 (135 paint cases incl. hooks, RTL, density). |
| 6 Runtime + a11y | **FAIL** | Suites pass on macOS, iOS (3 runtimes, r6) and Android; the active panel is not a Tab stop natively (expectation rejected, R6-08); gate-6 rows missing from ios-harness.md (R6-07). |
| 7 Independent audit | This document | FAIL until R6-03, R6-08, R6-09 are resolved. |

### Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeTabsPaintIntegration` | 14,297/14,297 | 14297/14297 | r6-003 |
| macOS `NativeTabsStatesIntegration` | 137,124/137,124 | 137124/137124 | r6-003 |
| iOS harness `NativeTabsPaintIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 14,297/14,297 (iPhone only) | 14297/14297 / 14297/14297 / 14297/14297 | r6-005 / r6-011 |
| iOS harness `NativeTabsStatesIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 132,004/132,004 (iPhone only, n1-A128) | 132004/132004 / 132004/132004 / 132004/132004 | r6-005 / r6-011 |
| Android `NativeTabsParityTest` paint / states | 11,370/11,370 · 136,956/136,956 (n1-A126) | 11370/11370 · 136956/136956 | r6-A001 |
| Android `LivePreviewTabsHostTest` | 4/4 | 4/4 | r6-A001 |
| SwiftUI live host `test-live-tabs.mjs` | 38/38 | 38/38 (18/18 frames valid) | r6-008, r6-010 |

### Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

### Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| md-tabs session + `containerColor` hook, update `activeTabIndex: 1` | ok, hook visible, frame changed | ok, frame changed |
| `selectTab(2)` | mdTabChange `{index: 2, previousIndex: 1}` | same |
| md-tab session + hook, update `disabled` | ok | ok |
| md-tab-panel update `active`; md-tab-panels update `sizing: active` | ok | ok |

Examples: 20 SwiftUI + 20 Compose (fork set) and 8 extra API examples (md-tab `icon` / `badge` slots, events, panels) regenerated from the
snapshot: SwiftUI typecheck exit 0 (r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

### Gate 6 — accessibility

tools/ax (6 cases; `ax/`): md-tabs, md-tab, md-tab-panels 0 open on macOS and iOS; md-tab-panel `panel` had one `text-extra` on macOS /
iOS in the first run (Chrome left the slotted text out of its tree), clean in two Web reruns (R6-15). Android: md-tabs and md-tab 0 open; md-tab-panel and md-tab-panels 0 open with 2 accepted each (the focus expectation among them is rejected by r6, R6-08).

### Exceptions and expectations

No exception records are proposed. Expectations reviewed: md-tabs Android label as text — accepted; md-tab-panel(s) `tabpanel`
role missing on every platform — accepted (no native tab-panel element; content in place, inactive panels hidden, verified);
md-tab-panel(s) **focus** (Web `tabindex=0` on the active panel, no native Tab stop) — **rejected**: an implementable gap waived as a
platform convention, the decision itself names the implementation (R6-08). Source-review decisions (secondary stacked tabs stay 48 px,
silent writes, colour fades under reduced motion, nearest-preceding panels fallback) — accepted.

### Findings

| ID | Summary |
| --- | --- |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-08 | active md-tab-panel not a Tab stop natively (expectation rejected) |
| R6-09 | md-tab `controls` (aria-controls) not implemented, no exception record |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |
| R6-14 | CEM drift not regenerated |
| R6-15 | Chrome drops slotted text from its tree intermittently (tools/ax Web capture); slider reflected "false" booleans |

### Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
