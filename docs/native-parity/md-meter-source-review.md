# Meter source review

Status: source reviewed, both themes measured; dedicated native migration and
acceptance pending. A generic progress indicator does not implement this contract.

## Contract

Fourteen properties: `value`, `min`, `max`, `label`, `showLabel`, `showValue`,
`valueText`, `locale`, `formatOptions`, `color`, `variant`, `size`, `thickness`,
and `density`. No public events, slots or methods. Five parts: `track`,
`indicator`, `label`, `value`, `circular`. Seven appearance hooks: indicator and
track colors, track shape, height, label and value colors, circular size.

The component represents a read-only state with named meter semantics and a
bounded value, not an ongoing activity. The visual label/value are presentational;
the host owns minimum, maximum, current value and the formatted value text.
Hidden removes layout and paint.

Finite minimum defaults to 0; finite maximum defaults to 100 and is raised to
minimum for an inverted range. Nonfinite value falls back to minimum. Value is
clamped consistently for display, geometry and accessibility. Empty range is 0%.
Opposite-sign finite endpoints can overflow their difference. The Web component
now scales that calculation before subtraction; five regression cases verify
0%, 25%, 50%, 75% and 100% across the full finite numeric interval. Native
implementations must preserve these finite results.
`valueText` overrides both visible and accessible text, including literal
whitespace. Otherwise absent format options format the fraction as a localized
percentage; provided options format the **clamped raw number**, including an
empty options object. Invalid locale/options fall back to the raw number string.

Native format options must have a real public implementation, not only a
preformatted Laboratory string. Locale/numbering conventions, currency, unit,
decimal, grouping, precision, compact/scientific notation and sign choices need
explicit mapping and verification; unsupported platform combinations must be
identified rather than silently ignored.

## Layout, color and motion

Linear fills the available width. Track height is `max(2, thickness + .5*d)`;
the public height hook wins, including zero. Local negative density overrides an
inherited value; local 0 inherits. Noncanonical inherited -1.5 is supported.
The fill starts at logical inline start and mirrors in RTL. Fill and clipping
track inherit the same radius; percentage radii resolve against their own boxes.

The optional header uses baseline alignment, gap8, and bottom spacing
`max(2, 4 + .5*d)`. Label is 14/20 at default density, reduced by .5/1 per rung
with 11/14 floors; it ellipsizes before shrinking the value. Value is 12/16,
reduced by .5/1 with 10/12 floors, tabular digits, and no flex shrink. With only
the value visible, the single flex child is at **inline start** despite the
property comment describing it as end aligned; implement the actual source.

Circular uses a user-unit diameter from positive finite `size` or48, clamped to
24…240. Rendered diameter is `max(24, resolvedSize + 2*d)` unless the public size
hook overrides it, including zero. SVG stroke is positive finite `thickness`
or4; radius is `max(.5, (resolvedSize - stroke)/2)`. Density scales the whole
SVG proportionally, including stroke. The linear height hook does not alter
the ring. Filling is clockwise from12 in both directions, with round caps;
zero fraction has zero indicator opacity. The source SVG circle's bounding box
excludes stroke: default track/indicator part is44×44 inside the48 square.
Native inspection must distinguish geometric path bounds from painted bounds.

Circular value is centered, size `.26*renderedDiameter`, line height1, padding
`.18*diameter`; caption wraps underneath at up to twice the rendered diameter.
The host shrink-wraps the widest child. A long caption in the fixture produces
96×112 overall for a48 ring, not a fixed48 square.

Color accepts arbitrary valid CSS identifiers backed by theme roles. Primary
uses primary fill and **secondary-container** track. Other roles resolve their
own role and container, falling back independently. Invalid role text uses
defaults; token names remain case-sensitive. Explicit component hooks win and
retain alpha. The custom `brand` fixture verifies a nonstandard theme role.

Value changes use300ms cubic-bezier(.2,0,0,1) width/dashoffset transitions; ring
opacity uses200ms linear. Reduced motion disables these transitions. Forced
colors maps fill/stroke to CanvasText and track to GrayText. Preference branches
are source-reviewed here; native preference execution remains required.

## Evidence and acceptance

`outputs/native-parity/md-meter` contains98 hydrated configurations per theme,
actual geometry/style/ARIA/SVG measurements, resolved theme tokens, screenshots,
and the reproducible fixture. Cases include both variants, all density rungs,
inherited density, RTL, clamping/empty ranges, every style hook, custom theme
roles, zero dimensions, extreme stroke/size, narrow labels, wrapped captions,
six locales, and eight format-option combinations. Focused repository
Jest/axe suites passed51/51. Ten configurations exercise the extreme finite
interval across both variants. `validate-web.py` checks current geometry,
accessibility and extreme-range output, and compares the previous88 fixtures
against their preserved capture. The only excluded comparison is the x/y
origin of a hidden host, which has no rendered box and depends on its fixture
card's position in the larger matrix.

The zero-size SVG fixture reports residual44×44 path geometry even though its
viewport is0×0 and paints nothing. Do not fabricate visible native bounds from
that browser geometry artifact. Native renderer, public APIs, native inspection,
all parts, animations, native semantic evidence, compiled examples, Laboratory
control parity, actual iOS execution and independent review remain pending.
