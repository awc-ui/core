# Svelte Web Components and SvelteKit SSR — @awc-ui/svelte

Svelte 4 and 5 components for [AWC UI](https://www.npmjs.com/package/@awc-ui/core) — accessible Material Design 3 Web Components with SvelteKit SSR support.

## Install

```bash
npm install @awc-ui/svelte @awc-ui/core @awc-ui/tokens
```

Requires Svelte 4 or 5.

## Usage

Register the custom elements once on the client, then use `md-*` tags directly in any `.svelte` file — Svelte has first-class custom-element support, so no per-component wrappers are needed:

```ts
// main.ts (plain Vite/SPA app)
import { defineCustomElements } from "@awc-ui/svelte";
defineCustomElements(window);
```

```svelte
<md-button variant="filled" on:click={save}>Save</md-button>
<md-text-field label="Email" variant="outlined"></md-text-field>
```

### SvelteKit (SSR)

Registration is client-only — guard it so it runs in the browser:

```ts
import { browser } from "$app/environment";
import { defineCustomElements } from "@awc-ui/svelte";

if (browser) defineCustomElements(window);
```

For server-rendered markup use `@awc-ui/core/hydrate` (`renderToString`).

## Styling

Load the design tokens once (they carry the whole MD3 theme):

```ts
import "@awc-ui/tokens/tokens.css";
```

## Docs

[Svelte and SvelteKit SSR guide](https://awc-ui.dev/frameworks/svelte/) · [All component docs](https://awc-ui.dev/components/)

Component manuals and AI-readable documentation also ship with [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core).

## License

MIT
