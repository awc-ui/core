# @awc-ui/showcase-kit

Framework-free data, i18n, control dock and preboot script for the AWC UI showcase verticals.

The kit exists so that **seven framework builds of the same app render byte-identical output** —
whether that render happens at build time, in the browser, or on a server per request.
Every number, date and string comes from here; the apps only decide how to lay them out.

- **No dependencies, no framework — and one runtime requirement, in one place.**
  `package.json` declares no runtime dependencies, and no module here imports
  `@awc-ui/core`, a framework, or `@material/material-color-utilities`.
  `./data`, `./i18n` and `./preboot` are self-contained: they need nothing but
  the platform, on a server or in a browser, with no component library present.
  **`./dock` is the exception.** `<awc-showcase-dock>` builds its controls out of
  `md-select`, `md-segmented-button-set`, `md-switch`, `md-button` and
  `md-icon-button`, so the page it renders on must have the `@awc-ui/core`
  runtime registered (and Material Symbols loaded, for the icons). It reaches
  them by tag name rather than by import — which is why the package still ships
  no dependency — but the requirement is real, not a technicality: with no
  runtime on the page the bar renders its labels and empty space where the
  controls should be. See [`./dock`](#dock--awc-showcase-dock).
- **Deterministic by construction.** No `Date.now()`, no `Math.random()`, no ambient time zone.
  The reporting date is frozen at **2026-03-31**; every relative date derives from it.
  The fixture is generated once by a seeded PRNG and baked into `src/data/generated.ts`.
- **Every visible string is a dictionary key**, including the dock's own controls.

```bash
pnpm --filter @awc-ui/showcase-kit build
node packages/showcase-kit/scripts/verify.mjs   # 127 round-trip assertions
```

---

## Entry points

| Specifier | Contents | Safe on the server | Needs `@awc-ui/core` on the page |
|---|---|---|---|
| `@awc-ui/showcase-kit/data` | The credit-risk fixture and its pure selectors | yes | no |
| `@awc-ui/showcase-kit/i18n` | Dictionaries, translator, Intl formatters | yes | no |
| `@awc-ui/showcase-kit/dock` | `<awc-showcase-dock>` + the state store | importable, but has a client side effect | **the element does**; the state functions do not |
| `@awc-ui/showcase-kit/preboot` | The inline `<head>` script, as a string | yes | no |
| `@awc-ui/showcase-kit/preboot.js` | The same script as a raw `.js` file | — | no |
| `@awc-ui/showcase-kit` | Barrel: `data` + `i18n` + `preboot` + the dock **state** (not the element) | yes | no |

Import the subpaths. The root barrel deliberately omits the custom element so a
server bundle can never pull DOM code in.

---

## `./data` — the credit-risk fixture

**Product:** Aurelia Bank — Credit Risk Console. Wholesale portfolio at 2026-03-31.

```
PortfolioTotals   1     EAD €3.18bn · EL €83.9m · RWA €3.49bn · wPD 4.91% · util 80.9%
Sector            7     real-estate, manufacturing, energy, retail-trade, technology,
                        healthcare, transport
RatingGrade      10     grades 1..10 → AAA AA A BBB BB B CCC CC C D, PD 0.03% .. 100%
Counterparty     24     7 watchlisted, 4 corporate groups, 10 countries
Facility         61     term-loan / revolving-credit / trade-finance / guarantee
                        in EUR, USD, GBP, RON, AED
Covenant        127     DSCR / net-leverage / interest-cover; 21 breached, 29 on watch
Collateral       48     on the 33 secured facilities; €1.89bn net of haircuts
RatingObservation 192    8 quarters per counterparty, 2024-Q2 .. 2026-Q1
WatchlistSignal  16     7 signal types × high/medium/low severity
StressScenario    3     baseline / adverse (PD ×1.85, LGD +0.06) / severe (PD ×3.4, LGD +0.14)
```

### Selectors

All synchronous, pure, and free of side effects. List selectors return a fresh
array each call; the records inside are shared — treat them as read-only.

```ts
import {
  getPortfolioTotals, getSectors, getSectorById,
  getCounterparties, getCounterpartyById,
  getFacilitiesFor, getFacilityById, getFacilities,
  getCovenantsFor, getCovenants,
  getCollateralFor,
  getRatingHistory, getRatingScale, getRatingGrade,
  getWatchlist, getWatchlistCounterparties,
  getGroups, getGroupTree,
  getStressScenarios, getStressScenarioById,
  getFixture, getFxRates,
  REPORTING_DATE, REPORTING_QUARTER, BASE_CURRENCY,
} from '@awc-ui/showcase-kit/data';
```

| Function | Returns |
|---|---|
| `getPortfolioTotals()` | `PortfolioTotals` — equals the sum of the counterparty rows, exactly |
| `getSectors()` | `Sector[]` (7, fixed order) |
| `getSectorById(id)` | `Sector \| undefined` |
| `getCounterparties(filter?)` | `Counterparty[]`, default sort EAD descending |
| `getCounterpartyById(id)` | `Counterparty \| undefined` |
| `getFacilitiesFor(counterpartyId)` | `Facility[]`, EAD descending |
| `getFacilityById(id)` | `Facility \| undefined` |
| `getFacilities()` | every `Facility`, EAD descending |
| `getCovenantsFor(facilityId)` | `Covenant[]`, worst headroom first |
| `getCovenants()` | every `Covenant`, worst headroom first |
| `getCollateralFor(facilityId)` | `Collateral[]`, highest net value first (empty when unsecured) |
| `getRatingHistory(counterpartyId)` | `RatingObservation[]`, 8 entries oldest→newest |
| `getRatingScale()` / `getRatingGrade(n)` | the 10-rung internal scale |
| `getWatchlist()` | `WatchlistSignal[]`, high severity first then largest EAD |
| `getWatchlistCounterparties()` | the 7 obligors carrying a signal |
| `getGroups()` / `getGroupTree(groupId)` | `Group[]` / `GroupTree \| null` with rolled-up totals |
| `getStressScenarios()` | `StressScenario[]` — baseline, adverse, severe, in that order |

`CounterpartyFilter`:

```ts
{
  sectorId?, country?, watchlist?, groupId?,
  minGrade?, maxGrade?,          // inclusive 1..10
  search?,                       // case-insensitive, legalName + id
  sortBy?: 'legalName' | 'ead' | 'pd' | 'expectedLoss' | 'rwa' | 'utilisation' | 'grade',
  sortDir?: 'asc' | 'desc',      // defaults: desc for numbers, asc for legalName
  offset?, limit?,
}
```

### Conventions that matter

- **Every ratio is a fraction, not a percentage.** `pd: 0.0135` means 1.35%.
  Pass it straight to `formatPercent`.
- **Every money field is EUR** except `Facility.commitment / drawn / undrawn` and
  `Collateral.valuation`, which are in the record's own `currency`. The `…Eur`
  twins carry the converted value; `Facility.ead` and `Collateral.netValue` are
  always EUR.
- **Every date is an ISO `YYYY-MM-DD` calendar date.** Format it with
  `formatDate`, never with `new Date(...).toLocaleDateString()`.
- **Enum-ish values carry a `…Key` twin** (`sector.nameKey`, `facility.typeKey`,
  `covenant.nameKey`, `signal.severityKey`, …) that resolves through the
  dictionary. Where there is no `…Key`, the key is composed from the value:
  `` `covenantStatus.${covenant.status}` ``, `` `facilityStatus.${facility.status}` ``,
  `` `country.${counterparty.country}` ``, `` `rating.${counterparty.ratingLabel}` ``.
- **Legal names and group names are proper nouns** and are never translated.
- `RWA` uses a simplified, monotone illustrative risk-weight function. It is not
  a Basel IRB implementation and is not meant to be read as one.

---

## `./i18n`

```ts
import {
  createTranslator, translate, interpolate,
  LOCALES, LOCALE_CODES, DEFAULT_LOCALE, getLocaleMeta, getDirection, isLocaleCode,
  DICTIONARIES, en, ro, ar,
  formatCurrency, formatNumber, formatPercent, formatDate, formatBps, formatRatio,
} from '@awc-ui/showcase-kit/i18n';
```

### `LOCALES`

| code | nativeName | englishName | dir | intlTag | defaultCurrency |
|---|---|---|---|---|---|
| `en` | English | English | `ltr` | `en-GB` | EUR |
| `ro` | Română | Romanian | `ltr` | `ro-RO` | EUR |
| `ar` | العربية | Arabic | `rtl` | `ar-AE` | AED |

### `createTranslator(locale)`

Returns a cached, immutable `Translator`:

```ts
const t = createTranslator('ro');

t.locale                      // 'ro'
t.meta                        // LocaleMeta
t.dir                         // 'ltr'
t.t('common.showing', { shown: 10, total: 24 })   // 'Se afișează 10 din 24'
t.has('covenant.dscr')        // true
t.formatCurrency(3178153000, { notation: 'compact' })
t.formatNumber(1234567)
t.formatPercent(0.0135)       // takes a FRACTION
t.formatDate('2026-03-31', 'long')
```

- `{placeholder}` interpolation only. No plural rules, no ICU, no async loading.
- An unknown key falls back to English, then to the key itself — a missing string
  shows on screen as `covenant.dscr`, never as blank space.
- An unknown locale falls back to `en`.
- A missing param leaves `{total}` visible, so gaps are obvious in review.

260 keys, identical in all three dictionaries (enforced by `tsc` and by `verify.mjs`).
Key families: `app.` `nav.` `screen.` `kpi.` `table.` `sector.` `facilityType.`
`facilityStatus.` `rating.` `ratingBand.` `covenant.` `covenantDirection.`
`covenantStatus.` `frequency.` `collateralType.` `valuationBasis.` `signal.`
`severity.` `scenario.` `country.` `empty.` `action.` `common.` `unit.` `dock.`

### Formatters

Every formatter takes an **explicit locale** and pins `timeZone: 'UTC'`. Never call
`Intl` directly in a showcase app — a build in Bucharest and a build in Dubai
would disagree about what day 2026-03-31 is.

```ts
formatCurrency(value, locale, { currency?, notation?, display?, minimumFractionDigits?, maximumFractionDigits? })
formatNumber(value, locale, { minimumFractionDigits?, maximumFractionDigits?, notation?, grouping?, signDisplay? })
formatPercent(fraction, locale, { minimumFractionDigits?, maximumFractionDigits?, signDisplay? })
formatDate(isoOrDate, locale, 'short' | 'medium' | 'long' | 'iso' | 'monthYear')
```

`formatDate(…, 'iso')` is a passthrough — use it for `<time datetime="…">`.

---

## `./dock` — `<awc-showcase-dock>`

One vanilla custom element, whose controls are `@awc-ui/core` components. It
dogfoods the library it is a remote control for: the pickers are `md-select`,
theme and density are `md-segmented-button-set`, the accent swatches and the
collapse chevron are `md-icon-button`, direction is `md-switch`, reset is
`md-button`. Everything around them is styled from `--md-sys-*` tokens, so the
bar themes and mirrors with the page.

### What the dock needs from the page

**The `@awc-ui/core` runtime must be registered**, and Material Symbols loaded
for the icons. Nothing here imports the library — custom elements resolve by tag
name, so this package still declares no dependency — but the elements have to
come from somewhere, and that somewhere is the host page. Every showcase build
already loads it. If it is missing, the dock still renders, still reads and
writes state, and still publishes its height; the controls are simply empty
boxes.

The gap between the dock upgrading and the runtime registering is handled rather
than avoided: `DOCK_STYLES` reserves the size of every control, so the bar is
already its final height while the controls are still empty, and
`--awc-dock-height` does not change when they fill in. Verified at 1280, 1024,
800 and 390px wide, with the runtime blocked and loaded.

The dock does **not** densify or mirror with the page, deliberately. Its
controls are pinned to their own density and its `dir` to `ltr`, for the same
reason its labels are frozen to English: it is the evaluator's remote control,
not part of the demo, and it should not become harder to operate as you
demonstrate compact, right-to-left Arabic. The one exception is the density set,
which renders at the rung it selects, as a preview of what that rung does.

```html
<awc-showcase-dock
  frameworks="html,react,vue,angular,svelte,astro"
  framework="react"
  base-path="/showcase/credit-risk"
></awc-showcase-dock>
```

```ts
import '@awc-ui/showcase-kit/dock';   // registers the element and applies state
```

The bare import is a side effect on purpose: it registers `<awc-showcase-dock>`
and stamps the persisted/URL state onto `<html>`. It is a no-op on the server.

### Attributes

| Attribute | Required | Default | Meaning |
|---|---|---|---|
| `frameworks` | yes | — | Comma-separated framework ids, in display order. The switcher hides itself if fewer than two. |
| `framework` | yes | first of `frameworks` | The id this build *is*. Also the path segment that gets swapped. |
| `base-path` | no | `''` | Path prefix before the framework segment, e.g. `/showcase/credit-risk`. Used only when the current segment is not found in the path. |
| `label` | no | `t('app.title')` | Text at the start of the bar. |
| `controls` | no | all | Comma-separated allow-list of clusters: `framework,language,theme,density,accent,direction,reset`. Order is fixed regardless of what you write. |
| `collapsed` | no | absent | Boolean. Present = panel hidden, toggle still visible. Reflected when the user clicks the chevron. |
| `position` | no | `bottom` | `bottom` or `top`. |

Known framework ids get a display name (`html`→HTML, `next`→Next.js,
`sveltekit`→SvelteKit, …); anything else is title-cased.

### Properties and methods

```ts
const dock = document.querySelector('awc-showcase-dock')!;

dock.state                       // ShowcaseState — a read-only snapshot
dock.setState({ theme: 'dark' }) // → ShowcaseState
dock.reset()                     // → ShowcaseState (defaults)
dock.urlForFramework('vue')      // → absolute URL with state carried in the query
```

### Events

Event name: **`awc-showcase-change`**, `detail: ShowcaseChangeDetail`.

```ts
interface ShowcaseChangeDetail {
  state: ShowcaseState;
  previous: ShowcaseState | null;
  changed: (keyof ShowcaseState)[];
  reason: 'init' | 'set' | 'system';
}
```

It is dispatched **twice over two different targets**, and you should pick one:

- on **`window`** — bubbling is irrelevant, fires for every change including ones
  made through the exported functions rather than the dock. **This is the one to
  use**, and the only one that fires with `reason: 'init'`.
- on **the element itself**, `bubbles: false, composed: false` — for framework
  templates that bind with `@awc-showcase-change` / `onAwcShowcaseChange`.
  Non-bubbling on purpose: a bubbling copy would reach a `window` listener twice.

In an app, prefer `subscribeShowcaseState` — it fires immediately with the current
state and returns an unsubscribe function, which is exactly the shape every
framework's effect hook wants:

```ts
import { subscribeShowcaseState } from '@awc-ui/showcase-kit/dock';

const stop = subscribeShowcaseState(({ state }) => render(state.locale));
```

### State

```ts
interface ShowcaseState {
  theme: 'light' | 'dark' | 'system';   // default 'system'
  locale: 'en' | 'ro' | 'ar';           // default 'en'
  dir: 'ltr' | 'rtl';                   // default: whatever the locale implies
  density: 0 | -1 | -2 | -3 | -4;       // default 0
  seed: 'default' | 'azure' | 'evergreen' | 'bronze';  // default 'default'
}
```

Changing `locale` re-derives `dir` unless `dir` is set in the same call. The RTL
toggle pins `dir` independently, so you can view English in RTL.

### Persistence

- **localStorage**, one key: `awc:showcase:v1`, holding the JSON above.
- **URL query**, five params: `theme`, `lang`, `dir`, `density`, `seed`, always
  written in that order.
- **The URL wins on load.** localStorage does not survive the port change of a
  framework jump in dev, so the state has to ride in the query string.
- Writes use `history.replaceState`, so the back button is not polluted.

### The `<html>` attribute contract

`applyShowcaseState` writes **only** these four, per `main-llm.md` §2.1/§4.3/§4.4/§4.5:

| Attribute | Written | Removed |
|---|---|---|
| `lang` | always (`en` / `ro` / `ar`) | never |
| `dir` | always (`ltr` / `rtl`) | never |
| `data-theme` | `"dark"` only | for light — **never written as `"light"`** |
| `data-density` | `"-1"`…`"-4"` | at rung 0 — **never written as `"0"`** |

`data-density="0"` is inert and would pin base values onto every element, so the
attribute is removed entirely at rung 0. `data-ripple` and `data-shape-morph`
are outside this kit's remit and are never touched.

The accent preset is applied as a `<style id="awc-showcase-seed">` appended to
`<head>` (after the token sheet, so it wins), containing the `:root` and
`[data-theme="dark"]` `--md-sys-color-*` overrides that `@awc-ui/theme`'s
`computeTheme` produced at build time. The `default` preset removes the element.

### Layout

The dock is `position: fixed` on the block-end edge, at
`z-index: var(--md-sys-z-index-tooltip, 1500)`, with `env(safe-area-inset-*)`
padding. The brand and the collapse chevron share the first row and the controls
take a row of their own — a fixed row count is what lets the bar reserve its own
height before its controls exist.

It does not trap focus: Tab walks the seventeen stops in order and leaves at the
end. Roles come from the components rather than from hand-written ARIA — the
theme and density clusters are real `radiogroup`s of `radio`s, direction is a
`switch`, the accent swatches are toggle buttons with `aria-pressed`, and the
chevron is a disclosure button with `aria-expanded`/`aria-controls` that
precedes the region it controls. Density rungs are labelled ("Default density",
"Rung -3"), not left as the bare numbers they display.

A state change rebuilds the bar, so the dock remembers which control the
keyboard was on and hands focus back afterwards — without it, arrowing along a
segmented group would drop focus to `<body>` on the first press.

`md-select` menus open away from the edge the dock is docked to (`placement` is
`top-start` at the bottom, `bottom-start` at the top), and `md-menu` flips and
clamps from there.

It publishes its own height as a CSS custom property on `<html>` — a *style*, not
one of the four contract attributes. Reserve room for it:

```css
body { padding-block-end: var(--awc-dock-height, 0px); }
```

### Exported state functions

Everything the element does is available without it:

```ts
import {
  getShowcaseState, setShowcaseState, resetShowcaseState, subscribeShowcaseState,
  readShowcaseState, readStateFromSearch, normalizeState,
  applyShowcaseState, applySeedPreset, resolveTheme, prefersDark,
  syncUrl, withShowcaseParams, toSearchParams, buildFrameworkUrl,
  STORAGE_KEY, URL_PARAMS, SHOWCASE_EVENT, DEFAULT_STATE,
  THEME_MODES, DENSITY_RUNGS, SEED_PRESETS, DEFAULT_SEED_PRESET,
  defineShowcaseDock, DOCK_TAG, DOCK_CONTROLS, AwcShowcaseDock,
} from '@awc-ui/showcase-kit/dock';
```

`buildFrameworkUrl(target, { current, basePath?, pathname?, origin?, state? })`
swaps the framework segment and appends the state params:

```
/showcase/credit-risk/react/counterparties  --('vue')-->  /showcase/credit-risk/vue/counterparties?theme=…&lang=…
```

If `current` is not present in the path (a dev server rooted at `/`), it falls
back to `${basePath}/${target}/`.

---

## `./preboot`

A 791-byte dependency-free IIFE. Inline it in `<head>`, before any stylesheet, so
the very first paint already has the right theme, density and direction.

```ts
import { PREBOOT_SCRIPT, prebootScriptTag, PREBOOT_SIZE } from '@awc-ui/showcase-kit/preboot';
```

```html
<head>
  <script>/* PREBOOT_SCRIPT, inlined verbatim */</script>
  <link rel="stylesheet" href="…tokens.css">
</head>
```

Framework recipes:

- **Astro / plain HTML** — `<script is:inline set:html={PREBOOT_SCRIPT} />`
- **Next** — a `<Script id="awc-preboot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: PREBOOT_SCRIPT }} />` in the root layout `<head>`
- **Nuxt** — `useHead({ script: [{ innerHTML: PREBOOT_SCRIPT, tagPosition: 'head' }] })`
- **SvelteKit** — interpolate into `%sveltekit.head%` in `app.html`
- **Angular** — inline into `index.html` at build time

It reads the same URL params and the same `awc:showcase:v1` key the dock writes,
and applies the same four-attribute contract. It deliberately does **not** apply
the accent preset — that is ~3 kB of CSS per seed. `@awc-ui/showcase-kit/dock`
injects that on import, still before the app renders its own markup.

`dist/preboot.js` ships the same bytes as a file, reachable at
`@awc-ui/showcase-kit/preboot.js`, for build steps that would rather copy than
interpolate. Loading it as an external `<head>` script reintroduces the
render-blocking round trip you were avoiding, so inline it if you can.

---

## Regenerating

```bash
pnpm --filter @awc-ui/showcase-kit generate:fixture   # seeded PRNG → src/data/generated.ts
pnpm --filter @awc-ui/theme build                     # required first
pnpm --filter @awc-ui/showcase-kit generate:seeds     # computeTheme → src/dock/seeds.generated.ts
pnpm --filter @awc-ui/showcase-kit build
```

Both generators are idempotent: re-running them produces byte-identical files.
Changing the fixture changes every screenshot in every framework, so treat
`generate:fixture` as a deliberate act.
