# Accordion source review

Status: Web contract and browser reference verified. Dedicated
complete native rendering and integrated acceptance remain pending. The internal
[native state and motion checkpoint](md-accordion-native-state.md) now covers
source coordination and numerical motion. An incomplete
[SwiftUI renderer checkpoint](md-accordion-swift-renderer.md) additionally checks
default geometry/paint and real native interactions on macOS; neither checkpoint
constitutes complete renderer acceptance. This record
covers both `md-accordion` and its supporting `md-accordion-item` tag.

## Public contract

The parent has15 properties: variant, density, elevation, reorderable,
floating, initialX, initialY, bringToFront, exclusive, keepOneExpanded,
headingLevel, region, regionThreshold, transition and defaultExpanded.
Defaults are filled,0,0,false,false,24,24,true,false,false,3,auto,6,
expressive and the empty string, respectively. Initial coordinates and initial
expanded indices seed state; they are not controlled current-position/current-
selection bindings. The default slot contains ordered items. There are no
parent methods.

Five parent events: `mdToggle {index, expanded, expandedIndices}`,
`mdReorder {from,to,order}`, and `mdDragStart`, `mdDragMove`, `mdDragEnd`, each
with `{clientX,clientY,x,y,dx,dy}`. Reorder `order` uses original item identities,
not the immediately previous display indices. Newly inserted identities join
that original-order mapping. Toggle detail carries the final expanded-index
set. Consumers should distinguish parent events from bubbled nested instances.

An item has10 properties: headline, supportingText, icon, expanded, disabled,
headingLevel, collapsible, regionRole, contentMaxHeight and density.
Defaults are empty text/icon, false expanded/disabled, heading3, collapsible
true, region role, empty height cap and density0. Parent orchestration controls
heading, region and collapsibility while owned. Original authored values are
restored when ownership ends, including transfer followed by removal.

Four item slots: default body, headline, leading-icon and trailing-icon.
Authored slots replace fallback text/icons; only direct named children count.
Dynamic addition/removal/reassignment is supported. The leading fallback is a
Material Symbol. The trailing fallback is the disclosure chevron. Native
content builders must preserve authored content, handlers and semantics.

Item methods are asynchronous `toggle()` and `focusHeader()`; toggle respects
both disabled and locked-open state. Item events are
`mdItemToggle {expanded,index}`, `mdItemRequestFocus {direction,from}` and
`mdItemRequestReorder {direction,from}`. The latter two implement parent
coordination but are declared events, so their meaning must be retained or
explicitly documented in native APIs.

## Layout and appearance

Filled groups use separate tonal tiles with a vertical gap. Outlined groups
use one1px rounded chassis and1px separators except after the last item;
child surfaces are square and do not add elevation. Default filled tile
corners are12px collapsed and16px expanded. Default elevation is0; filled
expanded tiles use the next level for requested levels1–4, capped at5.
The default outlined chassis radius is max(8,12+density).

Header minimum height is64+4*density, down to48 at−4. Block padding is
max(4,16+2*density); inline padding is max(12,24+2*density). Supporting text,
icons and authored content may make a header taller. Headline and supporting
text ellipsize on one line; they do not wrap. Header typography starts at
Roboto500,16/24. Supporting text starts at Roboto400,12/16,tracking.4.
Body text starts at Roboto400,14/20; body padding is max(8,20+2*density) by
max(12,24+2*density). Explicit item density wins over inherited parent density.

The reference uses400px groups with two items. At density0, filled closed
height is136, filled open256; outlined closed131 and open251. At density−4,
these are100,180,99 and179. The filled gap uses density-sensitive system
spacing tokens; a raw inherited density scale can differ from a local density
attribute because the latter also rebinds spacing tokens.

The content cap applies to the body's content box: a70px cap plus default
20px block padding on each side occupies110px. It becomes overflow:auto and
keyboard-focusable. Hidden/collapsed content is inert and aria-hidden while
remaining mounted; native disclosure must preserve equivalent state and
remove hidden descendants from accessibility and interaction.

The parent declares14 appearance hooks: gap, outline color, chassis shape,
elevation; floating width/background/resting and active elevation/radius;
drop-placeholder fill/outline color/outline width/shape/opacity.
Its public part is drop-placeholder.

The item declares24 hooks: normal/expanded/dragging surface color and shape;
normal/expanded header, headline and icon colors; supporting color;
normal/expanded state-layer color; header/content padding and header minimum
height; expand/collapse duration; resting/expanded elevation; chassis grip
color and hover background. Thirteen parts expose chassis-handle,
chassis-handle-bar, heading, header, state-layer, drag-handle, leading-icon,
headline, supporting-text, trailing-icon, panel, content and content-inner.
All meaningful native equivalents are required; literal CSS selectors are
Web syntax, not grounds to omit their styling capability.

## Interaction and lifecycle

Exclusive mode permits at most one expanded item. keepOneExpanded opens the
first enabled item when necessary, locks the sole open item, and advertises
aria-disabled while leaving its header focusable. Explicitly disabled items
use a disabled button and are skipped by Arrow navigation. ArrowUp/Down wrap;
Home/End target first/last enabled item. Enter/Space activate. Nested groups
keep their own focus, selection, reorder and presentation state.

Reordering works through a leading drag handle and Alt+ArrowUp/Down. Disabled
items cannot initiate movement. The active item lifts, other items shift and
a dashed placeholder follows the target. Pointer cancel abandons a reorder;
unrelated pointers cannot move or finish it. Disabling reorder or disconnecting
cancels active listeners/capture. Dynamic membership reindexes items, updates
region policy and the first-item floating grip, and enforces selection policy.

Floating groups leave document flow and use a viewport overlay. Default width
is360px and initial offset24/24, both physical from top-left even in RTL.
The first item owns the chassis grip. Dragging changes current x/y without
clamping and optionally brings the group to front. Native APIs need a defined
logical viewport/overlay scope and coordinate conversion; physical Web pixels
map to points/dp, not device pixels. A transformed browser ancestor creates a
local fixed containing block; the oracle uses one to keep fixtures isolated.

Ownership presentation now exists before first child paint. It does not
animate a newly mounted outlined item from standalone filled corners. Direct
owner attributes replace ancestor-context selectors, preventing outer group
styles from leaking into nested groups and avoiding that selector dependency.
Temporary orchestration is released on detach/transfer; a delayed old-owner
slot notification cannot overwrite the new owner.

## Motion

Expressive uses emphasized height and corner timing,350ms open/250ms close,
with a spatial spring for chevron rotation and leading-icon scale. The icon
font changes FILL/weight. Surface colors, opacity and elevation use bounded,
shorter effects. Content remains in place rather than translating from a
corner. Standard removes spatial overshoot. Fade uses300ms open/200ms close.
Collapse uses300ms height-only motion with ease-out opening/ease-in closing.
None removes transitions. Public expand/collapse duration overrides apply
while color/opacity effects remain capped at200ms. Reduced motion removes
animations; forced colors uses system outlines and suppresses state layers.
OS preferences have not been executed in this browser checkpoint.

The browser matrix records100 samples: five presets × two variants × opening/
closing × five fractions. Every CSS transition is paused at a fraction of its
own duration. These are per-transition curves, not synchronized elapsed-time
frames; native timing validation must also check the independently recorded
actual durations.

## Evidence and remaining work

Five focused source suites pass225 tests. The browser validator passes25,146
assertions over130 configurations,100 transition samples and9 lifecycle scenarios.
The source matrix has65 configurations per light/dark theme, lifecycle and
initial-paint scenarios, actual CSS transitions, geometry, semantic attributes
and part styles. The current oracle loads font definitions only and unmodified
library tokens. Earlier captures affected by Laboratory palette overrides are
preserved under `before-font-isolation`; their palette is not the default.
Pre-fix lifecycle failures are preserved under `before-source-fixes`.

The dedicated native parent/item renderers, public APIs, callbacks, builder
slots, drag/reorder/overlay behavior, appearance and part equivalents,
right-panel controls, examples, native inspector, actual native accessibility,
Laboratory QA and separate final native audit remain required. macOS SwiftUI
verification cannot be reported as iOS runtime verification.
