# md-list — accessibility parity

Generated 2026-10-29T11:11:41.543Z by tools/ax. Web = Chrome AX tree of the same effective node.

## single-select

- Web: listbox: · option:Design review Project milestone · option:Prototype Project milestone · option:Release Project milestone · Tab: option:Design review Project milestone
- macos (pass): option:Design review Project milestone · option:Prototype Project milestone · option:Release Project milestone · Tab: option:Design review Project milestone → option:Design review Project milestone → option:Design review Project milestone → option:Design review Project milestone
- ios (pass): option:Design review Project milestone · option:Prototype Project milestone · option:Release Project milestone · Tab: option:Design review Project milestone → ∅ → option:Design review Project milestone → ∅
- android (pass): radio:Design review Project milestone {"checked":"false"} · radio:Prototype Project milestone {"checked":"false"} · radio:Release Project milestone {"checked":"false"} · Tab: radio:Design review Project milestone → radio:Design review Project milestone → radio:Design review Project milestone → radio:Design review Project milestone

## multi-select

- Web: listbox: · option:Design review Project milestone · option:Prototype Project milestone · option:Release Project milestone · Tab: option:Design review Project milestone
- macos (pass): option:Design review Project milestone · option:Prototype Project milestone · option:Release Project milestone · Tab: option:Design review Project milestone → option:Design review Project milestone → option:Design review Project milestone → option:Design review Project milestone
- ios (pass): option:Design review Project milestone · option:Prototype Project milestone · option:Release Project milestone · Tab: option:Design review Project milestone → ∅ → option:Design review Project milestone → ∅
- android (pass): checkbox:Design review Project milestone {"checked":"false"} · checkbox:Prototype Project milestone {"checked":"false"} · checkbox:Release Project milestone {"checked":"false"} · Tab: checkbox:Design review Project milestone → checkbox:Design review Project milestone → checkbox:Design review Project milestone → checkbox:Design review Project milestone

## none

- Web: list: · listitem: · listitem: · listitem: · text: Design review / Project milestone / Prototype / Project milestone / Release / Project milestone
- macos (pass):  · text: Design review / Project milestone / Prototype / Project milestone / Release / Project milestone · Tab: ∅ → ∅ → ∅ → ∅
- ios (pass):  · text: Design review / Project milestone / Prototype / Project milestone / Release / Project milestone · Tab: ∅ → ∅ → ∅ → ∅
- android (pass):  · text: Design review / Project milestone / Prototype / Project milestone / Release / Project milestone · Tab: ∅ → ∅ → ∅ → ∅
