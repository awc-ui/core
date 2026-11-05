# md-radio — accessibility parity

Generated 2026-10-29T11:11:42.528Z by tools/ax. Web = Chrome AX tree of the same effective node.

## unchecked

- Web: radio:Shared workspace · Tab: radio:Shared workspace
- macos (pass): radio:Shared workspace {"checked":"false"} · Tab: radio:Shared workspace → radio:Shared workspace
- ios (pass): checkbox:Shared workspace {"checked":"false"} · Tab: checkbox:Shared workspace → ∅
- android (pass): radio:Shared workspace {"checked":"false"} · Tab: radio:Shared workspace → radio:Shared workspace

## checked

- Web: radio:Shared workspace
- macos (pass): radio:Shared workspace {"selected":"true","checked":"true"}
- ios (pass): checkbox:Shared workspace {"selected":"true","checked":"true"}
- android (pass): radio:Shared workspace {"checked":"true"}

## disabled

- Web: radio:Shared workspace
- macos (pass): radio:Shared workspace {"disabled":"true","checked":"false"} · Tab: ∅ → ∅
- ios (pass): checkbox:Shared workspace {"disabled":"true","checked":"false"} · Tab: ∅ → ∅
- android (pass): radio:Shared workspace {"disabled":"true","checked":"false"} · Tab: ∅ → ∅

## soft-disabled

- Web: radio:Shared workspace · Tab: radio:Shared workspace
- macos (pass): radio:Shared workspace {"disabled":"true","checked":"false"} · Tab: radio:Shared workspace → radio:Shared workspace
- ios (pass): checkbox:Shared workspace {"disabled":"true","checked":"false"} · Tab: checkbox:Shared workspace → ∅
- android (pass): radio:Shared workspace {"disabled":"true","checked":"false"} · Tab: radio:Shared workspace → radio:Shared workspace

## required

- Web: radio:Shared workspace
- macos (pass): radio:Shared workspace {"required":"true","invalid":"true","checked":"false"}
  - expected state: radio "Shared workspace" required: ∅ → true — The Web source sets aria-required="true" on the control; Chrome does not report required for checkbox/radio/switch roles in its tree. macOS exposes AXRequired as the source declares (iOS has no required channel).
- ios (pass): checkbox:Shared workspace {"checked":"false"}
- android (pass): radio:Shared workspace {"checked":"false","invalid":"true"}
