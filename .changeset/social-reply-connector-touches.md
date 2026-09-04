---
'@awc-ui/showcase-kit': patch
---

**social:** the reply connector now meets both avatars instead of stopping 4px
clear of each. Symmetric gaps measured correctly and still read as a mark
sitting near two circles rather than as one stroke joining them. Ending exactly
on the rim is not enough either — an avatar is a circle, so the stroke meets it
at a single tangent point and a fractional device-pixel ratio leaves a hairline
showing. It now runs 2px under each rim with the avatar painting over the
overlap, which joins cleanly at any zoom and DPR.

The stroke is also centred on each avatar's centre line, which it was not: a
stroke has width, so an offset naming where it STARTS puts its centre half a
stroke further on — the vertical hung a pixel right of the circle above it, and
the horizontal, being a border and therefore inside its box, ran a pixel above
the circle it pointed at. The two errors pointed opposite ways, which is what
made the shape read as lopsided rather than simply misplaced.

Also removes a superseded duplicate of the connector's rules that had been left
above the live ones.
