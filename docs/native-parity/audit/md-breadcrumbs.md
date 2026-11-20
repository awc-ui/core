# Gate 7 audit — md-breadcrumbs (+ md-breadcrumb-item)

**Verdict (re-check 2026-11-15): PASS** — gate-7 reviewer s7-10 (previous: re-check 2026-11-09 FAIL (R6-17, R6-22), gate-7 reviewer r6).

## Re-check 2026-11-15 (gate-7 reviewer s7-10, story 7-10)

Third re-check, independent, of the fixes marked ready for re-check: d6 story 5-1 (R6-17 typed box targets for the five wrapper parts, installed 5-1-100; R6-18 iPad fixture item and R6-22 / R6-23, installed d6-054) and story 5-2 (R6-15 slot refresh, installed 5-2-008). Snapshot `work/audit/s7-10-tree` taken by s7-10-001 (canonical at 2026-11-15 15:16 Mac time, 227 install jobs, latest 1-1-md-transfer-list-finish-and-install-036, 1-2-md-search-finish-and-install-A024, 5-2-010); canonical differs from the snapshot afterwards only in other components' files (s7-10-008: NativeTextField.swift, TextFieldModel.swift, docs and story files). Jobs: Mac lane d6b (s7-10-001 ... 011), Android lane a3 (s7-10-A001 ... A004, emulator-5560), simulators AWC-d6b (iPhone 17 Pro 26.3), AWC-d6b-18 (iPhone 16 Pro 18.6), AWC-d6b-ipad (iPad Pro 26.3), cloned from the d6 simulators and shut down by the harness on exit. Timing suites ran through `tools/slot.sh timing 4`; the iOS harness kept its accessibility runtime on (`ax=1/1/0`). Evidence: `work/audit/s7-10/` (`macos/`, `ios-iphone/`, `ios-ios18/`, `ios-ipad/`, `android/`, `lab/`, `ax/`, `examples/`, `r615/`) and `claude-runner/done/s7-10-*.log`.


### Findings re-checked

| ID | Fix claimed | s7-10 re-check |
| --- | --- | --- |
| R6-17 | 5-1-100: the five wrapper parts are typed `AWCPartBox` targets (background, border, radius, padding with layout shift) on SwiftUI and Compose; the exception records are removed | **VERIFIED** — `AWCPartBox` is in the SwiftUI and Compose sources; the Mac Chrome `::part()` box cases are in the shared fixtures (breadcrumbs `box-overflow`, `box-overflow-dark-rtl`, `box-overflow-before0`); paint passes on macOS, iPhone 26.3, iOS 18.6 and Android (counts below, higher than the 2026-11-09 counts by the box cases); the part examples of the family compile on both platforms (27 + 27). The rejected exception was implementable and is now implemented. |
| R6-22 | d6-054: Compose crumb link <-> static swap applied while composing | **VERIFIED** — through 4177 the Android preview of a standalone crumb repaints its label at once: after `update {disabled: true}` the ink is #747476 at +0.8 s, `disabled: false` returns #49454F, `current: true` paints #1E192B at +0.8 s (probe-lab5/6, s7-10-004); `crumbLabelInkFollowsStateChanges` 12/12 and `breadcrumbItemStandaloneHooksAndUpdates` pass on emulator-5560 (s7-10-A001). SwiftUI inks #49454F / #C62828 / #747375 / #1E192B at configure and as updates (probe-lab4). |
| R6-15 | 5-2-008: `refreshNewSlots()` re-inserts each new default slot on the next frame and 250 ms later (md-tab-panel, md-step; breadcrumbs by d6-038) | **VERIFIED** — 24 cold Web tools/ax loads on the installed canonical dist (s7-10-009, `d6-lab/s52/measure.sh`): md-breadcrumbs collapsed 24/24 and trail 24/24 with the crumb text, md-tab-panel 24/24, md-stepper (5 cases) 24/24 each; 12 cold loads of the active `md-tab-panels/panels` case 12/12 with the panel text (s7-10-011). Before the fix d6 measured 5/24 and 3/24 missing; now 0 missing in 216 loads. |

### Re-runs (s7-10, own runs on the fresh snapshot)

| Suite | Claimed by d6 (5-1) | s7-10 | Job |
| --- | --- | --- | --- |
| macOS `NativeBreadcrumbsPaintIntegration` / `StatesIntegration` | 6799 / 76426 | 6799/6799 / 76449/76449 | s7-10-002 |
| iPhone 17 Pro 26.3 paint / states | 6799 / 76473 | 6799/6799 / 76465/76465 | s7-10-005 |
| iPhone 16 Pro 18.6 paint / states | 6799 / 76473 | 6799/6799 / 76426/76426 and 76473/76473 (second run) | s7-10-005 |
| Android `NativeBreadcrumbsParityTest` paint / states / label-ink updates | 6362 / 22306 / 12, 0 failures | 6362 (label ink measured on 291 crumbs) / 22306 / 12, 0 failures; `LivePreviewBreadcrumbsHostTest` ok incl. `crumbLabelInkFollowsStateChanges`, `breadcrumbItemStandaloneHooksAndUpdates` | s7-10-A001 |
| SwiftUI live host + Laboratory inspection schema | 55 checks, 37 frames | 55 checks, 37 frames pass the schema | s7-10-004 |
| Laboratory 4177 probes (SwiftUI + Android: typed hooks, retained update, methods, events; standalone crumb inks, panel default / active) | pass | probe-lab2 18/18 sessions; probe-lab4/5/6 pass | s7-10-004 |
| tools/ax macOS / Web / iOS / Android + compare | 0 open | 0 open findings (2 + 3 cases (breadcrumbs, breadcrumb-item; macOS, Web, iOS, Android)); expectations file unchanged for these tags (only other components' records added) | s7-10-006, s7-10-A004 |
| Copyable examples | 27 SwiftUI part examples typecheck | SwiftUI: 16 + 51 shared views + 27 part views typecheck exit 0; Compose: 16 + 51 + 27 part composables compile (classes produced, clean recompile leaves 0) | s7-10-004, s7-10-007, s7-10-A002 |
| Checkpoint pins | - | stale pins (see hygiene finding S7-10-01); the evidence above was produced on code identical to canonical for this family | s7-10-008 |

Contract matrix (gate 1): the inventory was regenerated on canonical (s7-10-010) and compared with r6's of 2026-11-09. Property / event / method / slot sets of the family are unchanged. Differences: md-breadcrumbs gains the documented `separator` part (R6-14, typed on both platforms); md-tab drops the two `@private` glide variables from the hooks; md-navigation-tab lists its ten colour hooks as documented custom properties (they were already exercised by the shared paint oracles); md-tab-panel's source changed by the slot refresh (R6-15). No row without SwiftUI, Compose, Laboratory exposure and a test.

Evidence-currency check: the Mac Chrome 153 `::part()` box oracles are in the shared paint fixtures, byte-identical between the iOS and the Android copy (md5 equal for tabs, navbar, breadcrumbs, toolbar); the counts above are from my runs, not from the claim.

### Exception decisions

No new exception. The earlier acceptance of md-breadcrumb-item `rel` (gate-7 reviewer r6, 2026-11-07: native apps have no browsing context, all six record fields present, equivalent tested by test-live-breadcrumbs, 55/55 again today) stands. The R6-17 `overflow` exception record is gone (typed target). tools/ax expectations for md-breadcrumbs (iOS/Android landmark `navigation` has no element; Android text-extra for the label) are platform conventions: unchanged since r6, not hidden defects.

### Verdict

**PASS** — gate-7 reviewer s7-10, 2026-11-15. All seven gates are met by current evidence for md-breadcrumbs and md-breadcrumb-item. No blocking finding is open. Non-blocking: S7-10-01 (checkpoint pins stale, DEFECTS.md), S7-10-02 (informational, Android md-navigation-rail capture flake outside this family).

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
| R6-21 | d6-047: slotted label text drawn inside the crumb in its ink (a text node no longer sets the on-surface foreground); glyph-ink checks added to `NativeBreadcrumbsPaintIntegration` and `test-live-breadcrumbs.mjs` | **VERIFIED on SwiftUI.** Through the running 4177 server (probe-lab4 / probe-lab5, r6-026 / r6-A012) the standalone crumb's glyph ink is #49454F (link), #C62828 (link-colour hook), #747375 (disabled = on-surface 61 % over white) at configure *and* as an update and back, #1E192B current (also as an update), #C62828 with the disabled-colour hook; the trail paints the `breadcrumbsAppearance` link hook on its links and keeps the current page #1E192B. Paint 6520/6520 incl. the new glyph-ink checks on macOS, iPhone 26.3 and iOS 18.6. Correction: r6's 11-07 note "Android repaints" compared a frame with the session's blank first frame; measured properly, Android does not → **R6-22**. |
| R6-17 | — | open (no fix yet) |
| R6-15 | — (Web source, d6) | the Web captures of both tags were clean in r6-028 (one run); stays open in DEFECTS.md |

### Re-runs

| Suite | r6 (r6-024 snapshot) | Job |
| --- | --- | --- |
| macOS `NativeBreadcrumbsPaintIntegration` / `StatesIntegration` | 6520/6520 · 76426/76426 | r6-025 |
| iOS harness paint — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 6520/6520 · 6520/6520 | r6-027 |
| iOS harness states — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 76473/76473 · 76473/76473 ×2 | r6-027 |
| Android `NativeBreadcrumbsParityTest` paint / states | 5821/5821 · 22306/22306 | r6-A010 |
| Android `LivePreviewBreadcrumbsHostTest` | 2/2 | r6-A010 |
| SwiftUI live host `test-live-breadcrumbs.mjs` | 55/55 checks; 37/37 frames pass the server schema | r6-026 |
| Laboratory 4177: sessions, typed hooks, retained updates, `expand()` / `collapse()` → mdExpand (SwiftUI + Android) | 18/18 sessions (probe-lab2); inks above (probe-lab4 / 5 / 6) | r6-026, r6-A012, r6-A013 |
| tools/ax macOS / Web / iOS / Android | md-breadcrumbs 2 cases, md-breadcrumb-item 3 cases: 0 open findings; macOS trees as large as on 10-31 / 11-07 | r6-028, r6-A015 |
| Copyable examples (11-07 sets) | SwiftUI typecheck 16 + 51 shared views; Compose 16 + 51 composables compile (classes produced, removed afterwards) | r6-026, r6-A011 |

### New finding

- **R6-22** — Compose (Laboratory preview; production impact not yet known): a standalone md-breadcrumb-item repaints its label one update late. After `update {disabled: true}` the label stays link #49454F (frames at +0.8 / +2 / +4 s byte-identical; an identical second update changes nothing); the next update (`disabled: false`) then paints the disabled ink; `current: true` paints the pill at once but the label stays #49454F until the next update. Configure-time states paint correctly; SwiftUI repaints at once; other Android updates of the four families repaint at once (probe-lab6). The Android host test checks only the pill, and the Android parity suites compare flat pixels (glyphs skipped) — the blind spot R6-21 closed on SwiftUI.

### Open findings

- **R6-17** — Layout-wrapper parts (md-breadcrumbs `overflow`, md-tab `content`, md-navigation-tab `container` / `icon-container`, md-toolbar `fab-container`): exception records rejected as implementable (2026-11-07); no fix yet.
- **R6-22** — Compose standalone crumb label one update late (above).
- R6-15 (Web source) is tracked in DEFECTS.md.

## Re-check 2026-11-07

Re-check of the fixes d6 (R6-01…03, 07…12, 14) and di (R6-16) installed for this family, independently, on a fresh snapshot:
`work/audit/r6-tree` refreshed by r6-016 (canonical at 2026-11-07 01:19 EET; 87 install jobs, the latest r2-044, d4-064, d6-038, r4-063,
di-045, d6-037; build products rebuilt incrementally). Jobs: r6-016…r6-020, r6-0185…r6-0188 (Mac lane r6), r6-A006…r6-A008 (Android lane
a6, emulator-5566). Timing-sensitive runs went through `tools/slot.sh timing 4`; simulators and Chrome were shut down on exit. Evidence:
[`work/audit/r6/recheck/`](../../../../audit/r6/recheck/) (`macos/`, `ios-iphone/`, `ios-ios18/`, `android/`, `lab/`, `ax/`, `examples/`, `gate1/`).

### Findings of 2026-10-31

| ID | Finding | Fix claimed | r6 re-check |
| --- | --- | --- | --- |
| R6-02 | Laboratory SwiftUI preview lost after collapse | collapsed `overflow` gap `{row, column}`; frames validated | VERIFIED — 27/27 live-host frames pass the server schema (r6-018); through 4177: update `maxItems: 2`, `expand()` / `collapse()` → mdExpand on SwiftUI and Android (r6-018 probe) |
| R6-03 | parts without native target | 9 typed parts + 1 exception (overflow) | typed parts VERIFIED (paint 6134/6134 incl. 6 `::part()` cases, Android parity, 9 part examples compile); `overflow` exception **rejected** → R6-17 |
| R6-07 | iOS gate-6 rows missing | rows in md-breadcrumbs.md (d6-030, d6b-006) | VERIFIED — logs match the rows; r6 re-ran iPhone 26.3 and iOS 18.6 (below) |
| R6-10 | `rel` without exception record | exception record + live test (4 rel values) | exception **accepted**; test-live-breadcrumbs passes (r6-018) |
| R6-12 | native-only tooltip | no tooltip in the renderers; doc corrected | VERIFIED — no `.help` / tooltip / title in `NativeBreadcrumbs.swift` / `AWCBreadcrumbs.kt`; docs and the review decision row say "no tooltip" |
| R6-14 | CEM drift | CEM regenerated | VERIFIED — `separator` part in custom-elements.json |
| R6-15 | Chrome drops slotted text (Web) | breadcrumbs source fix installed (d6-038); tab-panel part open | breadcrumbs Web capture clean in this run (r6-020); d6-038's source fix 48/48 cold loads. Open for md-tab-panel (Web source, d6). |

### Re-runs

| Suite | Claimed (d6 / di) | r6 re-check | Job |
| --- | --- | --- | --- |
| macOS `NativeBreadcrumbsPaintIntegration` | 6134/6134 (d6-026) | 6134/6134 | r6-017 |
| macOS `NativeBreadcrumbsStatesIntegration` | 76426/76426 (d6-035) | 76426/76426 | r6-017 |
| iOS harness paint — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 | 6134/6134 each (d6-030) | 6134/6134 · 6134/6134 | r6-019 |
| iOS harness states — iPhone 17 Pro 26.3 / iPhone 16 Pro 18.6 (×3 on 18.6) | 76473/76473 each (d6b-006) | 76465/76465 · 76473/76473 ×3 | r6-019 |
| iPad Pro 11-inch (M5) 26.3 paint / states | 6134 / 76473 (d6-030, d6b-006) | not re-run; d6 logs read: 6134/6134, 76473/76473 (two runs) | — |
| Android `NativeBreadcrumbsParityTest` paint / states | pass (d6-A007/A008) | 5821/5821 · 22306/22306 | r6-A006 |
| Android `LivePreviewBreadcrumbsHostTest` | 2/2 | 2/2 | r6-A006 |
| SwiftUI live host `test-live-breadcrumbs.mjs` | 39 checks | 39/39 checks; 27/27 frames pass the server schema | r6-018 |

Shared fixtures (paint / states / reduced JSON and paint PNGs) are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets; the new `::part()` and hook cases come from Mac Chrome 153 (`oracle.browser`).

### Gate 1 — matrix

Re-built on the snapshot ([`recheck/gate1/matrix.md`](../../../../audit/r6/recheck/gate1/matrix.md), helper `matrix2.mjs`; part rows read the policies' `visualParts`). Every property, event, method, slot and hook row has SwiftUI, Compose, Laboratory and test coverage (the remaining "none" cells are the ones reviewed on 2026-10-31: frame events, `#symbol` slot children, trail-managed `itemIndex` / `itemTotal`, `@private` glide variables) or an accepted exception (`rel`; md-tab `controls` on iOS / Android). Parts: see the table above.

### Gate 3 — Laboratory

Through 4177 (r6-018, `lab/probe-lab2.json`): md-breadcrumbs on SwiftUI and Android — session with `separatorColor` (visible), update `maxItems: 2` (frame changed), `expand()` / `collapse()` → mdExpand `{expanded: true/false, itemCount: 3}` on both. **md-breadcrumb-item on SwiftUI does not repaint** (R6-21): with the link-colour hook, `disabled` (at configure or as an update) the frame is byte-identical to the plain one and the label stays #1C1B1F, while the host's own inspection reports link #49454F → hook #C62828 → disabled 61 % (r6-0187, r6-0189, r6-0190 on the canonical build the server runs and on the snapshot build); `current` does repaint. Android repaints. The live-host test checks only the inspection. Examples: 16 + 16 (fork set) and every slot / method / event / typed-part example (9 parts) regenerated from the snapshot — SwiftUI typecheck exit 0 (r6-018), Compose compile exit 0 with classes for every file (r6-A007).

### Gate 6 — accessibility

tools/ax (r6-020 macOS / Web / iOS, r6-A008 Android; `recheck/ax`): md-breadcrumbs and md-breadcrumb-item 0 open on all platforms (expected: landmark on iOS / Android, Android label text). macOS captures are full trees (same sizes as on 2026-10-31; the Mac screen state did not empty them).

### Exception decisions

| Exception | Record | Decision |
| --- | --- | --- |
| md-breadcrumb-item `rel` (R6-10) | source behaviour, platform/API, technical reason, user impact, tested native equivalent, evidence — all present | **Accepted** — gate-7 reviewer r6, 2026-11-07. Not implementable: a native app has no browsing context, opener or Referer; the property's protective effect is always met. Tested: identical mdSelect and navigation for no rel, `opener`, `noopener noreferrer`, `nofollow external` (test-live-breadcrumbs, r6-018). |
| md-breadcrumbs `::part(overflow)` | scope, source behaviour, platforms/API, reason, impact, tested equivalent, tests — all present | **Rejected** — gate-7 reviewer r6, 2026-11-07. Every field of the record is present, but the gap is implementable: the record's
reason is that "a wrapper box model is not interpreted", which is a renderer choice, not a platform limit. The same renderers already
implement box styling of wrapper parts through typed part targets (md-breadcrumbs `list`: background and physical padding;
md-tabs / md-navigation-bar / md-toolbar `container`: fill), so a typed target with the wrapper's box properties (background, border width /
colour, corner radius, padding with the layout shift, as `list` does) and Mac Chrome `::part()` oracle cases is the implementable approach
(AUDIT.md: "Do not waive implementable gaps as platform differences"; consistent with r3-18 and R5-06). → R6-17. |

### Open findings

- **R6-17** — Layout-wrapper parts (md-breadcrumbs `overflow`, md-tab `content`, md-navigation-tab `container` / `icon-container`, md-toolbar `fab-container`): exception records rejected as implementable — typed box targets needed, as `list` / `container` already have.
- **R6-21** — SwiftUI Laboratory preview: a standalone md-breadcrumb-item does not repaint for the link-colour hook or `disabled` (frame byte-identical, label #1C1B1F although the inspection reports the link / hook / disabled colour); no paint case covers a standalone crumb and the live-host test reads only the inspection. Also the md-tab-panel page renders `active` from its sample node, not from the request.
- R6-15 (Web source) is tracked in DEFECTS.md.

## Initial audit (2026-10-31)

**Verdict: FAIL (findings)** — gate-7 reviewer r6, 2026-10-31.

Scope: `md-breadcrumbs`, `md-breadcrumb-item`. Independent re-run on the r6 snapshot `work/audit/r6-tree` (canonical copied 2026-10-31 02:12 Mac time, 42 installs,
latest fx-072 / fx-068 / n5-037; build products excluded and rebuilt). Job logs: `work/claude-runner/done/r6-*.log`; evidence:
[`work/audit/r6/`](../../../../audit/r6/) (`out/` suites, `gate1/` matrix, `lab/` Laboratory probes, `ax/` tools/ax, `examples/` compiled examples).
Defects: [work/audit/DEFECTS.md](../../../../audit/DEFECTS.md) (r6 section).

### Gates

| Gate | Result | Basis |
| --- | --- | --- |
| 1 Source contract | **Findings** | Matrix 7/1/2/1/4 + 3 parts (trail), 10/1/0/2/8 + 6 parts (crumb): properties, events, methods, slots and hooks are implemented on both platforms, exposed in the Laboratory and tested, except: parts (R6-03), `rel` (R6-10); CEM drift (`separator` part, R6-14). |
| 2 Implementation | **Finding** | Dedicated renderers match the source; native-only hover tooltip on truncated labels (R6-12). |
| 3 Laboratory | **FAIL** | Android preview, update, expand()/collapse() with mdExpand pass; the SwiftUI preview loses its session once the trail collapses (R6-02). 16+16 examples + 7 slot/method/event examples compile. |
| 4 Behaviour | Pass | States suites (interaction, motion, cancellation, runtime property changes, methods) pass on macOS, iOS and Android; host tests pass. |
| 5 Visual | Pass | Rendered views measured against Chrome 153 (99 paint + 12 hook cases, light/dark, RTL, density). |
| 6 Runtime + a11y | **Finding (doc)** | macOS, iOS (3 runtimes, r6) and Android pass; tools/ax 0 open after Web reruns (R6-15); gate-6 rows missing from ios-harness.md (R6-07). |
| 7 Independent audit | This document | FAIL until R6-02, R6-03, R6-10, R6-12 are resolved (R6-07, R6-14, R6-15 documentation / Web follow-ups). |

### Re-runs (gates 2, 4, 5, 6) — claimed vs r6

Counts are each suite's own `passed/total`; suites that sample per rendered frame have device-dependent totals (all failures are listed).
The shared fixtures are byte-identical between `packages/native-ios/Tests/Fixtures` and the Android assets (gzip assets after gunzip);
`tokens.css` copies equal `packages/tokens/src/tokens.css`.

| Suite | Claimed (doc / AUDIT row) | r6 result | Job |
| --- | --- | --- | --- |
| macOS `NativeBreadcrumbsPaintIntegration` | 5,610/5,610 (n1-059) | 5610/5610 | r6-003 |
| macOS `NativeBreadcrumbsStatesIntegration` | 76,426/76,426 (n1-061) | 76426/76426 | r6-003 |
| iOS harness `NativeBreadcrumbsPaintIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 5,610/5,610 (iPhone only) | 5610/5610 / 5610/5610 / 5610/5610 | r6-005 / r6-011 |
| iOS harness `NativeBreadcrumbsStatesIntegration` — iPhone 17 Pro iOS 26.3 / iPad Pro 11" (M5) iOS 26.3 / iPhone 16 Pro iOS 18.6 | 76,333/76,333 (iPhone only) | 76473/76473 / 76473/76473 / 76473/76473 | r6-005 / r6-011 |
| Android `NativeBreadcrumbsParityTest` paint / states (emulator-5566) | 5,335/5,335 · 22,306/22,306 | 5335/5335 · 22306/22306 | r6-A001 |
| Android `LivePreviewBreadcrumbsHostTest` | 2/2 | 2/2 | r6-A001 |
| SwiftUI live host `test-live-breadcrumbs.mjs` | 23/23 | 23/23 (but 4/11 frames fail the server schema, R6-02) | r6-008, r6-010 |

### Gate 1 — source contract matrix

Built from `packages/core/src/components/<tag>/` (TSX + CSS) and `custom-elements.json` (the inventory regenerated from canonical, `gate1/current-inventory.json` (r6-006), carries the same contract; its declared support equals the policy files except md-slider's `inset-icon`, R6-04), every property (default / enum), event (payload / cancel), method, slot, CSS hook (CEM plus stylesheet-only `--md-<tag>-*` references) and part, mapped to the SwiftUI and Compose sources, the Laboratory (appearance modules, `native-property-updates.js`, `native-methods.js`, recipes, native-compiler policies) and tests (fixtures, oracles, Android tests, live-host and studio tests): [`gate1/matrix.md`](../../../../audit/r6/gate1/matrix.md) (helper `gate1/matrix.mjs`; every "none" cell was then checked by hand — form names live in `NativeForms.swift` / `AWCFormControls.kt`, slots in fixtures as `#symbol` children, events reach the Laboratory as frame events). The compiler catalog hashes match today's sources for every tag (no stale generated policy).

### Gate 3 — Laboratory

Laboratory probe through the running server (`http://127.0.0.1:4177`, requests built with the canonical Laboratory modules;
`lab/probe-lab.json`, r6-007): for each tag on the SwiftUI ("iOS" tab) and Android renderers, a session with the recipe and one typed
style hook, one retained property update, every method, events. Live-host frames were also validated against the server's inspection
schema (`lab/frames`, r6-010) because the live-host scripts talk to the renderer directly.

| Probe | SwiftUI | Android |
| --- | --- | --- |
| md-breadcrumbs session + `separatorColor` hook | ok, hook visible (image differs from unhooked) | ok |
| update `maxItems: 2` | **frame rejected (`overflow` gap), session closed** | ok, frame changed |
| `expand()` / `collapse()` | **404 SESSION_NOT_FOUND** (R6-02) | mdExpand `{expanded: true/false, itemCount: 3}` |
| md-breadcrumb-item session + `linkColor`, update `disabled` | ok | ok |

Examples: the fork's 16 SwiftUI + 16 Compose examples and r6's 7 extra API examples (each slot, method and event of both tags) regenerated
from the snapshot: SwiftUI typecheck exit 0 (r6-007), Compose compile exit 0 (r6-A002; classes for all six files verified in r6-A004).

### Gate 6 — accessibility

tools/ax (cases `trail`, `collapsed`, `link`, `current`, `disabled`; `ax/`, r6-008 / r6-A003): macOS and iOS 0 open for md-breadcrumb-item;
md-breadcrumbs `collapsed` had 1 open `text-extra` ("AWC Native") on macOS and iOS in the first run because Chrome left the current crumb's
slotted text out of its tree; two Web reruns were clean (`ax-web1`, `ax-web2`, 0 open) — R6-15. Android: md-breadcrumbs 0 open (4 accepted) /
md-breadcrumb-item 0 open.

### Exceptions and expectations

No exception records are proposed. tools/ax expectations reviewed: navigation landmark missing on iOS / Android and the Android
label read as text — **accepted** (UIKit has landmarks only as container types; Compose has no landmark role; both verified in the captures).
Source-review decisions: toggle kept when nothing collapses, mdExpand cancel ignored, link-only hover nudge, current crumb as plain text —
accepted (Web behaviour reproduced); the native-only tooltip on truncated labels — not accepted (R6-12).

### Findings

| ID | Summary |
| --- | --- |
| R6-02 | md-breadcrumbs SwiftUI Laboratory preview lost after collapse (overflow gap metric) |
| R6-03 | CSS parts: no native part appearance and no exception record |
| R6-10 | md-breadcrumb-item `rel` without exception record |
| R6-12 | native-only tooltip on truncated breadcrumb labels |
| R6-07 | gate-6 iPad 26.3 / iOS 18.6 rows missing from the docs (r6 ran them) |
| R6-14 | CEM drift not regenerated |
| R6-15 | Chrome drops slotted text from its tree intermittently (tools/ax Web capture); slider reflected "false" booleans |

### Re-check

After the owning forks install fixes for the blocking findings, r6 re-runs the affected suites on a fresh snapshot and replaces this verdict.
