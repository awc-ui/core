# AWC UI — Web Components for React, Angular, Vue, Svelte and SSR

![Material Design 3](https://img.shields.io/badge/Material%20Design-3-6750A4?style=flat-square&logo=material-design&logoColor=white)
![StencilJS](https://img.shields.io/badge/StencilJS-4-16161D?style=flat-square&logo=stencil&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
[![npm version](https://img.shields.io/npm/v/%40awc-ui%2Fcore?style=flat-square&label=npm)](https://www.npmjs.com/package/@awc-ui/core)
[![npm downloads](https://img.shields.io/npm/dm/%40awc-ui%2Fcore?style=flat-square)](https://www.npmjs.com/package/@awc-ui/core)
[![CI](https://github.com/awc-ui/core/actions/workflows/ci.yml/badge.svg)](https://github.com/awc-ui/core/actions/workflows/ci.yml)

![Web Components](https://img.shields.io/badge/Web%20Components-native-29ABE2?style=flat-square&logo=webcomponents.org&logoColor=white)
![React](https://img.shields.io/badge/React-%E2%89%A518-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Angular](https://img.shields.io/badge/Angular-%E2%89%A517-DD0031?style=flat-square&logo=angular&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3-35495E?style=flat-square&logo=vuedotjs&logoColor=4FC08D)
![Svelte](https://img.shields.io/badge/Svelte-%E2%89%A54-FF3E00?style=flat-square&logo=svelte&logoColor=white)

**56 accessible, open-source Material Design 3 Web Components**, built with
[Stencil](https://stenciljs.com/) and shipped as standard custom elements. Use
the same component library in React, Angular, Vue, Svelte, or plain HTML, with
typed framework integrations and server-side rendering (SSR) for Next.js,
Angular SSR, Nuxt, and SvelteKit, plus RTL, theming, and AI-ready documentation.

**[awc-ui.dev](https://awc-ui.dev)** · [Web Components](https://awc-ui.dev/frameworks/web-components/) ·
[React](https://awc-ui.dev/frameworks/react/) · [Angular](https://awc-ui.dev/frameworks/angular/) ·
[Vue](https://awc-ui.dev/frameworks/vue/) · [Svelte](https://awc-ui.dev/frameworks/svelte/) ·
[SSR guide](https://awc-ui.dev/frameworks/ssr/)

## Quick start

For an existing app, follow the [React](https://awc-ui.dev/frameworks/react/),
[Angular](https://awc-ui.dev/frameworks/angular/), [Vue](https://awc-ui.dev/frameworks/vue/),
or [Svelte](https://awc-ui.dev/frameworks/svelte/) setup, including its SSR section
when your framework renders on the server.

For a new plain HTML app, use Node 22.13+ (22.x) or Node 24+ and Vite:

```bash
mkdir awc-example
cd awc-example
npm init -y
npm install @awc-ui/core
npm install --save-dev vite@7
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AWC UI example</title>
  </head>
  <body>
    <script type="module">
      import "@awc-ui/core/define";
      document.querySelector('md-button').addEventListener('mdClick', () => {
        document.querySelector('output').textContent = 'Created!';
      });
    </script>
    <md-button variant="filled">Create</md-button>
    <output aria-live="polite"></output>
  </body>
</html>
```

Run `npx vite` and open the local URL it prints. Build for production with
`npx vite build`. Vite resolves the npm import; opening this file directly or
serving it from a plain static server does not resolve package names.

`/define` registers components and includes the tokens stylesheet. A separate
`@awc-ui/tokens` dependency is optional. Add the
[icon and typography fonts](https://awc-ui.dev/getting-started/installation/#required-fonts)
when using icons or Roboto; subset the icon font for production.

## Packages

Every public package links back to the same component reference and is
published with npm provenance from GitHub Actions.

| Package                                                            | Use it for                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core)       | Framework-agnostic Web Components, SSR/hydration, and per-component imports |
| [`@awc-ui/react`](https://www.npmjs.com/package/@awc-ui/react)     | Typed React 18+ components and a Next.js SSR entry                          |
| [`@awc-ui/angular`](https://www.npmjs.com/package/@awc-ui/angular) | Angular 17+ components, forms directives, and Angular SSR support           |
| [`@awc-ui/vue`](https://www.npmjs.com/package/@awc-ui/vue)         | Typed Vue 3 components, plugin registration, and Nuxt SSR support           |
| [`@awc-ui/svelte`](https://www.npmjs.com/package/@awc-ui/svelte)   | Svelte 4/5 components and SvelteKit SSR support                             |
| [`@awc-ui/tokens`](https://www.npmjs.com/package/@awc-ui/tokens)   | MD3 design tokens as framework-agnostic CSS custom properties               |
| [`@awc-ui/theme`](https://www.npmjs.com/package/@awc-ui/theme)     | Seed-color theme generation, static CSS, and a Web Worker entry             |

## Components

56 components across eight categories. Every one has a full manual — see
[Documentation](#documentation).

| Category              | Components                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Actions** (7)       | Button, Button Group, FAB, FAB Menu, Icon Button, Segmented Button, Split Button                                           |
| **Selection** (12)    | Checkbox, Chip, Color Picker, Date Picker, Multi Select, Radio, Rating, Select, Slider, Switch, Time Picker, Transfer List |
| **Text Inputs** (5)   | Autocomplete, Number Field, OTP Field, Search, Text Field                                                                  |
| **Navigation** (8)    | App Bar, Breadcrumbs, Menu, Navigation Bar, Navigation Rail, Stepper, Tabs, Toolbar                                        |
| **Containment** (8)   | Accordion, Bottom Sheet, Card, Dialog, Divider, List, Side Sheet, Tooltip                                                  |
| **Communication** (8) | Badge, Loading Indicator, Meter, Progress Indicator, Skeleton, Snackbar, Status Dot, Ripple                                |
| **Data Display** (3)  | Avatar, Organization Chart, Table                                                                                          |
| **Charts** (5)        | Area, Bar, Line, Pie, Sparkline                                                                                            |

Charts are a hand-rolled Canvas 2D engine — no charting dependency.

## Framework support

The elements work untouched anywhere. Typed wrappers add props, events and JSX
types:

| Framework                                                         | Package           | Requires      |
| ----------------------------------------------------------------- | ----------------- | ------------- |
| [React and Next.js SSR](https://awc-ui.dev/frameworks/react/)     | `@awc-ui/react`   | React >= 18   |
| [Angular and Angular SSR](https://awc-ui.dev/frameworks/angular/) | `@awc-ui/angular` | Angular >= 17 |
| [Vue and Nuxt SSR](https://awc-ui.dev/frameworks/vue/)            | `@awc-ui/vue`     | Vue >= 3      |
| [Svelte and SvelteKit SSR](https://awc-ui.dev/frameworks/svelte/) | `@awc-ui/svelte`  | Svelte >= 4   |
| Anything else                                                     | `@awc-ui/core`    | —             |

**[Server-side rendering](https://awc-ui.dev/frameworks/ssr/)** is supported
through `@awc-ui/core/hydrate`, with a validated reference app for Next.js,
Nuxt, SvelteKit, Astro, and Angular SSR under `apps/`.

## Theming

Everything visual resolves from `--md-sys-*` design tokens, so a theme is a
stylesheet, not a fork. Dark mode is one attribute:

```js
document.documentElement.setAttribute("data-theme", "dark");
```

Three more global switches work the same way — `dir="rtl"`, `data-density`
(0 to -4), `data-ripple` and `data-shape-morph`. See
[Global behaviour](https://awc-ui.dev/behaviour/density/).

Build a palette from a source colour with the
[theme generator](https://awc-ui.dev/theme-generator/).

## Working with AI assistants

From your app's directory, install Core if needed and connect your assistant
to its bundled documentation:

```sh
npm install @awc-ui/core
npx --no-install awc-ui ai-setup
```

Then describe what you want to build, change, or review. The assistant follows
your existing project decisions and reads the component manuals for your
installed version. See [Building with AI](https://awc-ui.dev/guides/building-with-ai/)
for examples and setup details.

[AI skills and MCP](docs/ai-integration.md) are optional additions for reusable
workflows and searchable documentation. Connect `@awc-ui/mcp` from npm, or
install the skills included in Core with `npx --no-install awc-ui ai-setup --skills`.

The core package also publishes a standard
[`custom-elements.json`](https://custom-elements-manifest.open-wc.org/) manifest,
so IDEs, documentation tools, and Web Component catalogs can discover all
elements, properties, events, slots, CSS parts, and CSS custom properties.

## Monorepo layout

```
awc-ui/
├── packages/
│   ├── core/        Stencil components — src/components/<tag>/ is the source of truth
│   ├── mcp/         Read-only MCP server with bundled Core documentation
│   ├── tokens/      MD3 design tokens (CSS custom properties)
│   ├── theme/       Palette generation from a source colour
│   ├── react/       Wrapper — generated, never hand-edited
│   ├── angular/     Wrapper — generated
│   ├── vue/         Wrapper — generated
│   └── svelte/      Wrapper — generated
├── apps/
│   ├── docs/        awc-ui.dev — Astro + Starlight
│   ├── storybook/   Stories for every component
│   ├── example-*/   SSR reference apps (next, nuxt, sveltekit, astro, angular-ssr)
│   └── test-*/      Per-framework integration apps
└── main-llm.md        The AI build director (shipped inside @awc-ui/core)
```

Each component folder holds its implementation, styles, spec and e2e tests, and
its `readme.md` — one directory, everything about that component.

## Development

Use Node 22.13+ (22.x) or Node 24+ and the pinned `pnpm@9.5.0`.
`.nvmrc` selects Node 22.

```bash
nvm install                         # if you use nvm
corepack enable
node scripts/check-environment.mjs
pnpm install
pnpm dev                            # focused Storybook workflow; builds prerequisites
```

Use `pnpm dev:docs` for a docs preview that builds core/theme, generates the
reference, and watches component changes. Run one of these previews at a time
because they currently share core build output. The canonical
[contributor guide](CONTRIBUTING.md) covers scaffolding, targeted tests and checks.

### Storybook

Every component has stories, and Storybook is the fastest way to work on one.
From the **repo root**:

```bash
pnpm storybook
```

Then open **<http://localhost:6006>**.

The command checks Node, builds `@awc-ui/theme`, builds core using the lean
`stencil.config.dev.ts`, then starts the core watcher and Storybook on port 6006.
Editing component `.tsx` or `.css` files rebuilds the component and reloads its story.

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

**Before a production build, stop the preview.** Development and production
currently share `packages/core/dist`; a running watcher can overwrite a
production build. `pnpm --filter @awc-ui/core build` already clears `dist`
before rebuilding, so no separate cleanup command is needed.

Other Storybook commands:

| Command                                           | What                                     |
| ------------------------------------------------- | ---------------------------------------- |
| `pnpm --filter @awc-ui/storybook build-storybook` | Static build (what CI publishes)         |
| `pnpm --filter @awc-ui/storybook test:a11y`       | axe accessibility sweep over every story |
| `pnpm --filter @awc-ui/storybook test:stories`    | Run the story interaction tests          |

## Contributing

Bug reports, feature requests and new component proposals each have a template
and a guide:

- [Report a bug](https://awc-ui.dev/contributing/reporting-a-bug/)
- [Request a feature](https://awc-ui.dev/contributing/feature-requests/)
- [Request a component](https://awc-ui.dev/contributing/new-component-requests/)
- [Contributing guide](CONTRIBUTING.md)
- [Maintaining versioned documentation](docs/versioned-documentation.md)

You do not need to write code to help — a bug report we can reproduce is worth
more than a patch we cannot verify.

## License

[MIT](./LICENSE) © AWC UI contributors
