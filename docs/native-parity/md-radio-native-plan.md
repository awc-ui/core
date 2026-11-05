# Radio native implementation plan and Chrome oracles

Status: implemented (checkpoint: [md-radio.md](md-radio.md)). The contract and the source fixes are in
[md-radio-source-review.md](md-radio-source-review.md). Both platforms render md-radio through dedicated
renderers with a native group registry; the plan below is kept as written before the implementation.

## Oracles (Mac, Chrome 153, DPR 1, trusted input; `outputs/native-parity/md-radio/`)

- **Paint** `web-oracle/web-paint.json` (160 PNGs): light/dark × LTR/RTL × density 0…−4 ×
  unchecked/checked × rest/disabled/soft-disabled, all seven hooks together and each alone, the
  four parts, keyboard and programmatic (`setFocus`) focus rings, required validation and hidden.
  Captured before the reduced-motion fix, which changes no resting paint.
- **Keyboard group** `web-oracle/web-group.json` (fixed build) and `web-group-before-fix.json`:
  roving tab stop, arrows (wrap, skip disabled and soft-disabled), Space, a single available member,
  a lone named radio and unnamed radios.
- **Interaction** `web-reference/states.html` (r0 in a three-member group between two probes):
  hover, press, release, leave, Tab, Space, ArrowDown (checks r1, r0's dot shrinks), ArrowUp, Enter,
  Tab away; dark, RTL, all hooks, density −4, soft and hard disabled, form reset, press-and-drag-off;
  and the reduced-motion set. Every frame is sampled: container scale, outer border colour, inner
  dot scale and colour, state layer, the focus-ring outline, group checked states and tab indices.

## What the native renderers need beyond md-checkbox

The paint and motion model follows the checkbox closely (touch target, state layer without a
focus-visible opacity, squish, md-ripple, outer ring colour transition, inner dot `scale(0→1)` with
`medium4` emphasized-decelerate, focus ring as a 3pt outline on the state-layer circle). The new part
is the **group**: both platforms need a name-scoped registry in the native tree (ordered members,
checked, disabled/soft-disabled) that provides the single roving tab stop, Arrow Down/Right and
Up/Left (wrap, skip unavailable, focus and check, `mdChange` only when the target was not checked),
unchecking siblings without events, and the group's `required` validity. Swift can build it on the
existing `AWCButtonFocusGroup` roving focus and the `radioValues` store; Compose needs a
`CompositionLocal` registry (today group coordination exists only inside an `AWCFormState`).
