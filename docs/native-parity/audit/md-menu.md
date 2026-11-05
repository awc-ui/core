# md-menu (with md-menu-item, md-menu-item-group, md-sub-menu-item) — gate 7 independent audit

**Verdict: FAIL (findings R4-12, R4-13, R4-14, R4-15, R4-16, R4-17)** — gate-7 reviewer r4, 2026-10-31.

Scope: md-menu and its required children md-menu-item, md-menu-item-group, md-sub-menu-item (a parent cannot pass with an
unreviewed child). Snapshot audited: `work/audit/r4-tree` (canonical copy 2026-10-31 02:12 Mac time, job r4-001; md-menu
was installed by n2-046 on 2026-10-30 15:40). Re-runs by r4 on that snapshot (Mac lane r4, Android lane a6 / emulator-5566,
simulator AWC-r4 = iPhone 17 Pro, iOS 26.3.1). Working files: `work/audit/r4/`.

## Evidence freshness

`outputs/native-parity/md-menu/native/checkpoint.json` lists files but no hashes, so it cannot prove which code produced the
counts. The n2 runs were made on `work/n2-full`; canonical shared files (`AWCNativeView.swift`, `NativeFocus.swift`,
`NativeFocusBridge.swift`, `AWCComponent.kt`) changed again 2026-10-30 23:12, and fx's canonical integration (fx-068)
already reported macOS menu states 2,522/2,524. Counts below are r4 re-runs. Oracles: `menu-web-*.json` (Swift) and the
Android assets are byte-identical; they are a normalized derivation of `outputs/native-parity/md-menu/web-oracle/`
(same Chrome 153 metadata; paint: all 138 cases with identical rect multisets; states: the fixture rects are a subset of the
oracle's in all 26 runs).

## Gate 1 — source contract matrix

IR current; CEM = IR = inventory: md-menu 16/2/7/2/8 + 3 parts; md-menu-item 15/1/0/2/5 + 7 parts; md-menu-item-group
2/0/0/1/0; md-sub-menu-item 9/1/1/2/0 + 6 parts.

| Rows | SwiftUI | Compose | Laboratory | Test |
|---|---|---|---|---|
| 42 properties of the four tags | NativeMenu.swift, MenuSupport.swift, MenuScope.swift, MenuController.swift | NativeMenu*.kt | retained updates of all four tags | menu-web-paint (138), menu-web-states (26 + 26 reduced), host tests |
| events `mdOpen`, `mdClose`, `mdClick` (rows, submenu rows) | yes | yes | event stream (probe) | states runs |
| md-menu methods `show({autoFocus})`, `close`, `whenClosed`, `reposition`, `getScrollViewport`; md-sub-menu-item `collapse` | `AWCMenuHandle` | same | lifecycle methods with callIds, `reposition`, `collapse` (probe ok) | states runs, host tests |
| md-menu `setComboboxElement`, `setVirtualProvider` | **unsupported** | **unsupported** | — | — (R4-13) |
| slots (menu default + `header`; row `leading-icon`/`trailing-icon`; sub `leading-icon`/`submenu`; group default) | yes | yes | recipe | paint cases |
| 8 menu hooks + 5 row hooks | `AWCMenuAppearance` | same | menu-appearance.js (11 hooks) | `--md-menu-viewport-margin`, `--md-menu-section-gap`: **no test**; inline-surface/fill-radius: Studio only (R4-14) |
| 16 parts (menu 3, item 7, sub 6) | **none** | **none** | **none** | boxes only (R4-12) |
| undocumented `--md-menu-group-container-shape` / `--md-menu-group-shape` | yes | yes | **no** | paint (`hook-group-shape`) (R4-15) |

Decisions recorded in md-menu-source-review.md (2026-10-27, 2026-10-30) were reviewed and are acceptable (each keeps the
source contract, names the native consequence and the revert path).

## Gates 2, 4, 5 — re-runs

| Suite | Claimed | r4 result | Job |
|---|---|---|---|
| macOS `NativeMenuPaintIntegration` (138 cases) | 8,302/8,302 | **8,302/8,302** | r4-004 |
| macOS `NativeMenuStatesIntegration` (26 + 26 reduced) | 2,524/2,524 | **2,523/2,524** — `selection-keep-open (reduced) click-radio flat pixels` (4,474/175,894 pixels > 6 levels, worst 7); rerun: **2,522/2,524** (r4-031: the same shot plus `pointer-item (reduced) hover-disabled` — the disabled "Copy" row keeps a 0.08 hover layer) | r4-004, r4-031 |
| Android `NativeMenuPaintTest` | 8,302/8,302 | **8,302/8,302** | r4-A003 |
| Android `NativeMenuStatesTest` | 2,524/2,524 | **2,524/2,524** | r4-A003 |
| Android `LivePreviewMenuHostTest` | 4/4 | **4/4** (recipe/hooks/lifecycle, row, group, submenu pages) | r4-A003 |
| iOS sim paint | 8,302/8,302 | **8,302/8,302** | r4-012 |
| iOS sim states | 2,524/2,524 | **2,524/2,524** | r4-012 |
| iOS sim iPad Pro 11-inch (M5) 26.3 paint / states | — (never run) | **8,302/8,302** / **2,524/2,524** | r4-033 (AWC-r4-pad) |
| iOS sim iPhone 16 Pro 18.6 paint / states | — (never run) | **8,302/8,302** / **2,522/2,524** (`pointer-item hover-disabled` and its reduced run: layer 0.08 vs 0) | r4-033 (AWC-r4-o) |

Test allowances reviewed and accepted (methodology, renderers unchanged): fallback-glyph advance widening for symbols outside
Roboto on Android/iOS; phase shots compared across Chrome's capture window; iOS envelope +2 frames for HID delivery; Android
activation-exit window widened by Chrome's measured 150 ms timer jitter; "Tab past the last control" stand-in.

## Gate 3 — Laboratory

- 4177 probe (r4-002a, r4-004b): md-menu SwiftUI + Compose sessions, update `{quick:true}`, `show()` (callId) → `mdOpen`,
  `reposition()`, `close()` → `mdClose`, method-results `fulfilled`; md-menu-item `{headline, badge}`, md-menu-item-group
  `{label}`, md-sub-menu-item `{headline}` + `collapse()` accepted on both platforms.
- **R4-17**: Android no-op updates `{quick:false}` (md-menu), `{disabled:false}` (md-menu-item, md-sub-menu-item) → 502, session lost (r4-006b); changing values succeed; SwiftUI accepts all.
- Examples 28 SwiftUI + 28 Compose (regenerated, byte-identical to n2's set): Swift typecheck 0 errors (r4-007); Compose
  BUILD SUCCESSFUL (r4-A006; re-verified by r4-A007: the compile task executed and the example classes were produced). Studio `menu-integration` within 110/110 (r4-008); SwiftUI `test-live-menu` 43/43 (r4-020).

## Gate 6 — runtime and accessibility

- iOS: the documented evidence was a single runtime (AWC-n2, iPhone 17 Pro 26.3.1); r4 ran all three runtimes (table):
  iPhone 26.3 and iPad 26.3 pass, iOS 18.6 fails the disabled-row hover check (R4-16).
- tools/ax re-run (3 cases): iOS pass; macOS and Android 1 open finding each in case `open` ("menu name \"\" → \"Open menu\""). Both r4 Web captures (r4-020, r4-022) show Chrome rendering the initially-open menu unpositioned (y = −18) and unnamed — the source's initial-open gap — whereas n2's 2026-10-30 capture of the same HTML shows it positioned and named; the native behaviour follows the recorded decision (an initially open menu opens like a later `open = true`). Justified here; the Web-reference nondeterminism is filed as R4-21. The four md-menu expectations (Android group label read as text, anchor expanded state on
  the roleless md-button host, menu named after its anchor with auto-focus off, first row as roving Tab stop) match recorded
  decisions and are **accepted** as conventions.

## Exceptions

`setComboboxElement` / `setVirtualProvider` are declared unsupported without an exception record (R4-13). No other proposed
exceptions.

## Findings

- **R4-12** (gates 1/3/4): no native `::part` styling for the 16 parts.
- **R4-13** (gate 1): two methods unsupported without exception records.
- **R4-14** (gates 4/5): four hooks without a Chrome comparison (two untested entirely).
- **R4-15** (gates 1/3): undocumented group-shape hooks not in CEM/Laboratory.
- **R4-16** (gates 5/6, macOS + iOS 18.6): states fail in every r4 macOS run (2,523 and 2,522/2,524) and on iOS 18.6 (2,522/2,524: hover-disabled layer 0.08 in the normal and reduced run); claimed 2,524/2,524 is not reproducible on canonical code (fx i4 saw 2,522/2,524 too).
- **R4-17** (gate 3): Android Laboratory host drops the session on a no-op retained update.
- R4-21 (tooling, non-blocking): the tools/ax Web reference for case `open` is nondeterministic (initial-open gap captured in r4's runs).
