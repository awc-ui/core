---
'@awc-ui/core': patch
---

**md-menu:** an anchored menu now escapes an ancestor's `isolation: isolate`,
so a select, autocomplete or menu opened inside a table toolbar is no longer
painted over — and no longer dead to clicks.

`md-menu` positions its surface `fixed` and asserts `z-index:
var(--md-sys-z-index-popup, 1000)`. A z-index only ranks an element inside its
own stacking context, and `isolation: isolate` opens one — so any isolating
ancestor capped the menu at that ancestor's rung. Inside `md-table-toolbar` the
menu therefore lost to the `md-table` painted after it: the options rendered
behind the rows, and because hit-testing follows paint order, clicking an option
landed on a table cell and selected nothing. The control was not merely ugly, it
was inert.

While an anchored menu is open it now suspends `isolation` on every flat-tree
ancestor that has it, and restores every one on close, on disconnect, and after
the close animation. Suspensions are refcounted, so two menus sharing an ancestor
cannot un-isolate it early, and only the `isolation` declaration is written and
removed — other inline styles are untouched.

Only `isolation` is relaxed. Numeric z-indexes are deliberate ranks and are left
alone, so the `app-bar 100 < popup 1000 < tooltip 1500 < snackbar 2000` ladder
still holds. A consumer whose isolate must survive an open popup can pin it with
`isolation: isolate !important`.

This generalises the local workaround `md-navigation-rail` already shipped for
the same trap, and fixes it for `md-select`, `md-multi-select`,
`md-autocomplete`, `md-date-picker`'s menu path, `md-sub-menu-item` flyouts and
arbitrary consumer wrappers at the same time.

Known remaining gap: a popup inside a **sticky table header** is capped by that
row's deliberate `z-index: 2` rather than by isolation, and is not addressed
here.
