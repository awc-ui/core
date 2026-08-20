# @awc-ui/core

![Material Design 3](https://img.shields.io/badge/Material%20Design-3-6750A4?style=flat-square&logo=material-design&logoColor=white)
![StencilJS](https://img.shields.io/badge/StencilJS-4-16161D?style=flat-square&logo=stencil&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Beta](https://img.shields.io/badge/status-beta-F2B8B5?style=flat-square)

**Material Design 3 web components, built with [Stencil](https://stenciljs.com/).**
56 components that ship as standard custom elements, so they work in React,
Angular, Vue, Svelte or a plain HTML page.

> **Beta.** The API is stable enough to build with, but it is not frozen —
> expect occasional breaking changes before 1.0.

## For AI assistants

This package ships its own documentation. To point your project's assistants at
it — Claude Code, Cursor, Copilot, Codex — run once, after installing:

```bash
npx awc-ui ai-setup
```

That writes a small block into the files those tools already read (`AGENTS.md`,
`CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`), leaving your
own instructions in them untouched. Nothing is fetched from the network.

The documentation itself:

| File | What it gives you |
|---|---|
| [`main-llm.md`](./main-llm.md) | **Start here.** Interview, decision matrix, token reference, page recipes, ship checklist |
| `src/components/<tag>/readme.md` | Full manual for one component — API, accessibility contract, anti-patterns |

Each component's manual has a **When NOT to use** and an **Anti-patterns**
section. Read them: they describe the mistakes assistants actually make with
this library.

## Install

```bash
npm install @awc-ui/core
```

## Use

One import registers every element **and** loads the design tokens:

```js
import '@awc-ui/core/define';
```

```html
<md-button variant="filled" icon="add">Add item</md-button>
```

`define` imports `tokens.css`, so it is a **bundler-only** entry. Two cases need
something else:

| Situation | Entry |
|---|---|
| Bundler (Vite, webpack, Next, Nuxt…) | `import '@awc-ui/core/define'` |
| CDN / no bundler | load the loader, plus `<link rel="stylesheet" href="…/@awc-ui/tokens/src/tokens.css">` |
| Server-side rendering | `@awc-ui/core/hydrate` — reference apps for Next, Nuxt, SvelteKit, Astro and Angular live under `apps/` in the repo |

## Framework wrappers

The elements work untouched anywhere, but typed wrappers give you props, events
and JSX types:

| Framework | Package |
|---|---|
| React | [`@awc-ui/react`](https://www.npmjs.com/package/@awc-ui/react) |
| Angular | [`@awc-ui/angular`](https://www.npmjs.com/package/@awc-ui/angular) |
| Vue | [`@awc-ui/vue`](https://www.npmjs.com/package/@awc-ui/vue) |
| Svelte | [`@awc-ui/svelte`](https://www.npmjs.com/package/@awc-ui/svelte) |

## What's in the box

- **56 components** across actions, selection, text inputs, navigation,
  containment, communication and data display.
- **Design tokens** — 200+ `--md-sys-*` custom properties, light and dark, plus
  per-component hooks and `::part()` for anything the props don't cover.
- **Accessibility** — WAI-ARIA roles, keyboard support and focus management,
  verified with axe in CI. See <https://awc-ui.dev/guides/accessibility/>.
- **Form participation** — inputs are form-associated via `ElementInternals`, so
  they land in `FormData` and take part in constraint validation.
- **RTL** — logical properties throughout; directional icons mirror.
- **Density** — a global `data-density` signal, or a per-component `density`
  prop, from 0 down to -4.

## Documentation

- **Docs and live demos** — <https://awc-ui.dev>
- **Component reference** — every component ships a `readme.md` next to its
  source with API, do/don't, patterns and anti-patterns.

## License

[MIT](./LICENSE) © AWC UI
