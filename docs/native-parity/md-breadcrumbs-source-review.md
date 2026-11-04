# Breadcrumbs source review (md-breadcrumbs + md-breadcrumb-item)

Status: Gate 1 (Web source contract checkpoint). The Web contract is inventoried. Seven source
defects were fixed test-first and mirrored into `packages/core/src` (hash-verified: all 27 files
of the four Gate 1 components are identical on the Mac and in the review copy). `dist` was not
touched. The browser reference is **provisional**: it was captured in headless Chromium 141 on
Linux while the Mac runner was blocked, and must be recaptured on the Mac with Chrome 153 and diffed
with `compare-oracles.mjs`. Native renderers have not been started. This is not a native completion
record.


Native checkpoint (2026-10-29): the Mac Chrome 153 recapture replaced the provisional oracles (job n1-020); dedicated SwiftUI and
Compose renderers, the Laboratory integration and the accessibility evidence are verified — see
[md-breadcrumbs.md](md-breadcrumbs.md).
## Public contract

### md-breadcrumbs

| Property | Attribute | Default | Notes |
| --- | --- | --- | --- |
| `label` | `label` | `'Breadcrumb'` | Host `aria-label`. |
| `expandLabel` | `expand-label` | `'Show full breadcrumb trail'` | `aria-label` of the overflow toggle. |
| `separator` | `separator` | `'/'` | Any string. Each crumb draws its own copy. |
| `maxItems` | `max-items` | `0` | `0` turns collapsing off. |
| `itemsBeforeCollapse` | `items-before-collapse` | `1` | Clamped to ≥ 0. |
| `itemsAfterCollapse` | `items-after-collapse` | `2` | Clamped to ≥ 1. |
| `density` | `density` (reflected) | `0` | 0 to −4. A local value beats an inherited `[data-density]`. Crumbs inherit it. |

- **Event:** `mdExpand {expanded, itemCount}`. It bubbles and is composed. At runtime it is also
  `cancelable: true` (the Stencil default), although the docs call it non-cancelable.
  `preventDefault()` has no effect.
- **Methods:** `expand()` and `collapse()`. Each is a no-op when the state already matches. Each
  emits `mdExpand` even when `max-items="0"`, where nothing visible changes.
- **Slots:** the default slot (`md-breadcrumb-item` children only). The component also renders an
  internal `collapse-tail` slot; it is not public API (see fix 5).
- **Parts:** `list` (the `<ol>`), `separator` (the glyph before the toggle; it also carries the
  token `separator--2`), `overflow` (the toggle's `<li>`) and `overflow-button`.
- **CSS hooks (4):** `--md-breadcrumbs-gap`, `-separator-color`, `-text-color` and `-stagger`.
- **ARIA:** the host has `role="navigation"` and `aria-label=label`. The trail is an `<ol>`. The
  toggle is `<button aria-label=expandLabel aria-expanded="false">` and is removed once the trail
  is expanded.

**Collapsing.** A trail collapses when `maxItems > 0 && count > maxItems && !expanded`:

- The first `max(0,before)` crumbs and the last `max(1,after)` crumbs stay visible. Middle crumbs
  get `collapsed` (they render nothing, `display:none`, `aria-hidden`).
- The toggle sits between the two groups, in DOM, Tab and reading order as well as visually.
- The toggle still renders when `before + after ≥ count`, where nothing is hidden. This behaviour
  is documented; see the open decisions.
- Activating the toggle expands the trail, emits `mdExpand` and moves focus to the first revealed
  crumb that has a link.

**Current page.** The last crumb is promoted to `current` unless the author marks a non-last crumb
`current`. That promotion is re-evaluated when crumbs are added or removed and when any crumb's
`current` attribute changes, so exactly one crumb carries `aria-current="page"`.

### md-breadcrumb-item

**Properties:** `href`, `target`, `rel`, `current` (reflected), `icon`, `disabled` (reflected),
`collapsed` (reflected; set by the parent), `itemIndex`, `itemTotal` and `density`.

**Rendering:**

- The crumb is an `<a part="link">` only when `href` is set and the crumb is neither current nor
  disabled. Otherwise it is a `<span part="static">`, which gets `aria-current="page"` when current.
- `href` passes through `sanitizeHref`.
- When a `target` is set and no `rel` is given, `rel` defaults to `SAFE_LINK_REL`.

**Event:** `mdSelect {href, label, current, itemIndex, itemTotal, originalEvent}`. It is
cancelable, bubbles, is composed, and fires only from the anchor (click, or Enter, which
synthesises a click). `preventDefault()` cancels the navigation.

**Slots, parts and hooks:**

- **Slots:** the default slot and `icon`.
- **Parts:** `separator`, `link`, `static`, `state-layer`, `icon` and `label`.
- **CSS hooks (8):** `--md-breadcrumb-item-link-color`, `-current-color`, `-current-bg`,
  `-disabled-color`, `-hover-color`, `-state-layer-color`, `-gap` and `-padding`.

## Layout and paint reference

All values were measured at density 0 in light theme and LTR. They come from
`web-oracle-cloud/web-paint.json` (99 cases).

**Crumb box:**

- Each crumb is a pill: border radius 9999px, padding 8/12px, 36px tall.
- The label is label-large: Roboto 14/20, weight 500, letter-spacing 0.1px. Labels are capped at
  32ch with an ellipsis.
- The icon box is 18×18 and the glyph is 18px with `FILL 0` and `wght 500`. A current crumb uses
  `FILL 1` and `wght 600`, with a 350ms spring transition.

**Colours:**

- Resting text is on-surface-variant (#49454F).
- A current crumb uses a secondary-container fill (#E8DEF8) with on-secondary-container text and
  weight 600.
- A disabled crumb is on-surface at 61% opacity. This is deliberately not 38%, to keep WCAG 1.4.3
  text contrast.

**Separator and gaps:**

- The separator is 16px with opacity 0.7 in on-surface-variant.
- The gap between a separator and its crumb is 8px.
- The trail gap is `8 + 2·scale` px, so at −4 it is 0.

**Density:** padding is `8+2s` (block) by `max(4, 12+2s)` (inline). Type, the separator and the
glyph taper at 0.5px, 0.5px and 1px per rung. The 18px icon box does not taper, so at −4 a crumb
with an icon is 18px tall and the others are 16px. All crumbs stay centred.

**Overflow toggle:**

- 32×32, round and transparent.
- Hover: 8% on-surface-variant. Focus-visible: 12% plus a 3px secondary ring at offset 2px.
- Active: `scale(0.94)` with a 200ms spring.

**Hover and focus on a link:**

- Hover colours the link primary (#6750A4), applies `translateX(2px)` (−2px in RTL, via
  `:host-context`) and raises the state layer to 8%. Press raises it to 12% and starts the ripple
  (450ms grow, 150ms fade).
- Focus-visible draws a 3px secondary ring at offset 2px and raises the state layer to 12%.

**Entrance:**

- 500ms on `cubic-bezier(0.38,1.21,0.22,1)`, with `both` fill.
- Opacity goes from 0 to 1 and the crumb slides from `translateX(-8px)` (+8px in RTL).
- The delay is `--md-breadcrumbs-stagger` (40ms) × min(index, 11).
- Revealed crumbs replay it after an expand.
- It is turned off under `prefers-reduced-motion`.

## Source defects fixed (test-first)

Every test below failed on the original source and passes on the fixed source (logs are in
`outputs/native-parity/md-breadcrumbs/source-tests/`). The tests are in
`md-breadcrumbs.runtime.e2e.ts`.

1. **A runtime `separator` change was not drawn.** Crumbs read the parent's separator at render
   time, but nothing re-rendered them. Fix: `@Watch('separator')` calls `forceUpdate` on every
   crumb.
2. **Focus fell to `<body>` after the overflow toggle.** The toggle removes itself on expand. Fix:
   focus moves to the first revealed crumb with a link, waiting up to three frames for crumbs to
   re-render. Tested for Enter, click and a static first-revealed crumb.
3. **Two current pages could exist.** When an author marked a visible non-last crumb `current` at
   runtime, the auto-promoted last crumb kept `aria-current="page"`. Fix: a `MutationObserver` on
   `current` attributes, plus tracking of the crumb the component itself promoted.
4. **An appended crumb was not promoted.** The previous last crumb stayed current. Fixed by the same
   tracking as fix 3.
5. **Overflow toggle out of focus and reading order.** The CSS `order` property moved the trailing
   crumbs only visually. Tab and screen readers met "Home, Roadmap, Q3 plan, Show full trail". Fix:
   while the trail is collapsed, trailing crumbs are moved into an internal `collapse-tail` slot
   rendered after the toggle. Only crumbs the component stamped are un-stamped, and `slotchange` is
   watched on both slots. The fix is tested with 0, 1 and 2 crumbs before the toggle.
6. **The entrance animation never ran, and `--md-breadcrumbs-stagger` was dead.**
   - The animation was declared as `::slotted(md-breadcrumb-item) { animation: … }` with
     `@keyframes` in the parent's shadow root.
   - Chromium resolves keyframe names for a slotted element in that element's own tree. A minimal
     probe confirmed this: `getAnimations().length === 0` on the slotted element, while `:host`
     animations resolve.
   - Fix: the entrance now lives on the crumb's own `:host`, keyed by an inline `--_enter-index`.
     It has an RTL variant through `:host(:dir(rtl))`, and the dead parent rules were removed.
   - The stagger now caps at 11 steps, as the old comment intended.
   - A reduced-motion guard test was added; it passed before the fix too.
7. **The documented `--md-breadcrumbs-text-color` hook had no visible effect.** It changed only the
   host's `color`, and every crumb surface paints `--_link-color`. Fix: the crumb's link colour falls
   back to the trail hook; `--md-breadcrumb-item-link-color` still wins.

**CEM drift fixed in source (no test possible):**

- The CEM omitted the `separator` part, because the generator ignores template-literal `part=`
  values. A `@csspart separator` annotation was added to `md-breadcrumbs.tsx`.
- The JSDoc for `expand()` and `collapse()` claimed "no effect when maxItems is 0". It now matches
  the readme and the runtime behaviour.
- `custom-elements.json` itself was not regenerated, because it is a shared generated file.

## Behaviour kept as-is (native renderers must match, or a decision is needed)

- The overflow toggle renders even when nothing is hidden (`before + after ≥ count`). Activating it
  just removes the toggle.
- `expand()` and `collapse()` emit with `max-items="0"`.
- `mdExpand` is technically cancelable, but cancelling does nothing.
- The hover translate and the separator's `unicode-bidi` use `:host-context([dir=rtl])`, which is
  Chromium-only. In Safari and Firefox the hover translate does not mirror. (The new entrance rule
  uses `:dir()` and mirrors everywhere.)
- The 32ch label cap gives no tooltip or full-text affordance. The full label is still in the
  accessible name and in `mdSelect.label`.
- The 18px icon box does not taper with density.

## Evidence

- **Source diffs:** `outputs/native-parity/md-breadcrumbs/source-changes/` (`md-breadcrumbs.diff`,
  `md-breadcrumb-item.diff`, `final-sources.sha256`).
- **Tests:** `source-tests/`.
  - `baseline-228.log` is the original source.
  - `new-tests-on-original-19-failing.log` runs all new and updated tests of the four components on
    the original source.
  - `after-255-final.log`: 254 of 255 pass. The one failure is a pre-existing fixed-60ms toolbar
    timing test that failed under load; it passes in isolation (`toolbar-e2e-isolated.log`, 46/46).
  - Per-fix before and after logs.
- **Oracles (provisional):** `outputs/native-parity/md-breadcrumbs/web-oracle-cloud/`, generated by
  `web-reference/` (`paint.html`, `states.html`, `oracle.mjs`, `server.mjs`).

## Decisions (autonomous, 2026-10-27 / 2026-10-29, reversible)

| Decision | Alternative | How to revert |
| --- | --- | --- |
| Keep the overflow toggle when itemsBeforeCollapse + itemsAfterCollapse ≥ the crumb count (the Web behaviour). | Hide the toggle when nothing would collapse. | Change the collapse-window rule in `NativeBreadcrumbs.swift` / `AWCBreadcrumbs.kt` and the Web source together. |
| `mdExpand` is documented as cancelable but its cancellation is ignored (the state never depends on it), as the source. | Make cancellation keep the trail collapsed. | Gate the state change on the dispatch result in all three implementations. |
| Keep Chromium's hover-nudge selector behaviour (the nudge applies to link crumbs only). | Nudge every crumb. | Adjust the nudge target in the stylesheet and both renderers. |
| Truncated labels (32 ch) keep the full accessible name and show no tooltip, as the Web source (gate-7 R6-12, d6 2026-10-31). | Add a full-text `title` to the Web crumb (test-first) and a native tooltip. | Add `title` in md-breadcrumb-item.tsx and `.help`/a Compose tooltip on the label. |
| The current crumb is plain text natively: Chrome's tree has no "current page" text and `aria-current` has no native API. | Append "current page" to the name. | Add the suffix to the crumb label in both renderers. |

