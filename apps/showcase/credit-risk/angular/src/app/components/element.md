# Binding to the `md-*` elements from Angular

Two rules, and the second one is the whole reason this build's prerender carries
real content.

## Custom events need nothing

`(mdSortChange)="onSort($event)"` works exactly as written. Angular's event
binding calls `addEventListener` with the name as given, so the library's
camelCase `md*` events are picked up with no wrapper, no directive and no
mapping. This is the one place Angular is straightforwardly better at this than
React (which only maps known DOM events) and Vue (whose `@mdSortChange`
hyphenates to `md-sort-change` and silently listens for an event that is never
emitted).

## Strings and numbers must be ATTRIBUTE bindings

`[attr.label]="x"`, not `[label]="x"`.

Angular's property binding compiles to `element.label = x`. In the browser that
is fine — Stencil's lazy proxy keeps own properties set before an element
upgrades. During the **prerender** it is not: the server renderer sets a
JavaScript property on a DOM node that is then serialised to HTML, and a
property that was never an attribute does not appear in the output. Every
`md-chip`, every `md-table-cell`, every meter would prerender as an empty tag,
and the static HTML — the thing this build emits — would carry no content at
all.

`[attr.…]` calls `setAttribute` in both renderers, so the value is in the
emitted HTML and Stencil parses it back on upgrade. Booleans go out as
`"true"` / `"false"`, which Stencil's attribute parser reads correctly; for
attributes whose mere presence is the signal, bind `''` or `null`:

```html
<md-table-cell head [attr.numeric]="isNumeric ? '' : null">
```

## Object props are the exception

`series`, `nodes`, `data` and `valueFormatter` have no attribute form at all, so
they stay property bindings — `[series]="series"`. They cannot prerender either
way, and that is a limit of canvas charts rather than of this binding choice:
the plot cannot be painted without a canvas context. The chart's frame — its
heading, subtitle and accessible name — is attribute-bound and does prerender.
