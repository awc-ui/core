# md-switch — accessibility parity

Generated 2026-10-29T11:11:42.028Z by tools/ax. Web = Chrome AX tree of the same effective node.

## off

- Web: switch:Enable notifications · Tab: switch:Enable notifications
- macos (pass): switch:Enable notifications {"checked":"false"} · Tab: switch:Enable notifications → switch:Enable notifications
- ios (pass): switch:Enable notifications {"checked":"false"} · Tab: switch:Enable notifications → ∅
- android (pass): switch:Enable notifications {"checked":"false"} · Tab: switch:Enable notifications → switch:Enable notifications

## on

- Web: switch:Enable notifications
- macos (pass): switch:Enable notifications {"selected":"true","checked":"true"}
- ios (pass): switch:Enable notifications {"checked":"true"}
- android (pass): switch:Enable notifications {"checked":"true"}

## disabled

- Web: switch:Enable notifications
- macos (pass): switch:Enable notifications {"disabled":"true","checked":"false"} · Tab: ∅ → ∅
- ios (pass): switch:Enable notifications {"disabled":"true","checked":"false"} · Tab: ∅ → ∅
- android (pass): switch:Enable notifications {"disabled":"true","checked":"false"} · Tab: ∅ → ∅

## soft-disabled

- Web: switch:Enable notifications · Tab: switch:Enable notifications
- macos (pass): switch:Enable notifications {"disabled":"true","checked":"false"} · Tab: switch:Enable notifications → switch:Enable notifications
- ios (pass): switch:Enable notifications {"disabled":"true","checked":"false"} · Tab: switch:Enable notifications → ∅
- android (pass): switch:Enable notifications {"disabled":"true","checked":"false"} · Tab: switch:Enable notifications → switch:Enable notifications

## required

- Web: switch:Accept terms
- macos (pass): switch:Accept terms {"required":"true","invalid":"true","checked":"false"}
  - expected state: switch "Accept terms" required: ∅ → true — The Web source sets aria-required="true" on the control; Chrome does not report required for checkbox/radio/switch roles in its tree. macOS exposes AXRequired as the source declares (iOS has no required channel).
- ios (pass): switch:Accept terms {"checked":"false"}
- android (pass): switch:Accept terms {"checked":"false","invalid":"true"}
