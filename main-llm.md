# main-llm.md — AWC UI build director

<!-- llm:meta
role: director
audience: llm
library: "@awc-ui/core"
component-count: 57
sub-component-count: 24
manual-count: 81
per-component-docs: ./packages/core/src/components/<tag>/readme.md
-->

**You are building a web app with AWC UI, a Material Design 3 web-component
library.** This file is the entry point and the only document you need before
writing UI code. Everything here is self-contained: tokens, recipes,
composition rules and the ship checklist. Per-component detail lives in
`./packages/core/src/components/<tag>/readme.md` — e.g.
[`md-button`](./packages/core/src/components/md-button/readme.md).

Your job, in order:

1. **Interview** the user (§1). Do not skip it and do not guess.
2. **Lock the configuration** their answers imply (§2) and bootstrap it (§3–§4).
3. **Route every UI need through the decision matrix** (§5) — never pick a
   component by name-similarity.
4. **Load the component's readme.md before writing a single line of its
   markup** (§6). The file is
   `./packages/core/src/components/<tag>/readme.md` — read it in full, do not
   skim it, and do not write the markup from memory of a similar library. Each
   one has a `When NOT to use`, a `Do / Don't` table sourced from
   [m3.material.io](https://m3.material.io), and an `Anti-patterns` table of
   mistakes models actually make. If you are about to use three components,
   load all three readmes first.
5. **Check what nests inside what** (§7) and start from a recipe (§8) rather
   than from a blank page.
6. **Apply the universal rules** (§9) — the API, content and accessibility
   rules every component is bound by, and the ones §10 checks you against.
7. **Run the ship checklist** (§10) before declaring done.

**Fail closed.** If you cannot satisfy a step — no component fits, a token
doesn't exist, an accessible name has nowhere to come from — say so and ask.
Do not invent an `md-*` tag, a prop, or a token. If it is not in this file or
in the component's manual, it does not exist.

---

## §1 — Interview the user

Ask these **one at a time**, in this order. Each answer closes off decisions
downstream, so don't batch them into a wall of questions. Skip a question only
if the user has already answered it unprompted.

If the user says "just pick sensible defaults", use the **bold** option and tell
them what you chose.

### 1.1 Scope and shape

1. **What is the app?** One or two sentences — domain, primary job, who uses it.
2. **What kind of surface is it?**
   - Internal tool / admin console / dashboard
   - Data-heavy CRUD application
   - Consumer-facing product
   - Marketing or content site
   - Mobile-first / PWA
3. **Which framework?** React · Angular · Vue · Svelte · **plain HTML** ·
   Next · Nuxt · SvelteKit · Astro
4. **Does it server-render?** (SSR/SSG, or **client-only SPA**)
5. **Roughly how many distinct screens**, and what are the top 3?

### 1.2 Look and feel

6. **Density** — how much information per screen?
   - `0` — **default**, comfortable, touch-friendly
   - `-1` / `-2` — compact; typical for admin consoles
   - `-3` / `-4` — ultra-compact; dense data tables, trading/ops screens
7. **Theme** — light only, dark only, or **both with a user toggle**?
   Does it follow the OS preference?
8. **Brand color** — a seed/primary color, or **stock MD3 palette**?
9. **Expressive motion** — keep **ripple and shape-morph on** (default), or turn
   them off for a flatter, more utilitarian feel?
10. **Shape language** — **rounded** (MD3 default) or squared?

### 1.3 Internationalization

11. **How many locales**, and which?
12. **Any RTL locales** (Arabic, Hebrew, Farsi, Urdu)? — this changes layout
    verification and directional-icon handling.
13. **Which i18n engine?** (i18next, vue-i18n, ngx-translate, Paraglide, custom)
    Components are engine-agnostic — you localize in the consumer layer.
14. **Locale-formatted values** — dates, numbers, currency? Which locale drives
    `Intl`?

### 1.4 Data and forms

15. **Is there significant tabular data?** How many rows, and is it
    server-paged? (Drives how you page `md-table` — it holds the state, you
    supply each page of rows.)
16. **Are there charts?** Which questions should they answer?
17. **How heavy are the forms?** Validation rules, async validation, multi-step?
18. **Rich text editing anywhere?** — ⚠️ **AWC UI has no RTE component.** If yes,
    you must integrate a third-party editor (TipTap, Lexical, Quill) and style
    it to the MD3 tokens yourself. Confirm this with the user explicitly.

### 1.5 Constraints

19. **Accessibility target** — **WCAG 2.1 AA** (what the library is tested to),
    or stricter?
20. **Browser/device support floor?**
21. **Anything already decided** you must not change — existing design system,
    router, state library, CSS approach?

---

## §2 — Map answers to configuration

| Answer | What you set |
|---|---|
| Admin console / data-heavy | `data-density="-1"` or `-2` on `<html>`; prefer `size="xs"`/`"sm"` on actions |
| Consumer / marketing | leave density alone (`0` is the default); larger button sizes (`md`/`lg`) for CTAs |
| Mobile-first | `md-navigation-bar` + `md-fab`; avoid `md-navigation-rail`, `md-transfer-list`, wide tables |
| Desktop-first | `md-navigation-rail` or `md-app-bar`; rail over bottom bar |
| Dark mode | `data-theme="dark"` on `<html>`; wire a toggle, and mirror OS via `prefers-color-scheme` |
| Both themes with toggle | persist the choice; set the attribute before first paint to avoid a flash |
| Brand color | override the `--md-sys-color-*` roles in your own stylesheet, loaded after the tokens (§4.2) |
| Flat / utilitarian | `data-ripple="off"` and `data-shape-morph="off"` on `<html>` |
| Any RTL locale | `dir="rtl"` on `<html>`; add `mirror-icon` to `md-button`s with directional glyphs; swap the glyph name yourself everywhere else (§4.5) |
| Multiple locales | build a dictionary in the consumer layer and feed component text props from it; never hardcode strings in markup |
| `Intl`-formatted values | pass a `locale` prop where a component exposes one; format everything else before it reaches the component |
| SSR | import from `@awc-ui/core/hydrate` on the server; use the client/server wrappers in `@awc-ui/react` |
| Heavy forms | components are form-associated via `ElementInternals` — use a real `<form>`, `md-button type="submit"`, and native `required` (§4.7) |
| Rich text | integrate a third-party editor; there is no `md-rich-text` |

### 2.1 Global switches — the complete set

All are attributes on `<html>` (or any ancestor; the nearest one wins).

```html
<html
  lang="en"
  dir="ltr"                  <!-- or rtl -->
  data-theme="dark"          <!-- omit for light -->
  data-density="-1"          <!-- -1 … -4; see below -->
  data-ripple="off"          <!-- default on -->
  data-shape-morph="off"     <!-- default on -->
>
```

**`data-density="0"` is inert.** No `[density="0"]` rule exists — density `0` is
simply the base values on `:root`, and a `0` rule would pin them onto every
element (reflected props write `density="0"` almost everywhere) and break global
inheritance. So the *overriding* range is `-1 … -4`. To escape an inherited rung
for one subtree, reset the scale directly:

```css
.opt-out-of-density { --md-sys-density-scale: 0; }
```

Per-component overrides beat the global one: a `density` prop, or
`ripple="off"` / `shape-morph="off"` on the element. **53 of the 57 top-level
components expose a `density` prop.** The four that don't: `md-divider`,
`md-ripple`, `md-sparkline`, `md-tabs`. (Nine sub-components also lack one —
they inherit density from the parent that owns their layout.)

---

## §3 — Install and bootstrap

```bash
npm install @awc-ui/core
```

**Register everything (recommended).** Two imports, once per app entry — one
defines every component, one loads the tokens. Both come from `@awc-ui/core`
itself, so this path needs no second package:

```ts
import { defineCustomElements } from '@awc-ui/core/loader';
import '@awc-ui/core/css/tokens.css';

defineCustomElements(window);
```

`@awc-ui/core/css/tokens.css` is the complete, self-contained token sheet —
light and dark colour roles, shape, elevation, motion, typescale, spacing and
z-index. It is the same set documented in §4.1.

**One-line alternative.** `@awc-ui/core/define` does both steps in a single
import. It loads the package's own token sheet, so it needs nothing else
installed:

```ts
import '@awc-ui/core/define'; // defines every component + loads the token sheet
```

`define` is client-only (it eval-guards `window`) and, because it imports CSS,
it needs a bundler. Never import it into a server graph.

**Per-component registration**, for size-sensitive bundles — load the token
sheet once yourself:

```ts
import '@awc-ui/core/css/tokens.css';
import '@awc-ui/core/components/md-button';
import '@awc-ui/core/components/md-text-field';
```

**Framework wrappers** — use these instead of raw elements; they handle
registration, typed props, and event binding. Below the version floor, drop to
the raw custom elements and the `loader` import above.

| Framework | Package | Requires |
|---|---|---|
| React / Next | `@awc-ui/react` | React 18+ |
| Angular | `@awc-ui/angular` (`AwcUiModule`) | Angular 17+ |
| Vue / Nuxt | `@awc-ui/vue` | Vue 3 |
| Svelte / SvelteKit | `@awc-ui/svelte` | Svelte 4+ |
| Plain HTML / Astro | `@awc-ui/core/loader` | — |

**SSR** — `@awc-ui/core/hydrate` renders Declarative Shadow DOM on the server.
`@awc-ui/react` ships matching client/server wrappers. Keep `define` and
`loader` out of the server graph; both are browser entries.

**Fonts** — components expect Roboto and Material Symbols Outlined to be
available. The library does **not** inject them. Every `icon="…"` prop renders a
Material Symbols glyph inside shadow DOM, so the font must be registered at the
**document** level (font registration crosses shadow boundaries; class rules do
not — the components declare the class rule inside their own roots):

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap">
```

To swap the whole library to a different Material Symbols cut, set
`--md-sys-icon-font-family` on `:root` and load the matching `@font-face`.

---

## §4 — Global configuration reference

### 4.1 The token system

All AWC UI styling resolves to design tokens. **Never hardcode hex colours,
pixel radii, shadows, or font stacks** — they break theming, dark mode, density
and RTL in one stroke. Every value below is a real custom property defined by
`@awc-ui/tokens`; you may read them, and you may override them.

#### Color roles

Light is the default; `[data-theme="dark"]` swaps the palette. Every role has a
matching `on-` role for content drawn on top of it.

| Token | Light | Dark | Typical usage |
|---|---|---|---|
| `--md-sys-color-primary` | `#6750A4` | `#D0BCFF` | Filled buttons, active states |
| `--md-sys-color-on-primary` | `#FFFFFF` | `#381E72` | Text/icons on primary |
| `--md-sys-color-primary-container` | `#EADDFF` | `#4F378B` | FAB, selected segments |
| `--md-sys-color-on-primary-container` | `#21005D` | `#EADDFF` | Text on primary-container |
| `--md-sys-color-secondary` | `#625B71` | `#CCC2DC` | Secondary accents |
| `--md-sys-color-secondary-container` | `#E8DEF8` | `#4A4458` | Tonal buttons, chips |
| `--md-sys-color-tertiary` | `#7D5260` | `#EFB8C8` | Tertiary accents |
| `--md-sys-color-tertiary-container` | `#FFD8E4` | `#633B48` | Tertiary surfaces |
| `--md-sys-color-error` | `#B3261E` | `#F2B8B5` | Error / destructive |
| `--md-sys-color-on-error` | `#FFFFFF` | `#601410` | Content on error |
| `--md-sys-color-error-container` | `#F9DEDC` | `#8C1D18` | Error surfaces |
| `--md-sys-color-surface` | `#FFFBFE` | `#1C1B1F` | Page / card background |
| `--md-sys-color-on-surface` | `#1C1B1F` | `#E6E1E5` | Body text |
| `--md-sys-color-surface-variant` | `#E7E0EC` | `#49454F` | Muted fills |
| `--md-sys-color-on-surface-variant` | `#49454F` | `#CAC4D0` | Secondary text, icons |
| `--md-sys-color-surface-container-lowest` | `#FFFFFF` | `#0F0D13` | Lowest surface tier |
| `--md-sys-color-surface-container-low` | `#F7F2FA` | `#1D1B20` | Card / elevated button bg |
| `--md-sys-color-surface-container` | `#F3EDF7` | `#211F26` | Default container tier |
| `--md-sys-color-surface-container-high` | `#ECE6F0` | `#2B2930` | Dialog / menu surfaces |
| `--md-sys-color-surface-container-highest` | `#E6E0E9` | `#36343B` | Highest surface tier |
| `--md-sys-color-outline` | `#79747E` | `#938F99` | Borders (3:1 contrast) |
| `--md-sys-color-outline-variant` | `#CAC4D0` | `#49454F` | Dividers (low contrast) |
| `--md-sys-color-inverse-surface` | `#313033` | `#E6E1E5` | Snackbar, inverse chips |
| `--md-sys-color-inverse-on-surface` | `#F4EFF4` | `#313033` | Content on inverse-surface |
| `--md-sys-color-scrim` | `#000000` | `#000000` | Modal scrims |

**Semantic status roles** — beyond the baseline M3 palette, the library adds
`success`, `warning` and `info`, each with `on-`, `-container` and
`on-…-container` companions, in both themes, AA-verified. Used by `md-chip`,
`md-badge`, `md-meter`, `md-status-dot`.

| Token | Light | Dark |
|---|---|---|
| `--md-sys-color-success` | `#2E6B4F` | `#9DD5B0` |
| `--md-sys-color-success-container` | `#B8F0CE` | `#14512F` |
| `--md-sys-color-warning` | `#7A5900` | `#EFC148` |
| `--md-sys-color-warning-container` | `#FFDF9B` | `#5C4200` |
| `--md-sys-color-info` | `#38608F` | `#A2C9FE` |
| `--md-sys-color-info-container` | `#D3E4FF` | `#1E4975` |

#### Shape tokens

| Token | Value | Typical usage |
|---|---|---|
| `--md-sys-shape-corner-none` | `0px` | Square edges |
| `--md-sys-shape-corner-extra-small` | `4px` | Snackbar, small chips |
| `--md-sys-shape-corner-small` | `8px` | Cards (outlined), small surfaces |
| `--md-sys-shape-corner-medium` | `12px` | Cards (default), inputs |
| `--md-sys-shape-corner-large` | `16px` | Dialogs, large cards |
| `--md-sys-shape-corner-extra-large` | `28px` | Bottom sheets |
| `--md-sys-shape-corner-full` | `9999px` | Buttons, chips, FAB |

Partial-corner variants also exist for surfaces that meet an edge:
`--md-sys-shape-corner-extra-small-top`, `-large-top`, `-large-end`,
`-extra-large-top`. Their values are four-value `border-radius` shorthands
(e.g. `16px 16px 0px 0px`), so assign them to `border-radius`, not to a single
corner.

#### Elevation tokens

`-0` is the keyword `none`; `-1` through `-5` are complete `box-shadow` values,
and those five are **re-declared with deeper shadows under `[data-theme="dark"]`**
— so always use the token rather than copying its value.

| Token | When |
|---|---|
| `--md-sys-elevation-0` | `none` — resting cards, flat surfaces |
| `--md-sys-elevation-1` | Elevated buttons and cards at rest |
| `--md-sys-elevation-2` | Hover bump |
| `--md-sys-elevation-3` | FAB, menus, dialogs at rest |
| `--md-sys-elevation-4` – `-5` | Reserved for the most prominent surfaces |

#### Motion tokens

Durations come in four families of four: `short1…4` (50/100/150/200ms),
`medium1…4` (250/300/350/400ms), `long1…4` (450/500/550/600ms), and
`extra-long1…4` (700/800/900/1000ms).

| Token | Value | When |
|---|---|---|
| `--md-sys-motion-duration-short2` | `100ms` | Buttons, ripples, state layers |
| `--md-sys-motion-duration-medium2` | `300ms` | Dialogs, sheets, menus |
| `--md-sys-motion-duration-long2` | `500ms` | Large surface transitions |
| `--md-sys-motion-duration-extra-long1` | `700ms` | Ambient / chart entrances |
| `--md-sys-motion-easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Small utility transitions |
| `--md-sys-motion-easing-standard-accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | Exits |
| `--md-sys-motion-easing-standard-decelerate` | `cubic-bezier(0, 0, 0, 1)` | Entrances |
| `--md-sys-motion-easing-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Expressive transitions |
| `--md-sys-motion-easing-emphasized-accelerate` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Expressive exits |
| `--md-sys-motion-easing-emphasized-decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Expressive entrances |
| `--md-sys-motion-easing-linear` | `linear` | Progress, indeterminate loops |

> `--md-sys-motion-easing-emphasized` deliberately equals the standard curve:
> the full M3 emphasized curve is a two-phase path interpolator that CSS cannot
> express. The accelerate and decelerate halves *are* expressible, and are the
> ones to reach for.

MD3 Expressive also ships spring pairs, each an easing plus its natural
duration: `--md-sys-motion-spring-{spatial,effects}-{fast,default,slow}-easing`
and `…-duration`. Spatial = position/size/shape; effects = colour/opacity.

#### State-layer opacities

| Token | Value |
|---|---|
| `--md-sys-state-hover-state-layer-opacity` | `0.08` |
| `--md-sys-state-focus-state-layer-opacity` | `0.12` |
| `--md-sys-state-pressed-state-layer-opacity` | `0.12` |
| `--md-sys-state-dragged-state-layer-opacity` | `0.16` |
| `--md-sys-state-disabled-container-opacity` | `0.12` |
| `--md-sys-state-disabled-content-opacity` | `0.38` |

#### Typography, spacing and layering

- **Typescale** — `--md-sys-typescale-<role>-<size>-*` for
  `display`/`headline`/`title`/`label`/`body` × `large`/`medium`/`small`. Each
  role exposes `-font-family`, `-font-size`, `-line-height`, `-font-weight`,
  `-letter-spacing`, plus a `-font` shorthand
  (e.g. `--md-sys-typescale-headline-medium-font: 400 28px/36px Roboto, sans-serif`).
  Use the shorthand on the `font` property for headings you write yourself.
- **Spacing** — a 4dp scale that tightens with density:
  `--md-sys-spacing-inset-{xs,sm,md,lg,xl}` (internal padding, 4/8/12/16/24px)
  and `--md-sys-spacing-gap-{xs,sm,md,lg}` (between siblings, 4/8/12/16px), plus
  `--md-sys-spacing-row-height` (`56px` at density 0).
- **Layering** — `--md-sys-z-index-app-bar` (100), `-navigation` (200),
  `-bottom-sheet` (300), `-popup` (1000), `-dialog-scrim` (1001), `-tooltip`
  (1500), `-snackbar` (2000). Use these instead of inventing z-indexes, or your
  overlay will land under a menu.

### 4.2 Theming and rebranding

To rebrand, redefine the role variables **after** the tokens stylesheet — both
themes, or dark mode inherits your light brand colour:

```css
:root {
  --md-sys-color-primary: #00629E;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #CFE5FF;
  --md-sys-color-on-primary-container: #001D33;
}
[data-theme="dark"] {
  --md-sys-color-primary: #9BCBFF;
  --md-sys-color-on-primary: #003354;
  --md-sys-color-primary-container: #004A78;
  --md-sys-color-on-primary-container: #CFE5FF;
}
```

Per-component knobs are `--md-<component>-*` custom properties, listed in each
manual's Theming section (`--md-button-container-color`,
`--md-card-container-shape`, …). Prefer those over `::part()`, and prefer
`::part()` over reaching into shadow internals, which are unstable and will
break on any release.

**Overriding a colour role forfeits the library's contrast testing.** Re-verify
AA (4.5:1 text, 3:1 borders and dividers) after any palette change. The Theme
Generator at <https://awc-ui.dev/theme-generator> takes a seed colour, emits both
palettes as `--md-sys-color-*` overrides, and runs the WCAG checks live — use it
rather than hand-picking container and `on-` pairs.

### 4.3 Density

`data-density` steps `-1 → -4`; each rung trims ~4px of padding and touch
target, driving `--md-sys-density-scale` and the spacing tokens. `-4` is the
floor. Set it globally, override locally with the `density` prop. Do not go
below `-2` on touch-primary surfaces — you will break the 48px target.

Two details that bite:

- **`density="0"` does nothing** — see §2 for why, and for the
  `--md-sys-density-scale: 0` escape hatch.
- **`md-table` accepts two vocabularies**: the semantic `compact` / `standard` /
  `comfortable` (row heights 36 / 52 / 60px) *and* the numeric rungs. They
  compose — `density="compact"` inside a `data-density="-2"` region condenses
  further.

### 4.4 Dark mode

Set `data-theme="dark"` on `<html>` (or any ancestor — the nearest wins). The
tokens swap automatically and inherit across every shadow boundary; no
per-component code. To mirror the OS, read `prefers-color-scheme` and write the
attribute **before first paint**, or the page flashes light.

### 4.5 RTL

Layout is written with CSS logical properties, so it flips with `dir="rtl"`
without extra work. Two things still need you:

- **Directional glyphs do not flip.** Material Symbols are not auto-mirrored.
  `md-button` has a `mirror-icon` prop that mirrors its own leading/trailing
  glyph — set it on buttons using arrows, chevrons, `send`, `reply`, and leave
  it off for `add`, `search`, `favorite`. **`mirror-icon` exists only on
  `md-button`.** Everywhere else — `md-icon-button icon="…"`, `md-list-item`
  leading/trailing icons, `md-app-bar leading-icon` — swap the glyph name
  yourself (`arrow_back` ↔ `arrow_forward`).
- **Icon props you supply yourself** — e.g. `md-transfer-list`'s
  `move-right-icon` / `move-left-icon` / `move-all-*-icon` — must be swapped by
  you when the direction flips.

Never write physical CSS (`margin-left`, `padding-right`, `left`) around these
components. Use `margin-inline-start`, `padding-inline-end`, `inset-inline-end`.

### 4.6 Internationalization

Components are **i18n-engine-agnostic by design**. Every user-visible string is
either slotted content or a prop. Localize in the consumer layer: resolve your
dictionary to plain strings, then pass them in. Do not add a translation engine
inside a component. `locale` props exist only where a component computes an
`Intl`-formatted value itself: `md-date-picker`, `md-number-field`,
`md-meter`, `md-dialog`, and the charts (`md-bar-chart`, `md-line-chart`,
`md-area-chart`, `md-pie-chart`). `md-time-picker` has no
`locale` prop — it takes `format="12h" | "24h"` instead.

Templated strings keep their placeholder tokens when translated — translate
around the braces, don't remove them:

```html
<md-transfer-list count-template="{checked} / {total} ausgewählt"></md-transfer-list>
```

Other templated props: `md-autocomplete status-template`, `md-otp-field
cell-label-template`. Default prop values are English (`Search`, `Dismiss`,
`No results`, `Move selected to target`, …) — every one of them needs
translating in a localized app.

### 4.7 Forms and validation

Fourteen components are form-associated via `ElementInternals`, so they
participate in `FormData` and constraint validation like native controls:

`md-text-field` · `md-number-field` · `md-otp-field` · `md-select` ·
`md-multi-select` · `md-autocomplete` · `md-checkbox` · `md-radio` ·
`md-switch` · `md-slider` · `md-rating` · `md-date-picker` · `md-time-picker` ·
`md-button`

Rules:

- Use a real `<form>`. `md-button type="submit"` calls `form.requestSubmit()`
  (not `submit()`), so the `submit` event fires **and** built-in constraint
  validation runs. `required` genuinely blocks submit.
  `md-button type="reset"` calls `form.reset()`.
- Give every control a `name`, or it will not appear in `FormData`.
- Do **not** add hidden `<input>`s to mirror values — that's the old pattern and
  it double-submits.
- Validity changes are announced on a `mdValidityChange` event on the control.
  Error presentation is `error` + `error-text` on the field.
- Boolean state props differ by control — `md-checkbox` uses `checked`,
  `md-switch` uses **`selected`**, `md-select-option` uses `selected`. Check the
  manual; guessing `checked` on a switch silently does nothing.

---

## §5 — Component decision matrix

Route by **need**, not by name. If the need isn't listed, find the closest row
and read that component's `When NOT to use`.

### 5.1 Actions

| Need | Use | Don't use |
|---|---|---|
| Discrete labelled action | `md-button` | `md-chip`, raw `<button>` |
| Icon-only action | `md-icon-button` | `md-button` with no label |
| A destructive action | `md-button` + `md-dialog` to confirm | an unconfirmed `filled` button |
| The single most prominent screen action (mobile) | `md-fab` | a second `filled` `md-button` |
| One prominent action that expands to several | `md-fab-menu` + `md-fab-menu-item` | a stack of FABs |
| Primary action + variants of it | `md-split-button` | button + separate menu |
| 2–5 related actions as one unit | `md-button-group` | loose adjacent buttons |
| Mutually exclusive view/mode switch | `md-segmented-button-set` + `md-segmented-button` | radio buttons, tabs |
| Overflow / contextual actions | `md-menu` + `md-menu-item` | a row of text buttons |

### 5.2 Text input

| Need | Use | Don't use |
|---|---|---|
| Any single-line or multi-line text entry | `md-text-field` | raw `<input>` |
| A number with steppers and locale formatting | `md-number-field` | `md-text-field type="number"` |
| A one-time code / PIN | `md-otp-field` | a row of text fields |
| Text entry with suggestions | `md-autocomplete` | `md-select` |
| Site/app-wide search with a results surface | `md-search` | `md-text-field` with an icon |

### 5.3 Selection

| Need | Use | Don't use |
|---|---|---|
| One of many, from a list | `md-select` + `md-select-option` | radio group over ~7 options |
| One of few (2–5), all visible | `md-radio` | `md-select` |
| Several of many | `md-multi-select` | many `md-checkbox`es |
| Several of few, all visible | `md-checkbox` | `md-multi-select` |
| Instant on/off setting | `md-switch` | `md-checkbox` |
| A value in a numeric range | `md-slider` | `md-text-field type=number` |
| Subjective score | `md-rating` | slider |
| A color | `md-color-picker` | `<input type=color>` |
| Assign a subset from a bounded pool, side by side | `md-transfer-list` | two lists + buttons |
| Filter / attribute / removable entry | `md-chip` | small buttons |
| A date | `md-date-picker` | three selects |
| A time | `md-time-picker` | text field |

### 5.4 Navigation

| Need | Use | Don't use |
|---|---|---|
| Top-level destinations, mobile | `md-navigation-bar` + `md-navigation-tab` | tabs |
| Top-level destinations, desktop | `md-navigation-rail` + `md-navigation-rail-tab` | bottom bar |
| App header: title, actions, search | `md-app-bar` | a custom `<header>` |
| A dense action strip | `md-toolbar` | app bar |
| Sibling views **within** one screen | `md-tabs` + `md-tab` + `md-tab-panels` + `md-tab-panel` | navigation bar |
| Hierarchy / where-am-I | `md-breadcrumbs` + `md-breadcrumb-item` | text links |
| A linear multi-step flow | `md-stepper` + `md-step` | tabs |
| Contextual popup actions | `md-menu` + `md-menu-item`, `md-menu-item-group`, `md-sub-menu-item` | dialog |
| Hierarchical command menu (File → Export → PDF) | `md-menu` + `md-sub-menu-item` | nested dialogs |

### 5.5 Containment and feedback

| Need | Use | Don't use |
|---|---|---|
| Group related content | `md-card` | a bare `<div>` with a border |
| Blocking decision or focused task | `md-dialog` | a new page |
| Critical error the user must acknowledge | `md-dialog` | `md-snackbar` |
| Supplementary content from the bottom (mobile) | `md-bottom-sheet` | dialog |
| Supplementary content from the side (desktop) | `md-side-sheet` | dialog |
| Brief confirmation of an action, optionally undoable | `md-snackbar` | dialog, alert |
| Explain a control on hover/focus | `md-tooltip` | a dialog or inline hint |
| Progressive disclosure of sections | `md-accordion` + `md-accordion-item` | tabs |
| Visual separation | `md-divider` | a styled `<hr>` |
| A vertical set of records | `md-list` + `md-list-item` | a table |
| Determinate/indeterminate progress | `md-progress-indicator` | spinner GIF |
| Brand-consistent page/content loading | `md-loading-indicator` | custom spinner |
| Content-shaped loading placeholder | `md-skeleton` | a spinner over the whole page |
| Count or status on an element | `md-badge` | superscript text |
| Compact status dot | `md-status-dot` | a colored emoji |
| Read-only value within a known range (quota, battery) | `md-meter` | `md-progress-indicator` |
| A person or entity image/initials | `md-avatar` | a raw `<img>` |
| Touch feedback inside a custom control | `md-ripple` | custom CSS animation |

### 5.6 Data

| Need | Use | Don't use |
|---|---|---|
| Any table | `md-table-container` wrapping `md-table`, with `-head`/`-body`/`-row`/`-cell`/`-foot` inside the table and `-toolbar`/`-pagination` beside it in the container (§7.1) | a native `<table>` |
| Sorting, selection, paging on that table | the same parts — `md-table` carries the STATE (`sort-by`, `sort-order`, `selection`, `row-offset`, `row-count`, `loading`) and emits events; you own the data and do the actual sorting/paging | expecting it to sort an array for you |
| Hierarchy / reporting lines | `md-organization-chart` | nested lists |
| Compare categories | `md-bar-chart` | pie chart |
| Trend over time | `md-line-chart` | bar chart |
| Trend with cumulative volume | `md-area-chart` | line chart |
| Parts of a whole (≤ ~6 slices) | `md-pie-chart` | bar chart |
| Inline micro-trend in a cell or card | `md-sparkline` | a full chart |

> **There is no data-driven table component.** `md-table` is composable: you
> render the rows. It tracks and announces sort, selection and pagination state
> and emits events when the user changes them, but the sorting, filtering and
> slicing of your data is yours to perform. Render rows from your own array in
> response to those events.

### 5.7 Choosing the variant

The matrix picks the component; this picks its shape. Every value below is a
real enum member — anything not listed here is not a valid value.

| Component | Prop | Values, and when |
|---|---|---|
| `md-button` | `variant` | `filled` the one primary action · `tonal` a strong secondary · `outlined` secondary, and the safe choice for a destructive action behind a confirm · `text` low emphasis, dialog Cancel · `elevated` when it sits on a busy or coloured background (default `filled`) |
| `md-button` / `md-icon-button` / `md-button-group` | `size` | `xs` `sm` `md` `lg` `xl` — default `sm`; go `md`/`lg` for consumer CTAs, `xs`/`sm` for dense admin UI |
| `md-icon-button` | `variant` | `standard` (default) · `filled` · `tonal` · `outlined` |
| `md-button-group` | `variant` | `standard` spaced · `connected` fused into one bar |
| `md-fab` | `size` | `standard` (default) · `medium` · `large` |
| `md-fab` | `variant` | `primary-container` (default) · `secondary-container` · `tertiary-container` · `surface` · `primary` · `secondary` · `tertiary` |
| `md-card` | `variant` | `filled` for a group of comparable items · `elevated` (default) for a hero or featured item · `outlined` for a settings or form section |
| `md-text-field` / `md-select` | `variant` | `outlined` for forms on a surface · `filled` for dense or tinted layouts (`md-text-field` defaults to `filled`, `md-select` to `outlined`) — pick one and use it for every field on the screen |
| `md-text-field` | `type` | any native input type: `password`, `email`, `tel`, `url`, `search`, … (default `text`) |
| `md-text-field` | `multiline` | `"auto-grow"` grows with content · `"fixed"` with `rows` for a fixed comment box · `false` (default) single line |
| `md-search` | `variant` | `contained` (default) · `divided` |
| `md-app-bar` | `variant` | `small` (default) · `medium` · `large` for a prominent headline · `search` for a bar that hosts a field |
| `md-chip` | `variant` | `assist` (default) · `filter` for toggleable facets · `input` for user-entered removable values · `suggestion` |
| `md-chip` | `appearance` | `outlined` (default) · `filled` · `elevated` |
| `md-badge` | `variant` | `small` a bare dot · `large` (default) a count |
| `md-tooltip` | `variant` | `plain` (default) a short label on an icon control · `rich` an explanatory popover that may hold a link or action |
| `md-divider` | — | **no `variant`** — use the booleans `inset`, `inset-start`, `inset-end` |
| `md-side-sheet` | `variant` | `standard` coexists with page content · `modal` overlays with a scrim |
| `md-bottom-sheet` | `variant` | `standard` (default) · `detached` floating above the edge |
| `md-dialog` | `fullscreen` | boolean — a full-screen dialog for a long mobile task |
| `md-date-picker` | `variant` | `modal-input` (default) calendar plus a typed field · `modal` calendar only · `docked` inline, anchored to the field |
| `md-time-picker` | `variant` | `dial` · `input` (default) |
| `md-progress-indicator` | `variant` | `linear` (default) · `circular`; add `indeterminate` when the total is unknown |
| `md-list-item` | `lines` | `1` · `2` · `3` — must match how much supporting text you pass |
| `md-navigation-bar` | — | 3–5 destinations. Fewer than three: use `md-tabs`. More than five: a rail or a menu |
| `md-navigation-rail` | — | 3–7 destinations; cap the overflow with `max-visible` |

### 5.8 Not in the library

Rich text editor · file upload/dropzone · calendar/scheduler view · map ·
toast stack manager (use `md-snackbar` and manage the queue yourself) ·
data grid with virtualized columns. If the user needs one, say so plainly and
integrate a third-party component styled with the MD3 tokens.

**There is no `md-grid`, no `md-data-table`, no `md-layout`, no `md-icon`.**
If a tag is not listed in §6, it does not exist — do not emit it.

---

## §6 — Component inventory

**Every component has exactly one manual, and it is the readme.md in its own
source folder:**

```
./packages/core/src/components/<tag>/readme.md
```

e.g. [`md-select`](./packages/core/src/components/md-select/readme.md),
[`md-button`](./packages/core/src/components/md-button/readme.md).

**Load that file before you use the component.** There is no second, shorter
summary to rely on — this readme is the single source, so anything you do not
read there, you do not know. Each one carries When-to-use, a Do/Don't table
from M3, copy-paste patterns, an anti-patterns table, and the theming surface.

Work through them one at a time: pick the component from the decision matrix
(§5), load its readme, write that component's markup, then move to the next.

There are 81 manuals for 57 components: 24 of them document sub-components that
are only valid inside a parent (a table cell, a tab panel, a select option).
Every sub-component manual names its parent in the first line, and §7 below
summarises the nesting.

`status` in each manual's `llm:meta` block is one of:

- **`md3-mapped`** — has a Material Design 3 guidelines page; the Do/Don't is
  sourced from it.
- **`custom`** — an addition to MD3; guidance is derived house rules.
- **`sub-component`** — only valid inside a specific parent.

| Category | Components |
|---|---|
| Actions | `md-button` `md-icon-button` `md-fab` `md-fab-menu` `md-fab-menu-item` `md-split-button` `md-button-group` `md-segmented-button` `md-segmented-button-set` |
| Text input | `md-text-field` `md-number-field` `md-otp-field` `md-autocomplete` `md-search` |
| Selection | `md-select` `md-select-option` `md-multi-select` `md-checkbox` `md-radio` `md-switch` `md-slider` `md-rating` `md-color-picker` `md-transfer-list` `md-chip` |
| Pickers | `md-date-picker` `md-time-picker` |
| Navigation | `md-app-bar` `md-toolbar` `md-navigation-bar` `md-navigation-tab` `md-navigation-rail` `md-navigation-rail-tab` `md-tabs` `md-tab` `md-tab-panels` `md-tab-panel` `md-breadcrumbs` `md-breadcrumb-item` `md-menu` `md-menu-item` `md-menu-item-group` `md-sub-menu-item` `md-stepper` `md-step` |
| Containment | `md-card` `md-dialog` `md-bottom-sheet` `md-side-sheet` `md-snackbar` `md-tooltip` `md-accordion` `md-accordion-item` `md-divider` `md-list` `md-list-item` |
| Data | `md-table` `md-table-container` `md-table-head` `md-table-body` `md-table-row` `md-table-cell` `md-table-foot` `md-table-toolbar` `md-table-pagination` `md-table-sort-label` `md-table-expand-toggle` `md-organization-chart` |
| Charts | `md-bar-chart` `md-line-chart` `md-area-chart` `md-pie-chart` `md-sparkline` |
| Status & feedback | `md-progress-indicator` `md-loading-indicator` `md-skeleton` `md-badge` `md-status-dot` `md-meter` `md-avatar` `md-ripple` |

---

## §7 — Composition rules

### 7.1 What nests inside what

A sub-component is only valid inside its parent. Putting one anywhere else
produces an unstyled, unregistered-looking element with no keyboard behaviour,
because the parent is what wires roving tabindex, ARIA ids and selection.

| Parent | Children it manages |
|---|---|
| `md-button-group` | `md-button`, `md-icon-button` |
| `md-segmented-button-set` | `md-segmented-button` |
| `md-fab-menu` | `md-fab-menu-item` (anchored to an `md-fab` via `anchor="<id>"`) |
| `md-menu` | `md-menu-item`, `md-sub-menu-item`, `md-menu-item-group` — **not** `md-divider`; separate rows with `md-menu-item`'s own `divider` (or `gap`) prop |
| `md-menu-item-group` | `md-menu-item` |
| `md-sub-menu-item` | a nested `md-menu` in `slot="submenu"` — the items go in *that* menu. There is no default slot, so anything else you nest renders nothing |
| `md-select`, `md-multi-select`, `md-autocomplete` | `md-select-option` |
| `md-list` | `md-list-item`, `md-divider` |
| `md-tabs` | `md-tab` |
| `md-tab-panels` | `md-tab-panel` (one per tab, in tab order) |
| `md-navigation-bar` | `md-navigation-tab` |
| `md-navigation-rail` | `md-navigation-rail-tab`, plus an `md-fab` in `slot="fab"` |
| `md-accordion` | `md-accordion-item` |
| `md-stepper` | `md-step` (horizontal steppers also take `slot="content"`) |
| `md-breadcrumbs` | `md-breadcrumb-item` |
| `md-table-container` | `md-table` — **it wraps the table, not the other way round** — plus `md-table-toolbar` in `slot="top"` and `md-table-pagination` in `slot="bottom"`, which sit outside the scroll region |
| `md-table` | `md-table-head`, `md-table-body`, `md-table-foot` (and bare `md-table-row`). It does **not** accept the container, toolbar or pagination |
| `md-table-head` / `-body` / `-foot` | `md-table-row` |
| `md-table-row` | `md-table-cell`, plus `md-table-expand-toggle` for an expandable row |
| `md-table-cell` | `md-table-sort-label` in a header cell |
| `md-tooltip` | **its trigger** — the tooltip wraps the element it describes in its default slot |
| `md-dialog` | body content in the default slot; `md-button` in `slot="actions"` |
| `md-bottom-sheet` / `md-side-sheet` | content in the default slot; `md-button` in `slot="actions"`; headline in `slot="headline"` |
| `md-app-bar` | `md-icon-button` in `slot="leading"` and `slot="trailing"`; `md-menu` for overflow; a field in `slot="search"` on `variant="search"` |
| `md-toolbar` | `md-icon-button`, `md-button`, `md-button-group`; an `md-fab` in `slot="fab"`; `slot="leading"` / `slot="trailing"` for the end clusters |

### 7.2 Pairs that belong together

These don't nest — they sit next to each other in a working flow. Reaching for
one usually means you want the other.

| This | Goes with | Why |
|---|---|---|
| `md-icon-button` | `md-tooltip` | The tooltip supplies the visible meaning the icon lacks |
| `md-button` (`soft-disabled`) | `md-tooltip` | Explains *why* the action is unavailable |
| `md-fab` | `md-fab-menu` | The FAB is the menu's anchor |
| `md-split-button` | `md-menu` | The trailing half opens it |
| `md-card` | `md-button`, `md-icon-button`, `md-divider` | Footer actions, corner action, internal sections |
| `md-list-item` | `md-checkbox`, `md-switch`, `md-icon-button` | Trailing controls in a selectable or settings row |
| `md-bottom-sheet` / `md-side-sheet` | `md-list` | Action menus and filter panels inside the sheet |
| `md-search` | `md-list`, `md-avatar`, `md-icon-button` | Results in the panel; account and voice/filter affordances in the trailing slot |
| `md-date-picker` | `md-time-picker` | Date + time row for booking and scheduling forms |
| `md-time-picker` | `md-button` | The trigger, when `hide-trigger` is set. The picker **is** its own dialog — don't nest it in another one |
| `md-text-field` | `md-button` | Submit / cancel in the form footer |
| `md-multi-select` / `md-autocomplete` | `md-text-field`, `md-menu`, `md-chip` | The field is the trigger (and inherits its variant, density and error state), the menu is the option surface, chips are the selected values |
| `md-autocomplete` | `md-progress-indicator` | The loading row while suggestions are fetched |
| `md-transfer-list` | `md-checkbox`, `md-text-field`, `md-icon-button` | Per-row select, per-side search, mover controls |
| `md-number-field` | `md-text-field` hooks, `md-icon-button` | It *is* an `md-text-field` internally — every `--md-text-field-*` custom property passes through — and its steppers are `md-icon-button`s |
| `md-otp-field` | `md-button` | Verify action (`auto-submit` covers the no-button flow) |
| Any chart | `md-card` | Charts belong on a dashboard tile |
| `md-line-chart` | `md-segmented-button-set` | Period picker (1W / 1M / 1Y) driving the range |
| `md-sparkline` | `md-list-item`, `md-table-cell` | Trend column beside a value |
| `md-skeleton` | `md-card`, `md-list` | Render N placeholders in the real layout while fetching |
| `md-meter` | `md-chip`, `md-card` | Same semantic status colour on both; quota and usage summaries live on a card |
| `md-color-picker` | `md-text-field`, `md-button` | Label and helper text beside it in a form; save / cancel in the surrounding popover or dialog |
| `md-rating` | `md-text-field`, `md-card` | A rating row in a review form; aggregate scores on a review card |
| `md-accordion` | `md-divider` | Optional inner dividers inside long item content |
| `md-stepper` | `md-button` | Next / back / submit adjacent to the stepper |

### 7.3 Nesting that is always wrong

- A dialog opened from inside a dialog. Use `md-stepper` inside **one**
  `md-dialog`.
- A component inside a native interactive element (`<button>`, `<a>`) — it
  nests interactive controls and destroys the accessibility tree. Use the
  component's own `href` / `type` props.
- `md-tabs` used for top-level app navigation. Tabs switch sibling views of the
  same data; destinations are `md-navigation-bar` / `md-navigation-rail`.

---

## §8 — Page recipes

Complete, runnable screens. Each renders as-is once the components are
registered and the token sheet and font links from §3 are loaded — no
placeholder identifiers, no helper functions to write.

### 8.1 Login screen

`<form>` is load-bearing: it is what makes `required` block submit and what
`type="submit"` calls `requestSubmit()` on.

```html
<main style="display: grid; place-items: center; min-block-size: 100dvh; padding: 24px;">
  <form id="login-form" style="inline-size: min(420px, 100%);">
    <md-card variant="elevated" style="padding: 32px; display: flex; flex-direction: column; gap: 20px;">
      <h1 style="margin: 0; font: var(--md-sys-typescale-headline-medium-font);">Sign in</h1>

      <md-text-field
        variant="outlined"
        label="Email"
        type="email"
        name="email"
        autocomplete="username"
        required
      ></md-text-field>

      <md-text-field
        variant="outlined"
        label="Password"
        type="password"
        name="password"
        autocomplete="current-password"
        password-toggle="internal"
        required
      ></md-text-field>

      <md-button variant="filled" type="submit" full-width>Sign in</md-button>
      <md-button variant="text" href="/forgot-password">Forgot password?</md-button>
    </md-card>
  </form>
</main>

<script type="module">
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    console.log(data.get('email'), data.get('password'));
  });
</script>
```

### 8.2 Settings page (mobile)

Top app bar + grouped rows of instant-apply switches. `md-switch` uses
**`selected`**, not `checked`. The rows are `type="text"` (non-interactive), so
the switch is the only control — one tab stop per setting.

```html
<md-app-bar variant="small" headline="Settings">
  <md-icon-button slot="leading" icon="arrow_back" aria-label="Back"></md-icon-button>
</md-app-bar>

<main style="padding: 16px; display: flex; flex-direction: column; gap: 16px;">
  <md-card variant="outlined">
    <md-list>
      <md-list-item headline="Notifications" supporting-text="Push, email, in-app" lines="2">
        <md-switch slot="trailing" selected aria-label="Enable notifications" data-setting="notifications"></md-switch>
      </md-list-item>
      <md-divider></md-divider>
      <md-list-item headline="Dark mode" supporting-text="Match system" lines="2">
        <md-switch slot="trailing" aria-label="Enable dark mode" data-setting="dark"></md-switch>
      </md-list-item>
      <md-divider></md-divider>
      <md-list-item headline="Sync over cellular">
        <md-switch slot="trailing" selected aria-label="Sync over cellular" data-setting="cellular"></md-switch>
      </md-list-item>
    </md-list>
  </md-card>
</main>

<md-snackbar id="settings-toast" message="Setting saved"></md-snackbar>

<script type="module">
  const toast = document.getElementById('settings-toast');
  document.querySelectorAll('md-switch[data-setting]').forEach((sw) => {
    sw.addEventListener('mdChange', (e) => {
      if (sw.dataset.setting === 'dark') {
        document.documentElement.setAttribute('data-theme', e.detail.selected ? 'dark' : 'light');
      }
      toast.show();
    });
  });
</script>
```

### 8.3 Settings form (deferred save, with validation)

When settings are saved on submit rather than applied instantly, use a real
form. `required` blocks the submit; every control needs a `name` to reach
`FormData`.

```html
<form id="profile-form" style="max-inline-size: 560px; margin: 24px auto; padding: 0 16px;">
  <md-card variant="outlined" style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
    <h2 style="margin: 0; font: var(--md-sys-typescale-title-large-font);">Profile</h2>

    <md-text-field
      variant="outlined"
      label="Display name"
      name="displayName"
      required
      supporting-text="Shown on your public profile"
    ></md-text-field>

    <md-select variant="outlined" label="Language" name="language" value="en" required>
      <md-select-option value="en" label="English"></md-select-option>
      <md-select-option value="de" label="Deutsch"></md-select-option>
      <md-select-option value="ar" label="العربية"></md-select-option>
    </md-select>

    <!-- md-checkbox has NO label slot. It is a labelable, form-associated
         element: wrap it in a native <label> (which names it AND forwards
         clicks), or give the host an aria-label. Text between the tags is
         NOT rendered. -->
    <label style="display: inline-flex; align-items: center; gap: 12px; cursor: pointer;">
      <md-checkbox name="newsletter" value="yes" supporting-text="Monthly, no more"></md-checkbox>
      <span>Send me product news</span>
    </label>

    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <md-button variant="text" type="reset">Reset</md-button>
      <md-button variant="filled" type="submit">Save changes</md-button>
    </div>
  </md-card>
</form>

<md-snackbar id="saved-toast" message="Changes saved" action="Undo"></md-snackbar>

<script type="module">
  const form = document.getElementById('profile-form');
  const toast = document.getElementById('saved-toast');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    console.log(data); // { displayName, language, newsletter? }
    toast.show();
  });

  toast.addEventListener('mdAction', () => form.reset());
</script>
```

### 8.4 Dashboard with a FAB

```html
<md-app-bar variant="medium" headline="Inbox">
  <md-icon-button slot="trailing" icon="search" aria-label="Search"></md-icon-button>
  <md-icon-button slot="trailing" icon="filter_list" aria-label="Filter"></md-icon-button>
</md-app-bar>

<main style="padding: 16px; display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));">
  <md-card variant="filled" interactive style="padding: 16px;">
    <strong>Acme contract</strong>
    <p style="margin: 4px 0 0; color: var(--md-sys-color-on-surface-variant);">Renewal due in 5 days</p>
  </md-card>
  <md-card variant="filled" interactive style="padding: 16px;">
    <strong>Q4 report draft</strong>
    <p style="margin: 4px 0 0; color: var(--md-sys-color-on-surface-variant);">Shared by Alex</p>
  </md-card>
</main>

<md-fab
  icon="add"
  aria-label="New item"
  style="position: fixed; inset-block-end: 16px; inset-inline-end: 16px; z-index: var(--md-sys-z-index-navigation);"
></md-fab>
```

`inset-inline-end` (not `right`) is what keeps the FAB in the correct corner
under `dir="rtl"`.

### 8.5 Destructive confirmation dialog

`md-dialog` traps focus and returns it to the trigger on close — do not add your
own focus management. The error colouring goes through the button's own custom
properties, never a hex.

```html
<md-button id="open-delete" variant="outlined">Delete account</md-button>

<md-dialog id="confirm-delete" headline="Delete account?" icon="warning">
  <p style="margin: 0;">
    This will permanently delete your account and all associated data.
    This action cannot be undone.
  </p>
  <md-button id="cancel-delete" slot="actions" variant="text">Cancel</md-button>
  <md-button
    id="do-delete"
    slot="actions"
    variant="filled"
    style="--md-button-container-color: var(--md-sys-color-error);
           --md-button-label-color: var(--md-sys-color-on-error);"
  >Delete</md-button>
</md-dialog>

<script type="module">
  const dialog = document.getElementById('confirm-delete');
  document.getElementById('open-delete').addEventListener('mdClick', () => dialog.show());
  document.getElementById('cancel-delete').addEventListener('mdClick', () => dialog.close());
  document.getElementById('do-delete').addEventListener('mdClick', () => {
    dialog.close();
    // perform the deletion
  });
</script>
```

If you omit `slot="actions"` entirely, `md-dialog` renders its own Cancel / OK
pair (labels via `cancel-label` / `ok-label`) and closes itself.

### 8.6 Tabbed content page

`md-tab-panels` finds the nearest preceding `md-tabs` (or the one named by
`for`), follows its `mdTabChange`, and wires `aria-controls` /
`aria-labelledby` both ways. **No JavaScript is required**, and `md-tab` has no
`value` or `selected` prop — selection lives on `md-tabs` as `active-tab-index`.

```html
<md-tabs id="profile-tabs" aria-label="Profile sections" active-tab-index="0">
  <md-tab label="Posts"></md-tab>
  <md-tab label="Replies"></md-tab>
  <md-tab label="Likes" badge="3"></md-tab>
</md-tabs>

<md-tab-panels for="profile-tabs">
  <md-tab-panel style="padding: 16px;">
    <p style="margin: 0;">Your posts appear here.</p>
  </md-tab-panel>
  <md-tab-panel style="padding: 16px;">
    <p style="margin: 0;">Your replies appear here.</p>
  </md-tab-panel>
  <md-tab-panel style="padding: 16px;">
    <p style="margin: 0;">Posts you liked appear here.</p>
  </md-tab-panel>
</md-tab-panels>
```

To react to the switch (lazy-loading a panel, for example), listen on the tabs:

```js
document.getElementById('profile-tabs')
  .addEventListener('mdTabChange', (e) => console.log(e.detail.index, e.detail.previousIndex));
```

---

## §9 — Universal do's and don'ts

Apply to every component. Component-specific rules live in each manual.

### 9.1 API and styling

| ✅ Do | ❌ Don't |
|---|---|
| Use the custom element directly — it *is* the control, with its own `href` / `type` props | Wrap it in a native `<button>` / `<a>` (§7.3) |
| Set arrays and objects as **JS properties** (`el.items = [...]`) | Pass them as HTML attributes — they won't parse |
| Theme via `--md-<component>-*` properties, then `::part()` | Reach into shadow internals or override `.md-*` classes |
| Change appearance through design tokens (§4.1) | Hardcode hex colors, px spacing, shadows, or font stacks |
| Use `--md-sys-z-index-*` for your own overlays | Invent z-indexes that land under a menu |
| Use logical CSS (`margin-inline-start`, `inset-inline-end`) | Use `margin-left`, `right`, `padding-right` |
| Set `data-density` / `data-theme` / `dir` once, globally | Set them per component unless you mean a local exception |
| Listen to the component's `md*` events | Rely on native `click` — it fires even when the component's `disabled` / `loading` guard suppressed the action |
| Check the manual for the state prop name | Assume `checked`; `md-switch` uses `selected` |
| Render the element, then call its `@Method` | Call `.show()` on an element not yet in the DOM |

Toggling components flip their own state on activation and *then* emit. On
`md-button`, `mdClick` is cancelable — `preventDefault()` on it vetoes the
toggle and any navigation. `mdChange` fires after the flip and is not
cancelable. If a controlled parent rejects a change it must revert the child
explicitly.

`md-button` has a **toggle mode**: set `toggle` and the button flips its own
`selected` on each activation and exposes `aria-pressed`. `selected` is the
state, not the switch — set it for the initial pressed state and read it back
from `mdClick`'s `detail.selected`. Setting `toggle` and then styling
"pressed" yourself, or setting `selected` without `toggle` (which emits no
`aria-pressed` at all), both produce a control that lies to assistive tech.

### 9.2 Content and hierarchy

| ✅ Do | ❌ Don't |
|---|---|
| Use sentence case for all labels | Uppercase or title-case UI text |
| Keep one high-emphasis action per screen region | Compete `filled` buttons against each other |
| Use `soft-disabled` + `md-tooltip` for contextually-unavailable actions | Use `disabled` and remove it from tab order with no explanation |
| Localize every text prop and `aria-label` | Leave default English prop values in a translated app |

**`disabled` vs `soft-disabled`.** Both render the disabled appearance, but
`disabled` also removes the control from the tab order, so a keyboard or screen
reader user can never find out *why* it is off. `soft-disabled` keeps the
control focusable and announced while still blocking activation — which is what
lets an `md-tooltip` on it explain the gate. Use it whenever the reason is
informative rather than obvious.

Nesting rules — dialog inside a dialog, a component inside a native
`<button>` / `<a>`, tabs used as app navigation — live in §7.3.

### 9.3 Accessibility contract

The library ships WCAG 2.1 AA keyboard and ARIA wiring by default. These are the
rules you must not break:

1. **Every icon-only control gets an accessible name.** `md-icon-button`,
   `md-fab`, and icon-only `md-tab` are nameless without `aria-label` (or
   `aria-labelledby`). `md-fab` will also accept `label`, and warns in the
   console when it has neither.
2. **Every form field gets a `label` prop.** `placeholder` is not a label — it
   disappears on type.
3. **Don't break the tab order.** Every interactive control must be reachable by
   Tab and operable by Enter/Space. If you add `tabindex="-1"` to anything,
   have a reason.
4. **Don't write your own focus trap.** `md-dialog`, `md-bottom-sheet` and
   `md-side-sheet` trap focus while open and restore it to the trigger on
   close — including across shadow boundaries. Adding your own fights theirs.
5. **Don't wrap components in your own live regions.** `md-snackbar` announces
   itself (`politeness="polite"` by default, `"assertive"` when the message must
   interrupt). For an error that blocks the task, use `md-dialog`.
6. **Don't disable motion yourself.** Components honour
   `prefers-reduced-motion: reduce` internally.
7. **Directional icons do not auto-flip in RTL** — see §4.5.
8. **Re-verify contrast after overriding any colour role** — the library's AA
   testing covers the shipped palette only. The Theme Generator at
   <https://awc-ui.dev/theme-generator> runs the WCAG checks live (§4.2).

---

## §10 — Before you ship

1. **Every icon-only control has an accessible name.**
2. **Keyboard-only pass**: reach and operate every control; focus is always
   visible; no traps in dialogs/menus/sheets; focus returns to the trigger.
3. **Theme pass**: light *and* dark, if both are supported — and the attribute
   is set before first paint.
4. **RTL pass**, if an RTL locale ships — check directional icons specifically,
   and grep your own CSS for physical properties.
5. **Density pass** at the configured rung — no clipped labels, touch targets
   still adequate. Remember `density="0"` is inert; use
   `--md-sys-density-scale: 0` to opt a subtree out.
6. **Forms**: every control has a `name`; `required` blocks submit; `FormData`
   contains every field; reset works.
7. **No hardcoded strings** left in markup if the app is localized — including
   default prop values like `Search`, `Dismiss`, `No results`.
8. **No hardcoded design values** — grep the diff for hex colours, `px` radii,
   `box-shadow`, and `z-index` literals.
9. **Contrast** re-verified against AA if colour roles were overridden.
10. **SSR**: if server-rendered, confirm no hydration mismatch and that content
    is present with JS disabled.
11. **No shadow-internal CSS** — only tokens, custom properties, and `::part()`.
12. **Every `md-*` tag you emitted appears in §6.** If it doesn't, it doesn't
    exist.
