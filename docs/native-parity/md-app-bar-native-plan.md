# App bar native implementation plan (md-app-bar)

Status: preparation only. The contract is in the [source review](md-app-bar-source-review.md). The
oracles in `outputs/native-parity/md-app-bar/web-oracle-cloud/` are **provisional**. They were
captured with Linux headless Chromium 141 (1200×900, DPR 1, trusted CDP input) and must be
recaptured with Chrome 153 on the Mac.

## Oracle inventory

| File | Content |
| --- | --- |
| `web-paint.json` + `paint-shots/` (155 PNG) | 156 cases. See the breakdown below. |
| `web-states.json` + `states-shots/` (80 PNG) | 15 runs, 80 phases and 1470 frames. See the breakdown below. |
| `web-states-reduced.json` (11 PNG) | 3 runs under reduced motion, 250 frames. |

**Paint cases (156):**

- 16 matrix cases: variant × theme × direction.
- 6 subtitle cases and 12 centre cases.
- 20 density cases.
- 8 scrolled cases.
- 23 search configurations: value, disabled, labels, placeholders, in-pill trailing items,
  compact-keep, five widths from 1000 to 320, centre, slotted, ignored headline and subtitle.
- 8 trailing cases: none, one, cap, author-hidden, avatar, RTL, flexible.
- 8 slotted cases: directional leading, slot beats prop, slotted headline and subtitle.
- 7 content cases.
- 6 all-hooks cases and 38 single-hook cases (all 38 hooks).
- 3 parts cases and 1 hidden case.

**Interaction runs (15):**

- Search by pointer (light, dark, RTL, scrolled): hover, press, release, type "new york", Enter.
- Search by keyboard (start and centre): focus ring, Space, Enter, Tab order.
- Disabled search; slotted search.
- The scrolled transition on small, medium and search bars.
- The leading button by pointer and by keyboard.
- The trailing cap with author `hidden` toggles.
- Runtime variant, subtitle, alignment and density changes.

## Current native state

**Swift (`Containers.swift`, `toolbar`, md-app-bar branch):**

- A `VStack` with spacing 12 and padding 16 on `surface`.
- An `HStack` holding: a leading `Button` (44pt) that emits `mdLeadingClick`, the leading content, a
  `TextField` for search (emits `mdSearchInput`, disabled by `searchDisabled`) and the trailing
  content.
- The headline is `.title2`, or `.largeTitle` when large, at semibold weight. The subtitle is
  secondary text.
- Every slot is rendered stacked.
- The support JSON lists density, scrolled and flexible geometry among the gaps.
- Missing:
  - The 64pt row geometry and 48pt touch targets.
  - The medium/large expanded block and its heights.
  - Centred-title grid, the search pill (shape, fill, state layer, compact rules), the scrolled
    surface and the trailing cap.
  - `mdSearchActivate` and banner semantics.

**Android (`AWCComponent.kt`, shared with md-toolbar):**

- A `Surface(surfaceContainer, RoundedCornerShape(16.dp))` with a `Row`.
- The fill should be surface (surface-container only when scrolled) with square corners. The radius
  is wrong.
- The leading `IconButton` emits `mdLeadingClick` (null detail). The headline is titleLarge and the
  subtitle bodySmall.
- Missing: the search field, variants, density, scrolled state, alignment, the cap and banner
  semantics.

## Implementation plan (both platforms)

1. **A dedicated app bar renderer**, separate from the toolbar.
   - **Small:** a 64pt row (`max(48, 64+4s)`) with 4pt inline padding.
   - **Leading:** the slot wins over the prop. The prop button is 48pt with a 24pt glyph.
   - **Title:** title-large, inset 12, one line with an ellipsis.
   - **Trailing:** at most 3 shown, 2pt gap, sized by the trailing touch-size token.
2. **Medium and large.** A 64pt row (large: 20pt top padding, icons top-aligned) plus an expanded
   headline (headline-medium 28/36) with 16pt inline padding and 24/28pt bottom padding. The
   subtitle is label-large on medium and title-medium on large. Heights follow the outcome of the
   open decision below; today the Web renders 124, 148, 146 and 174.
3. **Centred title.** Equal flexible side columns of at least 48pt, with the title centred.
4. **Search.**
   - A pill 56pt tall (`max(40, 56+4s)`), corner-full, surface-container-highest (surface-container
     when scrolled), filling the space between the leading and trailing areas with an 8pt row gap.
   - Hint inset 24, 16 when compact (<600), 12 when <400. The placeholder is on-surface-variant and
     typed text on-surface. Body-large type.
   - In-pill trailing icons: 4pt gap. From the second item on, they hide when compact unless marked
     keep.
   - Disabled: 38% opacity, no events.
   - Events:
     - `mdSearchActivate` on focus and on Enter (Enter is consumed), and on Space (Space is not
       consumed).
     - `mdSearchInput` on every change.
     - `searchValue` is two-way.
   - Keyboard focus shows the ring; pointer focus does not.
5. **Scrolled.** Animate container fills (surface ↔ surface-container) over a short2 duration. The
   author sets `scrolled`; no scroll observation is required (matching the Web), unless the open
   decision changes that.
6. **Semantics.** The bar is a header region with an accessible name. The leading button uses
   `leadingIconLabel`; the search field is a search field named by `searchAriaLabel`, then the
   placeholder, then "Search".
7. **Trailing cap.** Hide actions beyond three of the shown ones. Never override an author's hidden
   state. Log a developer warning.
8. **Hooks.** Expose all 38 tokens: colours, shape, elevation, row metrics, gaps, touch sizes,
   expanded paddings and heights, and the search pill tokens.

## Open decisions

- **Flexible heights.** The documented and M3 heights (112/120, 136/152) are only minimums. The
  stacked row and expanded block render 12–28px taller. Options:
  - (a) overlap the expanded headline with the row band, as Android's CollapsingToolbarLayout does,
    so the totals become exact;
  - (b) change the docs to the rendered heights.

  This needs a design owner before native geometry is fixed. It was not changed in Gate 1, because
  it is a layout redesign rather than a defect with one obvious fix.
- Should flexible bars collapse on scroll? (The Web never does.)
- Should `role="banner"` be unconditional?
- Should the prop leading icon support RTL mirroring (a `leading-icon-directional` prop, or setting
  `data-directional` on the generated button)?
- The CEM generator regex (`/SLOTS/i` in `scripts/generate-docs.mjs`) drops six search hooks. Fix
  the shared script, or reword the component header.
