# Android `md-segmented-button-set` parity record

The supporting set is implemented and verified together with its segment child. See [the shared Android Segmented audit](md-segmented-button.md) for exact selection/event semantics, native keyboard behavior, layout, typed state API and retained test evidence.

This record covers both set properties (`multiselect`, `density`), the structural default slot and `mdChange`. The event callback preserves the exact ordered values array, including duplicate and empty values. `AWCActionEvent.rawDetail` and `segmentedSelectionValues` preserve that array in scoped native events. There are no public set methods or invented set appearance hooks.
