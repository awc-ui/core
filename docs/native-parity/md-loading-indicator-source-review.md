# Loading Indicator source review

Status: Web source reviewed and measured. Native migration and acceptance are
pending; a generic native spinner does not satisfy this component's contract.

## Public contract and geometry

Three properties: `variant` (`uncontained` by default or `contained`), `label`
(`Loading` by default), and local `density` 0/−1/−2/−3/−4. There are no public
events, methods or slots. The `shape` CSS part is public.

Five appearance hooks control shape color, component size, shape size, contained
background color and contained corner shape. The component is a square of
`max(32, 48 + 4*d)` unless explicitly sized. Its shape defaults to **0.792 times
the resolved component size**, not a fixed38. Both size hooks permit zero.
Density0/absent inherit the parent density; local negative rungs override it.
An inherited noncanonical−1.5 produces a42 square.

The source uses an inline flex row. The shape is centered and may shrink along
the row: with component24 and explicit shape80, its actual box is **24×80** at
(0,−28), clipped by the24×24 host. It is not an80×80 circle or a24×24 square.
The normal48 component resolves a38.0156 square shape in the measured DPR2
browser, reflecting CSS layout quantization of48×0.792.

Uncontained has a transparent, rectangular clipping container. Contained uses
primary-container background, on-primary-container foreground and the full
corner token (9999px in the captured theme). An explicit shape-color hook
overrides either variant. Radius supports CSS percentage, asymmetric and
elliptical forms; native equivalents must preserve those visible effects rather
than dropping the public container-shape hook. The oracle includes zero,7.5px,
25%,150%, four distinct corners and10px/20px elliptical radii. Generic hidden
suppresses layout and paint. RTL preserves the centered geometry.

## Animation and shape part

The shape uses the seven actual48-vertex polygons in the component stylesheet:
Soft Burst, Cookie9, Pentagon, Pill, Sunny, Cookie4 and Oval. The full cycle is
4.55seconds. Keyframe offsets are0,.143,.286,.429,.571,.714,.857,1, with rotations
0,154,309,463,617,771,926,1080degrees. These are rounded source offsets, not exact
sevenths. Each interval uses cubic-bezier(.34,1.45,.4,1), including overshoot.
The native animation must interpolate corresponding polygon vertices and
rotation continuously, then restart without an orientation jump.

The browser fixture captures the actual keyframes, sixteen paused samples,
computed polygons and transform matrices. At offset1 an infinite animation
wraps to its first frame. The measured shape-part override changes its fill and
actual box to20×30; the part is not merely documentation metadata.

Reduced motion replaces the morph/rotation with a circular shape and an opacity
pulse (1→.4→1 over2seconds, ease-in-out). Forced colors uses CanvasText for the
shape; contained additionally uses Canvas with a1px CanvasText outline.
These preference branches are source-reviewed, not exercised by this browser
capture. Native reduced-motion and contrast behavior need their own validation.

## Accessibility and verification

The host is an indeterminate progressbar with the original label and polite live
region. An additional visually hidden status text mirrors that label. The shape
is accessibility-hidden; no visible label is rendered. The native semantic
equivalent should avoid duplicate announcements while retaining a named
indeterminate progress indicator. Programmatic visible focus has a3px secondary
outline with2px offset and the container corner shape.

`outputs/native-parity/md-loading-indicator` contains42 hydrated configurations
in each theme, original Web shape/animation measurements, all resolved system
tokens, screenshots, the reproducible fixture and source evidence. The focused
repository Jest suite passed23/23. The deprecated integrated Stencil runner
stalled before results and was stopped; its log is preserved separately.

Native rendering, inherited density, every appearance hook and shape-part
equivalent, animation timing/cleanup, zero/hidden inspection, right-panel controls,
compiled examples, iOS/device execution and independent review remain open.
