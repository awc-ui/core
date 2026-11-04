# Tabs native implementation plan (md-tabs, md-tab, md-tab-panels, md-tab-panel)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract is in
  [md-tabs-source-review.md](md-tabs-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-tabs/web-oracle-cloud/`. Recapture it on the Mac
  (Chrome 153) before any native parity diff.

## Current adapters

**iOS** (`packages/native-ios/Sources/AWCUI/Containers.swift`):

* `md-tabs` shares `navigation` with the bar and the rail: a padded `VStack`
  on a 16-radius surface. Inside it, an `HStack(spacing:4)` of
  `navigationItem` buttons, followed by a SwiftUI `Divider()`.
* Each `md-tab` is a `Button`. Its label is a `VStack` (icon above the label)
  in a 10-padded cell, with an 18-radius `primary.opacity(0.18)` background
  when active.
* `tabPanels` filters children by
  `interactionStore.tabIndices[for]`.
* `md-tab-panel` renders when `active` is true, and `active` **defaults to
  true**.

**Android** (`packages/native-android/.../AWCNavigation.kt`):

* `md-tabs` is a `Row` with `horizontalScroll` and 8dp spacing, followed by
  `HorizontalDivider()` when `p.bool("divider", true)`.
* Each `md-tab` is a **`FilterChip`**.
* `md-tab-panels` is a `NavigationScope` keyed on `activeIndex`.
* `md-tab-panel` shows when `p.bool("active", true)`.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Anatomy | Tablist; 48/64 tabs (−4·d); primary 3px content-width indicator, secondary 2px full-width; 1px divider | Padded card of pills with a 0.18 primary tint; no indicator | Filter chips; no indicator |
| Tab sizing | `equal` / `auto` / length; min max(48, 90+8d); padding 16+2d; ellipsis | Intrinsic | Intrinsic chips in a scroll row |
| Typography and colour | title-small 14/20 500; primary/secondary active colours; on-surface-variant inactive | caption, semibold when active | Chip defaults |
| Badge | Dot (6) or text (error) over the icon or inline after the label; part of the name | Error capsule text only (`badgeValue`, which md-tab lacks; md-tab uses `badge`) | None |
| Disabled | 38% on-surface, skipped by arrows, `aria-disabled` | Not handled (Button always enabled) | `enabled = p.enabled()` |
| Selection rules | Clamp, skip disabled, append-and-select, emit only on change, no emit for programmatic | Emits `mdTabChange` on every click, including the active tab | Same |
| Event payloads | `mdTabClick` (void), then `mdTabChange {index, previousIndex}` | Matches | Matches |
| Keyboard | Arrows (visual direction, wrap, skip disabled), Home/End, automatic activation | None | None |
| Semantics | tablist / tab / selected / disabled; `aria-label` (default "tabs"); badge in the name | `.isSelected` only | `semantics { selected }` only |
| Overflow | Scrolls; nearest-edge reveal on activation; edge fades | No scroll | Scrolls; no reveal |
| Motion | 400ms emphasized-decelerate glide; 200ms fade-out; 200ms colour | None | None |
| Reduced motion | No glide; colour fade stays | n/a | n/a |
| Density / RTL | Heights, min width, type and icon taper; arrows mirror | No / SwiftUI default | No / Compose default |
| Panels | Follow `for` or the nearest preceding md-tabs; follow programmatic selection (fix A); stable vs active sizing; inert inactive panels; labelled by the tab | Shows **all** panels when `for` is empty; no sizing; no association | Index scope only; panels default visible; no `for`; no sizing |

## Plan

1. **Shared selection model** (both platforms): port the md-tabs reducer.
   * `clamp` (sanitise, then skip disabled with wrap), `pendingRequestedIndex`
     ("append and select"), emit-on-change only, and no emit for
     programmatic writes.
   * Keep it data-only so the event-order tests run headless.
2. **iOS `TabStrip` view.**
   * An `HStack` in a `ScrollViewReader` whose width modes mirror
     `tab-width`.
   * The primary indicator is a `matchedGeometryEffect` capsule under the
     content (3pt, top corners rounded); the secondary one spans the tab
     (2pt).
   * The divider is 1pt outline-variant across the full strip (`full`) or
     under each tab (`auto`).
   * Glide: 400ms `timingCurve(0.05, 0.7, 0.1, 1)`. Outgoing opacity: 200ms.
     Both are gated by `accessibilityReduceMotion`.
   * Hardware keyboard: `.focusable()` and `.onMoveCommand` (mirrored in
     RTL), with automatic activation.
   * Accessibility: `.accessibilityElement(children: .contain)` on the strip
     with an `.accessibilityLabel`; each tab gets `.isSelected` or the
     disabled trait, and a label that includes the badge.
3. **Android `TabStrip`.**
   * Use `PrimaryScrollableTabRow` / `SecondaryScrollableTabRow` (or
     `TabRow` for `equal`) with a custom indicator:
     `TabRowDefaults.PrimaryIndicator(width = contentWidth, height = 3.dp)`
     for primary and `SecondaryIndicator(2.dp)` for secondary.
   * Override Compose's 72dp icon+text height to 64dp (minus 4dp per
     density step).
   * Semantics: `Role.Tab`, plus `selectableGroup()` on the row.
   * Glide: a 400ms `CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)` indicator
     offset/width animation, off under `isReducedMotionEnabled`.
4. **Panels** (both platforms).
   * Resolve `for`, or the nearest preceding md-tabs sibling, through the
     renderer tree.
   * Subscribe to the strip's state rather than click events, so
     programmatic changes also switch panels (fix A parity).
   * `stable` is a `ZStack`/`Box` of every panel, with inactive ones hidden
     but kept in layout (`opacity(0)` and `accessibilityHidden` /
     `invisibleToUser`). `active` renders only the active panel.
   * Panels are labelled by their tab.
5. **Native fixtures.** One fixture per web oracle case family: matrix,
   width modes, hooks, overflow, panels, disabled and badges. Diff geometry
   against `paint.json` and motion against `states.json` (indicator rect per
   frame), and check reduced motion.

## Open decisions to settle before native work

The secondary icon+label height, modifier keys on the arrows, and whether
programmatic selection emits. All three are listed in the source review.
