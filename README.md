# AWC UI

![Material Design 3](https://img.shields.io/badge/Material%20Design-3-6750A4?style=flat-square&logo=material-design&logoColor=white)
![StencilJS](https://img.shields.io/badge/StencilJS-4-16161D?style=flat-square&logo=stencil&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Beta](https://img.shields.io/badge/status-beta-F2B8B5?style=flat-square)

![Web Components](https://img.shields.io/badge/Web%20Components-native-29ABE2?style=flat-square&logo=webcomponents.org&logoColor=white)
![React](https://img.shields.io/badge/React-%E2%89%A518-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Angular](https://img.shields.io/badge/Angular-%E2%89%A517-DD0031?style=flat-square&logo=angular&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3-35495E?style=flat-square&logo=vuedotjs&logoColor=4FC08D)
![Svelte](https://img.shields.io/badge/Svelte-%E2%89%A54-FF3E00?style=flat-square&logo=svelte&logoColor=white)

**56 Material Design 3 components**, built with [Stencil](https://stenciljs.com/)
and shipped as standard custom elements — so they work in React, Angular, Vue,
Svelte, or a plain HTML page, with no framework runtime of their own.

**[awcui.io](https://awcui.io)** · [Components](https://awcui.io/components/) ·
[Theming](https://awcui.io/theming/overview/) · [Guides](https://awcui.io/guides/accessibility/)

> **Beta.** The API is stable enough to build on, but not frozen — expect
> occasional breaking changes before 1.0.

## Quick start

```bash
npm install @awc-ui/core @awc-ui/tokens
```

```html
<link rel="stylesheet" href="node_modules/@awc-ui/tokens/src/tokens.css" />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />

<script type="module">
  import { defineCustomElements } from '@awc-ui/core/loader';
  defineCustomElements(window);
</script>

<md-button variant="filled" icon="add">Create</md-button>
<md-text-field label="Email" variant="outlined"></md-text-field>
```

The icon stylesheet needs those four axis ranges. A default request
(`?family=Material+Symbols+Outlined`) returns a static instance and the fill
transition silently stops working. If icons render as words — `add` instead of a
plus — the font has not loaded at all.

With a bundler, one import registers every element **and** the tokens:

```js
import '@awc-ui/core/define';
```

## Components

56 components across eight categories. Every one has a full manual — see
[Documentation](#documentation).

| Category | Components |
|---|---|
| **Actions** (7) | Button, Button Group, FAB, FAB Menu, Icon Button, Segmented Button, Split Button |
| **Selection** (12) | Checkbox, Chip, Color Picker, Date Picker, Multi Select, Radio, Rating, Select, Slider, Switch, Time Picker, Transfer List |
| **Text Inputs** (5) | Autocomplete, Number Field, OTP Field, Search, Text Field |
| **Navigation** (8) | App Bar, Breadcrumbs, Menu, Navigation Bar, Navigation Rail, Stepper, Tabs, Toolbar |
| **Containment** (8) | Accordion, Bottom Sheet, Card, Dialog, Divider, List, Side Sheet, Tooltip |
| **Communication** (8) | Badge, Loading Indicator, Meter, Progress Indicator, Skeleton, Snackbar, Status Dot, Ripple |
| **Data Display** (3) | Avatar, Organization Chart, Table |
| **Charts** (5) | Area, Bar, Line, Pie, Sparkline |

Charts are a hand-rolled Canvas 2D engine — no charting dependency.

## Framework support

The elements work untouched anywhere. Typed wrappers add props, events and JSX
types:

| Framework | Package | Requires |
|---|---|---|
| React | `@awc-ui/react` | React >= 18 |
| Angular | `@awc-ui/angular` | Angular >= 17 |
| Vue | `@awc-ui/vue` | Vue >= 3 |
| Svelte | `@awc-ui/svelte` | Svelte >= 4 |
| Anything else | `@awc-ui/core` | — |

**Server-side rendering** is supported through `@awc-ui/core/hydrate`, with a
validated reference app for each of Next, Nuxt, SvelteKit, Astro and Angular
under `apps/`.

## Theming

Everything visual resolves from `--md-sys-*` design tokens, so a theme is a
stylesheet, not a fork. Dark mode is one attribute:

```js
document.documentElement.setAttribute('data-theme', 'dark');
```

Three more global switches work the same way — `dir="rtl"`, `data-density`
(0 to -4), `data-ripple` and `data-shape-morph`. See
[Global behaviour](https://awcui.io/behaviour/density/).

Build a palette from a source colour with the
[theme generator](https://awcui.io/theme-generator/).

## Working with AI assistants

The library is documented for assistants as a first-class audience, and it all
ships inside the npm package:

| File | What it is |
|---|---|
| `main-llm.md` | **Start here.** Interview, decision matrix, token reference, page recipes, ship checklist |
| `src/components/<tag>/readme.md` | The manual for one component — when NOT to use it, full API, accessibility contract, anti-patterns |

`main-llm.md` tells the assistant to load a component's `readme.md` before writing
any of its markup. Run `npx awc-ui ai-setup` in a consuming project to point
Claude, Copilot, Cursor and Codex at them.

## Monorepo layout

```
awc-ui/
├── packages/
│   ├── core/        Stencil components — src/components/<tag>/ is the source of truth
│   ├── tokens/      MD3 design tokens (CSS custom properties)
│   ├── theme/       Palette generation from a source colour
│   ├── react/       Wrapper — generated, never hand-edited
│   ├── angular/     Wrapper — generated
│   ├── vue/         Wrapper — generated
│   └── svelte/      Wrapper — generated
├── apps/
│   ├── docs/        awcui.io — Astro + Starlight
│   ├── storybook/   Stories for every component
│   ├── example-*/   SSR reference apps (next, nuxt, sveltekit, astro, angular-ssr)
│   └── test-*/      Per-framework integration apps
└── main-llm.md        The AI build director (shipped inside @awc-ui/core)
```

Each component folder holds its implementation, styles, spec and e2e tests, and
its `readme.md` — one directory, everything about that component.

## Development

```bash
pnpm install
pnpm --filter @awc-ui/core build      # build the library first — most things need dist/

pnpm --filter @awc-ui/docs dev        # docs site
pnpm --filter @awc-ui/core test:spec -- <pattern>   # targeted tests
```

Stencil runs are slow; keep tests filtered while iterating and save the full
suite for a final pass. [CONTRIBUTING.md](CONTRIBUTING.md) has the full
workflow, the house conventions, and the traps worth knowing before your first
PR.

### Storybook

Every component has stories, and Storybook is the fastest way to work on one.
From the **repo root**:

```bash
pnpm storybook
```

Then open **<http://localhost:6006>**.

You do not need to build the library first — that one command does three things:

1. builds `@awc-ui/core` with `stencil.config.dev.ts` (a lean config that skips
   the outputs Storybook never loads), which takes about 7 seconds;
2. starts a Stencil **watcher** on the same config, so editing a component's
   `.tsx` or `.css` rebuilds and the story reloads;
3. starts Storybook on port 6006.

The two run side by side under `concurrently`, prefixed `CORE` and `SB` in the
output, so you can see which half is talking.

**If port 6006 is taken** — usually an earlier session still running — Storybook
asks whether to use 6007 instead and waits for an answer. If it looks like it
has hung at startup, that prompt is why. Free the port instead:

```bash
pkill -f "storybook.*dev -p 6006"
```

**Adding a new `@Prop`, `@Method` or event needs a full restart**, not just a
save. HMR reloads the story but Stencil's component metadata is captured at
startup, so a newly added member is invisible until Storybook is restarted.

**Before a production build, clear the dev output.** The Storybook watcher
writes into the same `packages/core/dist` that the real build uses, and Stencil
does not clean between configs:

```bash
rm -rf packages/core/dist && pnpm --filter @awc-ui/core build
```

Other Storybook commands:

| Command | What |
|---|---|
| `pnpm --filter @awc-ui/storybook build-storybook` | Static build (what CI publishes) |
| `pnpm --filter @awc-ui/storybook test:a11y` | axe accessibility sweep over every story |
| `pnpm --filter @awc-ui/storybook test:stories` | Run the story interaction tests |

## Contributing

Bug reports, feature requests and new component proposals each have a template
and a guide:

- [Report a bug](https://awcui.io/contributing/reporting-a-bug/)
- [Request a feature](https://awcui.io/contributing/feature-requests/)
- [Request a component](https://awcui.io/contributing/new-component-requests/)
- [Contributing guide](CONTRIBUTING.md)

You do not need to write code to help — a bug report we can reproduce is worth
more than a patch we cannot verify.

## License

[MIT](./LICENSE) © AWC UI contributors
