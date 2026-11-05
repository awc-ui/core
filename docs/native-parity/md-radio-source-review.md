# Radio source review

Status: gate 1 complete. Contract inventory done; three defects were demonstrated in Chrome and fixed
test-first (below) and mirrored into `packages/core/src`. Paint, keyboard-group and interaction oracles
are captured on the Mac. The dedicated native renderers, their group registry and tests are in place
(checkpoint: [md-radio.md](md-radio.md)).

## Public contract

Properties: `checked` (mutable, reflected), `disabled`, `softDisabled`, `required`, `name`
(reflected), `value` (reflected, `''`), `density` 0…−4, `valueMissingLabel`.

Events: `mdChange` (`{checked: true, value}` — only on becoming checked), `mdFocus`, `mdBlur`,
`mdValidityChange`. Methods: `setFocus()` (forces the focus ring), `setBlur()`, `select()`
(checks and emits like a user), `getValidity()`, `checkValidity()`, `reportValidity()`,
`setCustomValidity(message)`. No slots. Parts: `state-layer`, `container`, `outer-circle`,
`inner-circle`.

Seven hooks: `--md-radio-icon-color`, `-selected-icon-color`, `-icon-size` (max(16, 20+d)),
`-inner-circle-size` (max(8, 10+d/2)), `-state-layer-size` (max(24, 40+4d)),
`-state-layer-color`, `-selected-state-layer-color`.

## Behaviour from the source (to verify in Chrome)

- Group by `name` in the same root: checking one unchecks the others (no event for them).
  Roving tabindex: the checked radio, else the first enabled one, is the tab stop; disabled is −1;
  a radio without a name is always 0.
- Click and Space check (Space with ripple and a 150 ms pressed pulse); a checked radio ignores
  further activation. Arrow Down/Right and Up/Left move focus to the next/previous enabled radio
  (wrapping, skipping disabled and soft-disabled) and check it, dispatching `mdChange`.
- A wrapping `<label>` click checks the radio. Pointer interaction clears the programmatic focus
  ring. Group validity (`required`) is a property of the whole group.

## Defects found and fixed (test-first)

The trusted-keyboard group oracle (`outputs/native-parity/md-radio/web-reference/group.html`, before-fix
capture `web-oracle/web-group-before-fix.json`) demonstrated two defects in Chrome:

1. **Two tab stops in one group.** In a group that started with nothing checked, the first enabled
   radio kept `tabindex="0"` after an arrow key checked another member (`['0','0','-1']`), because the
   roving tab index of a radio that was never checked was not refreshed. Fix: the group-coordination
   hook `syncValidityFromGroup()` (already called on every sibling when a member's `checked` changes)
   now also refreshes the roving tab index.
2. **Spurious `mdChange`.** An arrow key with no other available member (a group with one enabled
   radio, or a single named radio) re-dispatched `mdChange` on the already checked radio. Fix:
   `focusSibling` only moves focus when the target is already checked.

3. **Reduced motion kept the press squish.** As md-checkbox's C2, the REDUCED MOTION block's bare
   `.md-radio__container` lost to the more specific `:host(.md-radio--pressed) .md-radio__container`
   transition, so the 200 ms squish still animated. Fix: the block lists the pressed selector too.
   Test `md-radio.reduced-motion.e2e.ts` (2 tests): the squish test failed on the unchanged CSS
   (`source-tests/reduced-red.log`: 1 failed, the guard passed) and passes with the fix
   (`reduced-green.log`: switch/checkbox/radio 14 suites, 257 tests). Diff: `source-tests/md-radio.css.diff`.

Two e2e tests were added to `md-radio.keyboard.e2e.ts` for 1 and 2; they failed on the unchanged source
(`outputs/native-parity/md-radio/source-tests/red.log`: 2 failed, 2 passed) and pass with the fix in
the private copy `work/selection-tree` together with every switch/checkbox/radio suite
(`green.log`: 12 suites, 251 tests). Only these two verified files were mirrored into
`packages/core/src/components/md-radio/` (diffs: `source-tests/md-radio.tsx.diff`,
`md-radio.keyboard.e2e.ts.diff`); `packages/core/dist` was not rebuilt. The group oracle on the fixed
private build (`web-oracle/web-group.json`) shows one tab stop and no re-announcement.

## Oracles

Paint (`web-oracle/web-paint.json`, 160 PNGs), the keyboard group (`web-group.json`, fixed build) and
the interaction oracle (`web-states.json`, 10 runs / 82 phase shots; `web-states-reduced.json`, 2 runs /
20 shots), all captured on the Mac (Chrome 153) from the private build with the three fixes. Gate 1
is complete; the native renderers followed ([plan](md-radio-native-plan.md), [checkpoint](md-radio.md)).

## Decisions (autonomous, 2026-10-31, reversible)

The shared `aria-invalid`-at-rest and `<fieldset disabled>` decisions for md-checkbox, md-switch and md-radio are recorded in
[md-checkbox-source-review.md](md-checkbox-source-review.md#decisions-autonomous-2026-10-31-reversible) (gate-7 R4-07).
