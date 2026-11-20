# Button Group migration audit

Status: Web, macOS SwiftUI, Android and Laboratory checkpoints passed, including the final nested/wrapped-child corrections. iOS simulator execution (iPhone 17 Pro iOS 26.3, iPhone 16 Pro iOS 18.6, gate 6) passed. Gate 7 re-check s7-7 (2026-11-15) reopened one iOS 18.6 sample (R1-17, a display frame lost mid-motion); story 9-5 fixes the family-states sampler (stall attribution across a lost frame) and a gate-7 re-check of md-button-group follows.

## Source contract

Reviewed `packages/core/src/components/md-button-group/md-button-group.tsx` and its CSS. The public contract contains seven properties, one event, one structural default slot, no imperative methods, no CSS parts and seven appearance hooks: gap, width, minimum/maximum width, height and minimum/maximum height. The broader inventory also captures internal and child-variable references; those are not additional public group controls.

The group owns selection mode, required selection, size, shape, connected edges, density inheritance, layout and roving keyboard focus. Child `md-button` and `md-icon-button` retain their distinct activation ordering. A group reconciles the bubbling raw activation even when a child cancels its own action or is soft-disabled. The event preserves ordered values and set-based added/removed differences, including duplicate and empty values. A separate boolean vector carries actual child selection to the Laboratory; event values cannot identify duplicate-valued children.

The default slot remains composed children. It is not converted to text or a fixed list of labels. There is no source method to invent.

## Measured Web geometry

A dedicated browser fixture measured 33 fully hydrated cases with the bundled Web build and Roboto fonts. It covers both variants, all five sizes, density zero and minus four, inherited and explicit child density, mixed child types, constrained dimensions, overflow and full width. The results were checked again against stable DOM geometry after the fixture finished.

The measurements resolved differences between source comments and actual CSS:

- At size `sm`, group height 72 stretches text buttons to 72 while the icon button remains 40 high. A group height of 20 leaves children 40 high and overflowing. At size `lg`, an explicit height of 72 leaves children 96 high; a maximum height of 40 caps all children at 40.
- `fullWidth` overrides the explicit width hook with the available parent width, then honors group minimum/maximum constraints.
- Flex distributes content-box space. Mixed children do not receive equal outer widths when their padding differs: a 600-wide standard small group gives text/icon/text widths of approximately 202.664 / 170.672 / 202.664, with two 12-wide gaps.
- A long label clips at its allocated width. It does not impose a natural-label-width floor. The text button's explicit minimum and connected small/extra-small 48-wide minimum still apply.
- A connected extra-small group constrained to 80 contains three 48-wide children and two 2-wide seams, overflowing rather than wrapping.

The direct-child native layouts have been checked against these measurements, including their minimum-size and clipping behavior. Two additional nested lifecycle cases show that initial outer-group synchronization wins, while later inner or outer property changes overwrite all descendants in that group's scope. This is last synchronization behavior, not permanent nearest-parent ownership. Normal nested activation reconciles inner then outer.

## Current evidence

- Web source tests: 102/102 passed through Jest using the repository Stencil preset.
- Shared integration: 128/128 focused tests plus 65/65 additional integration tests passed. A later integrated checkpoint passed 215/215 overlapping tests, and the public CSS documentation correction passed 47/47. These runs overlap and must not be summed into a unique test count.
- Five generated Swift and five Kotlin Usage/API examples compiled; sources, commands and hashes are retained in `examples/verification.json`.
- Android final checkpoint: 69 unit tests passed, including eight group contracts. All 13 scoped group/device-host cases and 25 existing button/icon regressions passed. The combined report retains one unrelated Divider asset-packaging failure; its corrected focused run subsequently passed. Nested descendant synchronization, wrapped-child order, retained-key reorder and mixed-child geometry are included in the final cases. See [Android audit](../../packages/native-android/audits/md-button-group.md).
- SwiftUI final checkpoint: 161 group contracts passed within the overlapping 1,072-check button/icon/group/FAB runner, and all 87 actual group-view checks passed. These include the four-stage nested last-synchronization sequence, inner-to-outer events and mixed text/icon stretching. The live JSON host check passed. Previous 22 button appearance, 68 focus, 88 inspection and 268 icon checks remain separately recorded regressions. See [SwiftUI audit](../../packages/native-ios/audits/md-button-group.md).
- Laboratory browser checks: all seven properties enabled on both native platforms; seven shared style fields; actual Android and SwiftUI activation updates authored child selection, survives appearance/property changes and transfers back to Web. Customized 420 × 72 dimensions with gap 18 and full width 924 × 72 match all three runtimes. Dark/light captures and `browser-verification.json` are retained.
- Natural default Android width measured 223.5dp versus Web 221.734375px. Android uses the same bundled Roboto medium, 14/20 typography and 0.1 tracking; native shaping and physical-pixel rounding remain a measured visual boundary rather than an exact pixel identity claim.
- Catalog generation passed after correcting invalid Android diagnostic keys; the failed and corrected build logs are retained separately.

Reference artifacts are at `../../../../outputs/native-parity/md-button-group`: `web-geometry.json`, `web-tests.log`, `web-reference.png` and the reproducible `web-reference` fixture/server.

## Remaining gates

The independently identified nested/wrapped-child corrections, actual native checks and host rebuilds are complete. A separate final integration review remains pending. Shared gate tests must run again after later components change shared code. iOS simulator/device execution is unavailable in this environment and remains an unverified gate; macOS SwiftUI execution does not replace it.

<!-- fi:ios-gate6:start -->
## Reduced motion (gate-7 decision)

The standard variant's 400 ms press motion (the pressed button grows, its neighbours shrink; Web Animations) is spatial motion and is skipped under `prefers-reduced-motion: reduce` (`md-button-group.reduced-motion.e2e.ts`); SwiftUI and Compose skip it too. A fast click still runs the full motion after the release (Chrome 153 record `bg-*/click2`): the natives start it from the held pointer.

## iOS simulator execution (gate 6)

The same fixtures and Chrome oracles as the macOS runs, compiled for the simulator by the [iOS parity harness](ios-harness.md)
(Xcode 26.3; iOS 26.3.1 and 18.6 runtimes; frozen tree `work/fi-tree-r8`, 2026-10-30). Counts are each fixture's own checks.

| Suite | iPhone 17 Pro · iOS 26.3 | iPad Pro 11-inch (M5) · iOS 26.3 | iPhone 16 Pro · iOS 18.6 |
|---|---|---|---|
| `NativeButtonGroupViewIntegration` | **87/87** | **87/87** | **87/87** |
| **Total** | **87/87** | **87/87** | **87/87** |

Evidence: `outputs/native-parity/_ios/fi/console-<prefix><suite>.log` and `summary-<prefix>.json` with prefixes `r8i-` (iPhone), `r8p-` (iPad), `r8o-` (iOS 18.6); command `work/fi-lab/harness.sh <label> <fixture>` (see ios-harness.md).
<!-- fi:ios-gate6:end -->
