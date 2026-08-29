---
'@awc-ui/core': minor
---

**md-stepper:** new `readonly` prop — render the stepper as a status trail
rather than a control.

A stepper is not always something to drive. Used to report where something
already is — a review trail, an order's progress, a pipeline stage — every step
header was still a button: focusable, rippling, hovering, announced as
pressable, and doing nothing when clicked.

`readonly` removes the offer. Each header drops `role="button"`, its tab stop,
its composed button label, its ripple and its hover/focus state layer, and
clicks and Enter/Space no longer fire `mdStepChange`. `aria-current` stays,
because which stage is live is the one thing the visible text does not carry.

It is distinct from the two things that looked like it:

- `nav="false"` only hides the Back / Continue bar and leaves every header
  clickable.
- `disabled` refuses and dims to 38%, which is wrong for a stage that simply has
  not happened yet.

`readonly` also makes `mode` irrelevant — with nothing navigating, linear gating
no longer dims the stages ahead. A step explicitly marked `disabled` stays
disabled.
