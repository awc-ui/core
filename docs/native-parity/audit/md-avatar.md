# Gate 7 audit — `md-avatar`

Reviewer: gate-7 reviewer r3, 2026-10-31. Independent of the implementing forks; no product code changed.

**Verdict: FAIL** — findings r3-04, r3-05, r3-06, r3-07, r3-08, r3-21. All re-runs pass; the failures are source behaviours that are not
implemented (hidden host, lazy loading, forced colours), unresolved CEM drift and an undecided source question.

## Method

- Snapshot `work/audit/r3-tree` (job `r3-002`, 2026-10-31 02:12 EET; contains `fx-068`/`fx-072`, which changed
  `NativeAvatar.swift` / `NativeAvatar.kt` and added `AWCSvgRaster.swift` after the earlier avatar and iOS evidence).
- Contract: `packages/core/src/components/md-avatar/` + regenerated inventory (`r3-006`): 11 properties, 2 events
  (`mdLoad`, `mdError`), default slot, 3 parts (`image`, `initials`, `icon`), 25 hooks from the CSS (11 in the CEM).
- Hash check of `outputs/native-parity/md-avatar/{native-swift,native-android,laboratory}/checkpoint.json` against the
  canonical tree: the renderer files differ (`NativeAvatar.swift`, `NativeAvatar.kt`, shared dispatch) — prior counts are stale;
  the r3 re-runs below are the current evidence. The previous iOS gate-6 run used `work/fi-tree-r8`, whose
  `NativeAvatar.swift` differs from canonical.

## Gate checklist

| Gate | Result | Evidence |
| --- | --- | --- |
| 1 Source contract | **findings r3-06, r3-08** | CEM lists 11 of the 25 hooks (14 palette hooks missing); "palette overrides container/label hooks" is still an open source decision with no recorded decision |
| 2 Implementation | **findings r3-04, r3-05, r3-07** | `hidden` ignored natively; `loading="lazy"` not implemented; forced colours not implemented |
| 3 Laboratory | pass | `avatar-appearance.js` 25 hooks incl. palette; retained update on both platforms; 28+28 examples |
| 4 Behaviour | pass (with r3-04 skips) | 52 identity + 4 lifecycle oracle scripts (src/error/recover, crossorigin reload, loading toggles) on both platforms; the oracle's `hidden` and inline-`<svg>` slot cases are skipped by both suites |
| 5 Visual | pass | 282 paint cases (light/dark, LTR/RTL, density −1…−4, sizes, shapes, palette buckets, badge in slot) |
| 6 Runtime + a11y | pass (r3-21: stale policy notes) | iOS 26.3 re-run 2,949/2,949; tools/ax name, initials, labelled: 0 open findings on macOS, iOS, Android |
| 7 Final audit | FAIL | this document |

## Source contract matrix (summary)

| Family | Count | SwiftUI | Compose | Laboratory | Test |
| --- | --- | --- | --- | --- | --- |
| Properties | 11 | all (`NativeAvatar.swift`) | all (`NativeAvatar.kt`) | retained updates (`LivePreviewAvatar.kt`, `LiveRenderer`) | paint/identity/lifecycle oracles; `loading` and `crossorigin` only as lifecycle toggles (no deferral semantics) |
| Events `mdLoad`, `mdError` (`{src}`) | 2 | `AvatarLoader` emits | `AvatarLoader` emits | event log | lifecycle `error-recover` etc. |
| Default slot (fallback glyph) | 1 | slot view | slot lambda | not text-editable (Laboratory convention for icon slots) | ★ / emoji / badge cases; inline `<svg>` cases skipped |
| Parts `image`, `initials`, `icon` | 3 | part appearance | part appearance | Styles panel | paint part cases |
| Hooks | 25 (11 CEM + 14 palette) | `AWCAvatarAppearance` (`paletteContainerColors`/`paletteLabelColors`) | same | `avatar-appearance.js` (25) | all 25 present in `avatar-web-paint.json` |
| `:host([hidden])` | — | **not handled** | **not handled** | — | **skipped** (`NativeAvatarIntegration.swift:141`, `NativeAvatarParityTest.kt:173`) |
| `@media (forced-colors)` | — | **none** | **none** | — | **none** |

## Exception decisions

| Proposed difference (md-avatar.md "Platform differences") | Decision |
| --- | --- |
| Inline `<svg>` slot content (no SVG DOM) | **Accepted** as a browser-only facility with a named native equivalent: the slot takes any native view (SwiftUI `View`, Compose lambda), exercised by the ★, emoji and badge slot cases. Record: source `md-avatar` default slot with inline SVG; platforms SwiftUI/Compose; no DOM/SVG parser for authored markup; impact: authors supply a native vector/view instead of markup; tested equivalent: slot cases in `avatar-web-paint`; evidence `NativeAvatarIntegration`, `NativeAvatarParityTest`. |
| `hidden` host attribute "not reproducible natively" | **Rejected** — implementable (md-divider, md-card, md-list-item and md-dialog honour `hidden` by not rendering the subtree). r3-04. |
| `loading="lazy"`: no viewport deferral | **Rejected** — implementable (start the load when the view first appears / is within the viewport; Compose `LazyColumn` composition, SwiftUI `onAppear` in lazy stacks, or a visibility check), observable through `mdLoad` timing and network use. No exception record exists. r3-05. |
| `crossorigin`: only the reload-on-change | **Accepted** as a browser-only facility (CORS mode has no native counterpart); its observable effect (a changed value reloads the image and re-fires the events) is reproduced and exercised by the lifecycle oracle. |
| Percent sizes not resolved | Not a finding: the source size hooks are lengths; no source case uses percentages (recorded as untested boundary). |
| Android fallback fonts (emoji/CJK centroid comparisons) | Accepted as a measured platform raster difference (font files, not the renderer: fx 2026-10-29), not an exception. |

## Re-run counts (claimed → r3)

| Suite | Claimed | r3 | Job |
| --- | --- | --- | --- |
| macOS `NativeAvatarIntegration` | 2,949/2,949 | **2,949/2,949** | `r3-009` |
| Android `NativeAvatarParityTest` | 3,121/3,121 | **3,123/3,123** | `r3-A001` |
| Android `LivePreviewAvatarHostTest` | pass | **1/1** | `r3-A001` |
| SwiftUI live host `test-live-avatar.mjs` | 27/27 | **pass** | `r3-0106` |
| iOS `NativeAvatarIntegration` (iPhone 17 Pro, iOS 26.3, AWC-r3, emoji font redirect) | 2,949/2,949 | **2,949/2,949** | `r3-011` |
| iOS 18.6 (iPhone 16 Pro, AWC-r3-18) / iPad Pro 11-inch (M5) iOS 26.3 (AWC-r3-ipad) | 2,949/2,949 / 2,949/2,949 | **2,949/2,949** / **2,949/2,949** | `r3-014` |
| Swift / Kotlin examples | 28 / 28 | **28 typecheck, 0 errors / 28 compile** | `r3-010`, `r3-A007` |
| tools/ax name, initials, labelled | pass ×3 | **pass** ×3 (0 open) | `r3-0107`, `r3-A009` |

## Laboratory (gate 3)

`lab-probe.mjs` (`r3-0105`): SwiftUI and Compose sessions open; `update {name:"Grace Hopper"}` 200 on both. No methods.

## Accessibility (gate 6)

tools/ax re-run (`work/audit/r3/out/ax/md-avatar/report.md`): `img "Alex Morgan"`, no element for the decorative initials case
(Web `role=presentation`), `img "Alex Morgan, online"` for the labelled case — identical on macOS, iOS and Android, no expectation
entry. The hidden case (r3-04) has no accessibility capture.

## Findings

- **r3-04** (gates 2, 4) `hidden` ignored on both platforms; the oracle's hidden cases are skipped.
- **r3-05** (gate 2) `loading="lazy"` deferral not implemented and not recorded as an exception.
- **r3-06** (gate 1) CEM drift: `custom-elements.json` lists 11 of 25 hooks (14 palette hooks missing).
- **r3-07** (gates 2, 5) forced colours (`ButtonFace`/`ButtonText` container, label and 1px outline) not implemented or tested.
- **r3-08** (gate 1) open source decision (name palette overrides `--md-avatar-container-color`/`--md-avatar-label-color`)
  not recorded under "Decisions (autonomous, …)" with alternative and revert, as PARALLEL.md requires.
- **r3-21** (gate 7) released policy notes still say iOS and VoiceOver/TalkBack execution remain unverified.

Defect rows with evidence paths and suggested fixes: [`work/audit/DEFECTS.md`](../../../../audit/DEFECTS.md), section "Gate-7 reviewer r3". Evidence: `work/audit/r3/` (runner logs `work/claude-runner/done/r3-*.log`); progress `work/audit/r3/PROGRESS.md`.
