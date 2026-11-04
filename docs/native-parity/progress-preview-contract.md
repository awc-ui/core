# Retained Progress preview updates

Status: shared validation, transport, client and Properties routing are implemented
and pass 92 focused checks. The integrated appearance, recipe, examples and
transport regression run passes119 checks. Both native hosts have executed
retained-update and actual-completion checks; twenty public examples compile on
each platform. Final Laboratory acceptance and the corrected Android inspector
retake are tracked in [the integrated checkpoint](md-progress-indicator.md).

The source `complete` watcher runs on a later property change. An initially true
value does not start completion, and setting false does not reset a completed
component. Recreating the native session on every edit cannot demonstrate that
contract. The preview therefore applies property edits to the mounted Progress
root without changing its identity.

```json
{"command":"update","properties":{"complete":true}}
```

This is a preview transport operation, not a new public component method.
It uses the existing session input endpoint and serialized command queue.
Only `md-progress-indicator` is eligible. Allowed properties are its fourteen
source declarations:

| Type | Properties |
| --- | --- |
| `linear` or `circular` | `variant` |
| Finite number | `value`, `max`, `thickness`, `waveAmplitude`, `waveLength`, `waveSpeed`, `size` |
| Boolean | `indeterminate`, `wave`, `fourColor`, `complete` |
| String, at most 4096 UTF-8 bytes | `label` |
| 0, −1, −2, −3 or −4 | `density` |

A patch contains at least one property. Zero, false, empty labels and negative
finite numeric inputs are retained for the renderer's source-defined behavior.
Unknown fields, other component roots, arbitrary targets, getters, nulls and
nonfinite numbers are rejected. The Properties panel sends one edited property
at a time. Consecutive changes are not coalesced: false then true must remain
two distinct updates.

Native hosts must mutate an observable root property holder while preserving the
same rendered component, its animation state and event subscription. The normal
input acknowledgement means the update was applied; it does not mean completion
finished. Only the actual component lifecycle may produce `mdComplete`.
Streaming can supply subsequent rendered frames and events independently.

The panel selects this route only when the adapter declares all fourteen
implemented properties and a matching live session is connected. Initial
configuration and Reset retain their ordinary mount behavior. Theme, appearance
and viewport changes still use the existing session-recreation path; this scoped
change does not claim retained updates for those inputs or other components.

A session switch/Reset rejects in-flight and queued update promises and discards
late responses. An uncertain update failure is reported, never replayed or
silently converted to a remount. The existing bounded queue and session expiry
remain in force.

Evidence: `outputs/native-parity/md-progress-indicator/shared-retained-update-tests.log`.
The focused suites cover source-property drift, validation, session identity,
false/true ordering, acknowledgement versus actual completion, cancellation,
late replies, non-retry behavior, both server transports and browser module
serving. They are shared-code evidence, not native execution.

## Shared styles and copyable examples

The profile exposes all thirteen source hooks, in the same public initializer
order on SwiftUI and Compose: activeIndicatorColor, activeIndicatorShape,
trackColor, trackShape, stopIndicatorColor, stopIndicatorShape, stopIndicatorSize,
stopIndicatorTrailingSpace, trackActiveIndicatorSpace and fourColor1 through4.
Colors accept RGB/RGBA; physical elliptical corner shapes reuse AWCCornerShape.
Stop size is nonnegative, while trailing space and active/track gap remain signed
finite values. Default and local appearance dictionaries retain that distinction.

Web and native recipes use the same authored300-unit parent. Linear fills it;
circular retains intrinsic size. Native event examples change complete on an
already-mounted indicator, observe the actual null-detail mdComplete event, and
remount explicitly for Reset. They do not invent a public completion method.
The three source part recipes use the actual supported appearance hooks.

Evidence: `shared-appearance-tests.log` (8 focused checks) and
`shared-integration-tests.log` (119 relevant regression checks). The twenty-case
public example generator in `examples/generate.mjs` requires actual native
implementation declarations before producing compile fixtures. All twenty
examples now compile on each native platform. Native execution and Laboratory
completion remain separate acceptance gates.
