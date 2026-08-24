# Binding to the `md-*` elements from Angular

Two rules. The second one would work either way in this build, and is kept
because of what it costs to break it — read the second half of that section
before changing it.

## Custom events need nothing

`(mdSortChange)="onSort($event)"` works exactly as written. Angular's event
binding calls `addEventListener` with the name as given, so the library's
camelCase `md*` events are picked up with no wrapper, no directive and no
mapping. This is the one place Angular is straightforwardly better at this than
React (which only maps known DOM events) and Vue (whose `@mdSortChange`
hyphenates to `md-sort-change` and silently listens for an event that is never
emitted).

## Strings and numbers are ATTRIBUTE bindings

`[attr.label]="x"`, not `[label]="x"`.

Angular's property binding compiles to `element.label = x`, and in a browser that
works: Stencil's lazy proxy keeps own properties that were set before an element
upgraded, and hands them to the component when it does. So in THIS build — which
renders nowhere but the browser — either spelling would put the right thing on
the screen. Two reasons it is still the attribute form everywhere:

1. **The server-rendered twin shares this source.** `../../../angular-ssr/`
   holds the same components, and there the distinction decides whether the
   document carries any content at all: Angular's server renderer sets a
   JavaScript property on a node that is then serialised to HTML, and a property
   that was never an attribute does not appear in the output. Every `md-chip`,
   every `md-table-cell`, every meter would go out empty, and the declarative
   shadow DOM pass — which can only paint what the markup already says — would
   have nothing to paint. The pair is supposed to differ in WHERE the first
   render happens and in nothing else, so the binding style does not fork.

2. **The parity check reads attributes.** `scripts/verify-showcase-parity.mjs`
   fingerprints every `md-*` element by tag plus a hand-picked list of
   attributes (`label`, `value`, `variant`, `sort-by`, `row-count`, …) and
   compares the sequence against the reference build. A property that Stencil
   does not reflect back is invisible to `getAttribute`, so switching to
   property bindings would empty out the fingerprint and fail the comparison on
   every screen — while the page still looked right.

`[attr.…]` calls `setAttribute`, so the value is in the DOM and Stencil parses it
back on upgrade. Booleans go out as `"true"` / `"false"`, which Stencil's
attribute parser reads correctly; for attributes whose mere presence is the
signal, bind `''` or `null`:

```html
<md-table-cell head [attr.numeric]="isNumeric ? '' : null">
```

## Object props are the exception

`series`, `nodes`, `data` and `valueFormatter` have no attribute form at all, so
they stay property bindings — `[series]="series"`. Being property bindings, they
are dirty-checked by REFERENCE, which is why `ShowcaseComponent.memo()` exists:
an object literal written inline in a template is a fresh object on every
change-detection pass, and a chart handed a fresh `series` redraws its plot.
