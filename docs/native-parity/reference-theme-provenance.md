# Browser reference theme provenance

The browser matrices captured before the Accordion font-isolation correction
load `/web-dist/md3/md3.css` followed by `/fonts.css`. The latter URL resolves
to the whole `apps/native-playground/styles.css`, not just its font faces. Its
`:root` rule supplies a partial green Laboratory palette and `color-scheme:
light`. Consequently, a fixture labelled `light` or `dark` identifies its
`data-theme` state, not an unmodified default-library palette.

This matters for roles that the Laboratory overrides without overriding their
paired foreground. For example, the recorded dark reference can retain
secondary-container `#d5e8df` while on-secondary-container resolves from the
library dark palette. This is fixture provenance, not evidence that those are
the intended native default colors.

## What the existing evidence establishes

The Badge, Status Dot, Divider, Loading Indicator, Meter, Progress Indicator
and Skeleton matrices save computed system token maps alongside the measured
geometry and paint. The native oracle runners that apply those exact recorded
maps establish parity under the captured theme. Their measured layout,
typography, motion, semantic and event results remain useful. Native tests that
separately assert generated default token roles establish native role selection;
they do not, by themselves, establish a fresh default-browser pixel comparison.

Earlier Button Group, FAB, Segmented Button, FAB Menu and Split Button fixtures
also load `/fonts.css`. Their stored computed colors describe that actual
cascade. Geometry comparisons must not be promoted into a default-palette
parity claim. The Snackbar and Tooltip source fixtures, including their nested
iframe documents, have the same provenance. A source screenshot or captured
CSS color is not proof of a completed native migration.

The active Laboratory preview has its own explicit generated theme and is a
separate acceptance surface. Its screenshots must retain their selected theme
and configuration; visual inspection is not a claim of pixel identity.

## Subsequent references

Accordion now uses `/reference-fonts.css`, which contains only the font-face
declarations, and retains its earlier captures under `before-font-isolation`.
New default-palette acceptance must use this isolated font source, record the
resolved theme tokens, and compare the native renderer with the same inputs.
Historical matrices and hashes must remain intact. A future fresh-default
comparison is a separate gate; this note does not retroactively claim one.

The independent provenance inspection and source hashes are retained in
`outputs/native-parity/reference-theme-provenance.json`.


Skeleton now has a separate completed default-palette comparison under
`outputs/native-parity/md-skeleton/default-palette`: 106 fresh configurations
per theme using only the font stylesheet and unmodified library tokens. Swift
passes 1,974 checks; Android compares all 212 configurations. Both native tests
use their generated default palettes without injecting the recorded browser
colors. This closes that specific Skeleton gate and does not retroactively
change the provenance or acceptance status of other component matrices.
