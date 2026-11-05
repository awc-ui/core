# md-checkbox — accessibility parity

Generated 2026-10-29T11:11:42.329Z by tools/ax. Web = Chrome AX tree of the same effective node.

## unchecked

- Web: checkbox:Receive updates · Tab: checkbox:Receive updates
- macos (pass): checkbox:Receive updates {"checked":"false"} · Tab: checkbox:Receive updates → checkbox:Receive updates
- ios (pass): checkbox:Receive updates {"checked":"false"} · Tab: checkbox:Receive updates → ∅
- android (pass): checkbox:Receive updates {"checked":"false"} · Tab: checkbox:Receive updates → checkbox:Receive updates

## checked

- Web: checkbox:Receive updates
- macos (pass): checkbox:Receive updates {"selected":"true","checked":"true"}
- ios (pass): checkbox:Receive updates {"selected":"true","checked":"true"}
- android (pass): checkbox:Receive updates {"checked":"true"}

## indeterminate

- Web: checkbox:Select all
- macos (pass): checkbox:Select all {"checked":"mixed"}
- ios (pass): checkbox:Select all {"checked":"mixed"}
- android (pass): checkbox:Select all {"checked":"mixed"}

## disabled

- Web: checkbox:Receive updates
- macos (pass): checkbox:Receive updates {"disabled":"true","checked":"false"} · Tab: ∅ → ∅
- ios (pass): checkbox:Receive updates {"disabled":"true","checked":"false"} · Tab: ∅ → ∅
- android (pass): checkbox:Receive updates {"disabled":"true","checked":"false"} · Tab: ∅ → ∅

## soft-disabled

- Web: checkbox:Receive updates · Tab: checkbox:Receive updates
- macos (pass): checkbox:Receive updates {"disabled":"true","checked":"false"} · Tab: checkbox:Receive updates → checkbox:Receive updates
- ios (pass): checkbox:Receive updates {"disabled":"true","checked":"false"} · Tab: checkbox:Receive updates → ∅
- android (pass): checkbox:Receive updates {"disabled":"true","checked":"false"} · Tab: checkbox:Receive updates → checkbox:Receive updates

## error

- Web: checkbox:Accept terms · alert: · text: You must accept the terms
- macos (pass): checkbox:Accept terms {"invalid":"true","checked":"false"} · text: You must accept the terms
- ios (pass): checkbox:Accept terms {"checked":"false"} · text: You must accept the terms
- android (pass): checkbox:Accept terms {"checked":"false","invalid":"true"} · text: You must accept the terms

## error-appears

- Web: checkbox:Accept terms
- macos (pass): checkbox:Accept terms {"checked":"false"} · announced: You must accept the terms
- ios (pass): checkbox:Accept terms {"checked":"false"}
- android (pass): checkbox:Accept terms {"checked":"false"}

## required

- Web: checkbox:Accept terms
- macos (pass): checkbox:Accept terms {"required":"true","invalid":"true","checked":"false"}
  - expected state: checkbox "Accept terms" required: ∅ → true — The Web source sets aria-required="true" on the control; Chrome does not report required for checkbox/radio/switch roles in its tree. macOS exposes AXRequired as the source declares (iOS has no required channel).
- ios (pass): checkbox:Accept terms {"checked":"false"}
- android (pass): checkbox:Accept terms {"checked":"false","invalid":"true"}
