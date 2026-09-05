# Binding to the `md-*` elements from Angular

The house rules, carried over from the credit-risk Angular build, plus the
wealth-specific traps the React reference build documents. Read this before
porting a screen.

## Custom events need nothing

`(mdSortChange)="onSort($event)"` works exactly as written. Angular's event
binding calls `addEventListener` with the name as given, so the library's
camelCase `md*` events are picked up with no wrapper, no directive and no
mapping. This is the one place Angular is straightforwardly better at this than
React (which only maps known DOM events) and Vue (whose `@mdSortChange`
hyphenates to `md-sort-change` and silently listens for an event that is never
emitted). Read the payload as `(event as CustomEvent<T>).detail`.

The ONE exception is the capture phase: `md-navigation-tab` reads
`event.defaultPrevented` before it acts, and Angular templates cannot attach a
capture-phase listener — see `bar.component.ts` for the `ngAfterViewInit`
pattern. Nothing else in this app needs it.

## Strings and numbers are ATTRIBUTE bindings

`[attr.label]="x"`, not `[label]="x"`.

Angular's property binding compiles to `element.label = x`, and in a browser
that works: Stencil's lazy proxy keeps own properties that were set before an
element upgraded, and hands them to the component when it does. So in this
build — which renders nowhere but the browser — either spelling would put the
right thing on the screen. It is still the attribute form everywhere because
**the parity check reads attributes**: `scripts/verify-showcase-parity.mjs`
fingerprints every `md-*` element by tag plus a hand-picked list of attributes
and compares the sequence against the React reference build. A property that
Stencil does not reflect back is invisible to `getAttribute`, so property
bindings would empty out the fingerprint and fail the comparison on every
screen — while the page still looked right. (Wealth has no server-rendered
Angular twin, so the SSR serialisation reason the credit-risk build also cites
does not apply here; the parity reason alone decides it.)

`[attr.…]` calls `setAttribute`, so the value is in the DOM and Stencil parses
it back on upgrade.

## Booleans: never write `"false"`

For attributes whose mere presence is the signal — `disabled` on a
form-associated element above all — bind `''` or `null`, never a boolean:

```html
<md-table-cell head [attr.numeric]="isNumeric ? '' : null">
```

`disabled="false"` is a disabled button that looks enabled: the platform
disables on presence, regardless of value. The React build's `flag()` helper
exists for the same reason; in Angular the `cond ? '' : null` idiom IS that
helper.

## Object props are the exception

`series`, `data`, `nodes`, `items`, `value` on `md-multi-select` /
`md-transfer-list` / `md-autocomplete`, `getLabel` on `md-rating`, and every
`valueFormatter` have no attribute form at all, so they stay property
bindings — `[series]="series"`. Being property bindings, they are dirty-checked
by REFERENCE, which is why `ShowcaseComponent.memo()` exists: an object literal
built inline is a fresh object on every change-detection pass, and a chart
handed a fresh `series` redraws its plot. Build them in `memo('key', () => …)`
— keyed per locale, because `valueFormatter` closes over the translator and
must be re-created when the language changes.

`md-pie-chart` takes `data`, NOT `series` — the one member of the chart family
with a different shape.

## Wealth-specific traps (from the React reference, `Shell.tsx`/screens)

- **Never toggle the `class` attribute on a custom element.** Replacing the
  class list wipes Stencil's `hydrated` flag and the element goes
  `visibility: hidden` permanently. A CHANGING selected state rides on a
  `data-*` attribute (`[attr.data-selected]`); a constant `class="…"` is safe.
- **Element ids are literals, unique per document.** `md-menu` resolves its
  `anchor` with `getElementById`; render a screen's content once, never twice.
- **Popups (`md-menu`, `md-search`'s panel) never inside `md-card`;** never
  render `md-menu` open in initial markup; one snackbar per screen with
  `class="wealth-snackbar"`; one dialog max, never nested (the date/time
  pickers are modals themselves).
- **Uncontrolled fields stay uncontrolled.** `md-text-field` / `md-search` /
  `md-number-field` own their value; never bind the value back each pass —
  clear them imperatively via `@ViewChild` (`element.value = ''`), which is
  also the credit-risk reset idiom.
- **`mdClose` neither bubbles nor composes** (menus, snackbars): listen on the
  element itself and mirror the open state back into your own state.
- **`md-events over native`** where soft-disabled paths matter: `(mdClick)`
  instead of `(click)` on buttons that preventDefault without stopping
  propagation.
- Rows and totals come from kit selectors; the only tolerated local arithmetic
  is the flagged set in the proposals/planning screens. No `Date.now()`
  anywhere — `REPORTING_DATE` is "today". Fixed timing constants only
  (550/900/160/20).
