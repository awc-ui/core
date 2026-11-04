# Navigation bar native implementation plan (md-navigation-bar, md-navigation-tab)

Status: preparation only, at Gate 1. No native code has changed.

* The Web contract is in
  [md-navigation-bar-source-review.md](md-navigation-bar-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-navigation-bar/web-oracle-cloud/`. Recapture it
  on the Mac (Chrome 153) first.

## Current adapters

**iOS** (`Containers.swift`):

* `navigation` lays the bar out as an `HStack(spacing:4)` in a padded
  16-radius surface card.
* Each `navigationItem` is a `Button`, and the whole cell is tinted with
  `primary.opacity(0.18)` when active.
* Labels follow `labelVisibility`, which is the **rail's** property name.
  The bar's `labelBehavior` is ignored.
* The badge is an error capsule. `badgeMax` is ignored.
* It emits `mdChange {index, previousIndex}` on every click.

**Android** (`AWCNavigation.kt`):

* The bar is a `Surface(surfaceContainer)` holding a `Row(SpaceEvenly)`.
* Items are clickable `Column`s with a `secondaryContainer` pill
  (extraLarge shape, 20×6dp padding, so about 64×36).
* The label is hidden only for `labelVisibility == "hidden"` or
  `labelBehavior == "always-hide"`, values the Web never uses.
* The badge shows only when `badge` is true; `badgeMax` is ignored.

## Gap analysis

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Container | Full-width, 64 (−4·d) tall, surface-container, square, z 200 | Inset card | Correct colour; height from content |
| Destinations | Equal widths; 56×32 pill (48×28, 40×24); icon 24/22/20; label 12/16, 600/500 | Tinted cell | 64×36 pill; label always medium |
| Label behaviour | `always` / `selected` (inactive opacity 0, still named, fix B) / `none` (`aria-label`); per-tab override | Wrong property | Wrong enum values |
| Badges | Dot 6; large 16 tall, "999+" cap via `badgeMax`; error colour; "N new" status | Text capsule, no cap | Only with `badge`; no cap |
| Disabled | Opacity .38; hard-disabled skipped; soft-disabled focusable but never activates | Not handled | `enabled`; no soft-disabled |
| Activation | Click, Enter, Space; automatic arrows, or manual with `manualActivation`; `select()` and `focusTab()` | Click only; emits on re-click | Same |
| Events | `mdTabClick {index}` (stopped at the bar), `mdChange {index, previousIndex}`; emits for programmatic `activeIndex` | `mdChange` on every click | Same |
| Links | `href` / `target` navigate unless the click was prevented | `activateLink()` | None |
| Semantics | navigation > tablist > tab with selected / disabled; badge status | `.isSelected` | `selected` |
| Motion | Pill `scaleX` 0 → 1 over 200ms emphasized-decelerate; outgoing fade 100ms; colour 200ms; hover .08 over 100ms | None | None |
| Reduced motion | All transitions removed; ripple kept | n/a | n/a |
| Density / RTL | Heights and type taper; arrows mirror | No | No |

## Plan

1. **Shared model:** clamp to enabled (forward, then backward, or −1);
   soft- versus hard-disabled; manual versus automatic activation;
   emit-on-change; and the per-tab `labelBehavior` override with
   bar-level inheritance.
2. **iOS.**
   * A dedicated `NavigationBarView`: full-width, `HStack(spacing: 0)` with
     equal frames, and a height of 64 + 4·d.
   * Pill: a `Capsule` with `.scaleEffect(x:)` animated over 200ms
     `timingCurve(0.05, 0.7, 0.1, 1)`, off under reduce-motion.
   * Labels: in `selected` mode, inactive labels stay in the view with
     `opacity(0)` and keep their accessibility label (fix B parity).
   * The badge is an `AWCBadge` (dot or large) with the `badgeMax` cap.
   * Accessibility: an `.accessibilityElement(children: .contain)` container
     labelled as navigation, with tab traits and `.isSelected` on each item.
3. **Android.**
   * Use M3 `NavigationBar` and `NavigationBarItem`, with
     `alwaysShowLabel = labelBehavior == always` and a custom label slot so
     `selected` keeps the inactive label's semantics.
   * Override the indicator size to 56×32 (density taper) and the colours
     with `NavigationBarItemDefaults.colors(...)`.
   * Use `BadgedBox` with a max cap.
   * Handle hardware keys with `onPreviewKeyEvent` for manual activation.
4. **Fixtures** from `paint.json` (the label × theme × dir × density
   matrix, badges, disabled/soft-disabled, widths, hooks) and
   `states.json` (pill scale per frame, event order).

## Open decisions

Badge wording and localisation, the event rule for programmatic writes, and
the landmark's default name.
