# Status Dot — Android checkpoint

The dedicated Compose renderer implements all seven Web properties and all eight
typed appearance fields. `AWCStatusDotHost` measures the actual containing parent
for anchored dots; inline dots participate in ordinary layout. Logical anchors
respect local and inherited direction. Parent-relative inset fractions, explicit
zero sizes, alpha colors and inherited noncanonical density are preserved.

The source exposes no events, methods, slots or CSS parts. The label is an
accessibility name, never visible text. Empty labels are decorative; named live
dots expose a polite live region. Hidden dots have no captured measurement.
Zero-size dots retain their actual zero-size bounds rather than reporting the
containing parent.

Paint follows the source theme tokens, physical-pixel outline snapping and
invisible-state inset ring. The pulse applies CSS ease-out independently to its
two intervals and paints an exterior-only halo. A transparent fill is not
recolored by that halo. Zero duration stops the pulse and restores static paint.

## Recorded checks

Workspace artifacts are under `outputs/native-parity/md-status-dot/android`.
`verification.json` separates the initial and repaired runs and links their
source hashes and original result files.

- 91 library unit tests passed.
- Three renderer device methods passed: 200 measured Web configurations across
  light/dark themes, actual accessibility semantics, and pulse pixels/lifecycle.
- One real preview-host method passed seven anchored, circular, RTL, local
  direction, inline, typed-style, zero and hidden scenarios.
- Two Badge regressions passed after the shared inherited-density and inspection
  changes.

The first host run exposed an old preview fixture that forcibly set inline mode.
The fixture was corrected to the actual online anchored recipe; the failed run
and subsequent successful run remain recorded. Renderer inputs did not change
between these two device runs.

Eleven generated Kotlin examples compile. Their complete sources, compiler log
and hashes are retained in `../examples/verification.json` relative to the
component's artifact directory.

## Remaining gates

Laboratory right-panel acceptance and the independent final audit remain pending.
TalkBack and OS reduced-motion/increased-contrast settings were not exercised.
The implemented animator preference branch is not evidence of a tested OS
preference change. These Android results make no claim about iOS execution.
