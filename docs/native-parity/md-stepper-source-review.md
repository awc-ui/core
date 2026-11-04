# Stepper source review (md-stepper, md-step)

Status: Gate 1 (Web source contract checkpoint).

* The contract is inventoried.
* Two source defects are fixed test-first and mirrored into
  `packages/core/src`.
* A browser reference is captured: paint, interaction and reduced-motion
  oracles.

The oracle is **provisional**. It was captured in headless Chromium 141 on
Linux while the Mac runner was blocked, and must be recaptured on the Mac
(Chrome 153) and diffed before it gates native work. No native code has
changed. This is not a native completion record.

## Public contract

### md-stepper

| Property | Default and values |
|---|---|
| `orientation` | `horizontal` \| `vertical`; reflected |
| `indicator` | `numbered` \| `dot`; reflected |
| `variant` | `default` \| `mobile` (compact Back · progress · Continue bar; headers hidden; content goes in the `content` slot) |
| `mode` | `linear` \| `non-linear`; reflected |
| `active` | `0`; mutable, reflected, clamped to `0…count−1` (initial value included) |
| `autoComplete` (`auto-complete`) | `true`: moving forward completes every non-disabled step passed and clears its error; moving back un-completes the target and later steps (unless the target is `editable` and completed) |
| `nav` | `true`: built-in Back / Continue (Finish on the last step) |
| `readonly` | Progress display only: headers lose button role, tab stop, ripple and state layer; `aria-current` stays; linear dimming is off |
| `nextDisabled` (`next-disabled`), `loading` | Gate only the built-in Continue; `loading` also disables Back and shows the button spinner |
| `lazy` | Mounts only the active step's panel |
| `label` | `Progress` (navigation landmark name) |
| Words | `step-word` Step, `of-word` of, `completed-word`, `current-word`, `error-word`, `optional-word` Optional, `next-label` Continue, `back-label` Back, `finish-label` Finish |
| `density` | 0 … −4 |

Events:

* `mdBeforeChange {index, previous}` is cancelable. It fires for header
  clicks, the built-in nav and `next()` / `prev()` / `goTo()`. It does
  **not** fire for writes to `active` or for `reset()`.
* `mdStepChange {index, previous}` fires after `active` changes.
* `mdComplete` fires when Continue is pressed on the last step.

Methods: `next()`, `prev()` (both skip disabled steps), `goTo(i)` and
`reset()`.

The host is a `navigation` landmark named by `label`, holding an `<ol>` of
steps. Two visually hidden live regions sit beside it:

* `role=status` (polite): "Step 2 of 3: Plan, current".
* `role=alert` (assertive): "Step 1 of 3: Account, error: Email is
  required". It is emptied once no step is in error (fix K).

Panels:

* Per-step content gives a vertical stepper expanding panels, and a
  horizontal stepper a full-width panel under the row (grid
  `data-panel-mode=step`).
* With no step content, the `content` slot is the shared region.

### md-step

Properties:

* Text: label, description, error-text, accessible-name.
* State: completed (reflected), active (stepper-managed), error, disabled,
  optional, editable.
* Icons: `icon`, `completed-icon` (`check`), `error-icon` (`priority_high`).
* Other: hide-actions, density.

Events: `mdStepClick {index}`, `mdStepNext {index}`, `mdStepBack {index}`.
They bubble but are not composed.

The header is `role=button`, with:

* `aria-current=step` when active, `aria-disabled` when unreachable or
  disabled, and `aria-expanded` when it owns a panel;
* tab stop 0 when reachable, −1 otherwise;
* activation on Enter or Space.

The host is `role=listitem` and also carries `aria-current` and
`aria-disabled`. A vertical active step renders its own Back / Continue in
its panel.

**Linear reachability:**

* Backward is always allowed.
* Forward is allowed when the target is completed, or every earlier step is
  completed, optional **or disabled** (fix J).
* Unreachable headers are `aria-disabled` (on the host listitem too), out of
  the tab order, and their indicator and text parts are drawn at opacity
  .38.
* Non-linear mode allows any non-disabled step.

## Layout reference (DPR 1, Roboto, light theme)

* **Indicator:** 32 / 28 / 24 at density 0 / −2 / −4, a full circle. The
  active bubble is scaled by a 500ms spring to about 1.12 (32 → 35.9). The
  dot indicator is 10, or 14 when active.
* **Label:** title-small 14/20, weight 500 (600 when active); 13/18 at −2
  and 12/16 at −4.
* **Description:** 12 (11 at −2, 10 at −4).
* **Connector (horizontal):** thickness max(2, 4 + 0.5·d), so 4 / 3 / 2. It
  is drawn per gap from indicator edge to indicator edge with a 10 + d gap
  (112 wide in an 820 row of five steps). Radius 9999.
* **Connector (vertical):** a 4px rail centred under the bubble (x = bubble
  centre − 2). Its height is the step box.
* **Horizontal row:** labels sit under the bubble, centred, at y = 58 below
  a 32 bubble. The panel spans the full width under the row; the nav bar
  sits at the bottom with Back (text button) and Continue (filled button),
  small size, end-aligned. The whole stepper is 212 high for the reference
  case (d0) and 177 / 142 at −2 / −4.
* **Vertical:** the bubble sits at inline-start 16–48 and the label and
  description start at 68 (a 20 gap). The active panel holds the content and the step's own Back / Continue.
  The expanded panel is 100 high in the reference case.
* **Mobile:** a single bar, Back · "Step N of M" (or dots) · Continue, with
  the content slot above it.
* **RTL:** everything mirrors: step order, the connector side, the fill
  origin and the nav order.

## Paint reference

| Element | Light | Dark |
|---|---|---|
| Pending bubble / text | `#E6E0E9` / `#49454F` | `#36343B` / `#CAC4D0` |
| Active bubble / text | primary `#6750A4` / white, plus a primary halo ring | `#D0BCFF` / `#381E72` |
| Completed bubble | primary / on-primary, `check` glyph | `#D0BCFF` |
| Error bubble / text | error `#B3261E` / white, `priority_high` | `#F2B8B5` / `#601410` |
| Dot (pending) | outline `#79747E` | |
| Label | on-surface-variant `#49454F`; active on-surface `#1C1B1F` (600); error `#B3261E` | `#CAC4D0`; active `#E6E1E5` |
| Connector track / fill | outline-variant `#CAC4D0` / primary | `#49454F` / `#D0BCFF` |
| Unreachable / disabled | 38% | |

Every `--md-step-*` hook and `--md-stepper-gap` painted its sentinel in the
oracle (`hook-step-*`, `hooks-all-*`).

## Interaction and motion reference

* **Continue (horizontal):** event order is `mdBeforeChange`, then
  `mdStepChange` in the same task.
  * The previous step's connector fill runs `scaleX 0 → 1` linearly over
    350ms (sampled 0.048 per 16.7ms frame, done at 433ms).
  * The new active bubble springs to 1.12 over 500ms with
    `cubic-bezier(.38,1.21,.22,1)`, overshooting to 1.1217.
  * Bubble colour runs 200ms `cubic-bezier(.34,.8,.34,1)`, and the new glyph
    plays `md-step-glyph-in` (500ms).
* **Vertical panels:**
  * The outgoing panel collapses (`grid-template-rows` and opacity 200ms
    `cubic-bezier(.3,0,.8,.15)`, then `visibility` at 200ms).
  * The incoming panel expands (`grid-template-rows` 500ms spring
    `cubic-bezier(.38,1.21,.22,1)`, opacity 200ms). Sampled panel heights:
    0 → 100 by about 283ms.
  * Focus lands on the new active header.
* **Header:** state layer 200ms, hover .08, press .12, plus the ripple
  (450ms press, 150ms release).
* **Reduced motion:** no step motion at all; only the md-button ripple
  remains. Connector, bubble and panel changes are instant.
* **Live region:**
  * Polite text updates on every change ("Step 3 of 3: Review, current").
  * Error text appears on `error=true` and is emptied when the last error
    clears (fix K).
* **Gates:**
  * `mdBeforeChange` cancelled: no move and no `mdStepChange`.
  * `loading` or `next-disabled`: Continue is inert.
  * `readonly`: header clicks do nothing.
  * Linear: a future header click emits nothing.

## Source defects fixed (test-first)

Each new test failed on the unchanged source and passes after the fix.

* **J. A disabled step made every later step unreachable in linear mode**
  (`md-stepper.tsx` `canNavigateTo`, `md-step.tsx` `allPriorPassable`).
  * The defect: `next()` and Continue skip a disabled step, but header clicks
    and `goTo()` required every earlier step to be completed or optional. A
    disabled step can never be completed, so later headers stayed
    `aria-disabled` and dimmed, and `goTo()` refused.
  * Fix: a disabled step is passable for reachability (it remains
    unreachable itself). Readme updated.
  * Test: `md-stepper.disabled-skip.e2e.ts`, 3 tests:
    * a header click reaches the step after the disabled one (`{index: 2,
      previous: 0}`);
    * an incomplete enabled step still blocks;
    * the disabled step stays unreachable.
* **K. The error alert went stale and could not repeat** (`md-stepper.tsx`).
  * The defect: the assertive region kept "…error: …" after the error was
    cleared, so a browse-mode reader still found it. Because a live region
    only speaks when its content changes, the same error raised again was
    silent.
  * Fix: when an `error` attribute is removed and no step remains in error,
    the region is emptied. Readme updated.
  * Test: `md-stepper.error-live.e2e.ts`, 2 tests:
    * clear empties the region, and re-raising mutates and re-fills it;
    * a guard: the region stays while another step is still in error.

## Observed, not changed (decisions needed)

* **An initial `active` > 0 does not complete earlier steps**, but their
  connectors draw filled. Auto-complete runs only on a change (paint
  `matrix-*`: step 1 shows a pending "1" bubble beside a filled connector).
  Two options: complete on first load, or draw connectors from the
  completed state.
* **Linear `next()` with `auto-complete="false"`** does not require the
  current step to be completed. Only header and `goTo()` reachability does.
* **Non-linear forward jumps auto-complete the skipped steps** (oracle
  `nonlinear-header-clicks`: a jump from 1 to 3 marks steps 1 and 2
  completed).
* **Space acts on keydown** on a step header; native buttons act on keyup.
* **`aria-current` is on both the host listitem and the header button**,
  and `aria-disabled` is on the listitem (a role that does not support it).
* **`reset()` emits `mdStepChange` without `mdBeforeChange`**, so a reset
  cannot be vetoed.
* **Changing `error-text` while `error` stays true is not announced.** The
  observer watches only the `error` attribute.
* **The connector-origin rules use `:host-context([dir=rtl])`**, which is
  Chromium-only. On Safari and Firefox, the fill grows from the left in RTL
  unless `dir` is set on the step itself.

## Evidence

* **Source tests** (Linux Chromium 141, Stencil 4.44.0 with the repo
  patch). Totals are in the Gate 1 report and
  `outputs/native-parity/md-stepper/source-tests/`.
* **Oracle:** `outputs/native-parity/md-stepper/web-oracle-cloud/` (see its
  README):
  * `paint.json`: 142 cases;
  * `states.json` and `states-reduced.json`: 20 runs each.
