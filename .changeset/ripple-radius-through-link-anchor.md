---
'@awc-ui/core': patch
---

**md-navigation-rail-tab, md-button:** a ripple no longer goes square when the
control is a link.

`md-ripple` clips its wave with `border-radius: inherit`, and `inherit` walks the
PARENT chain. With no `href`, the ripple's parent is the host, so the wave picks
up the host's shape — a rail tab's expanded 9999px pill, a button's stadium — and
clips correctly. Give either component an `href` and it renders an `<a>` wrapper
between the host and the ripple. `border-radius` is not an inherited property, so
that anchor sat at the initial `0` and the ripple inherited `0` *through* it: a
square wave on a pill-shaped control.

`display: contents` on the rail tab's anchor is what made it easy to miss — the
element paints nothing and takes no space, so it looks like it cannot affect
rendering, but it still takes part in inheritance, which is its entire effect
here. Both anchors now re-inherit the radius, the same way `md-button__anchor`
already re-inherits `gap`.

Only reproducible in an app: both components' Storybook stories render without an
`href`, so no anchor exists and the ripple was always round there.

Measured on a rail tab with an `href`, expanded: ripple and its clip go from
`0px` to `9999px`, matching the host.
