# @awc-ui/react

React bindings for [AWC UI](https://www.npmjs.com/package/@awc-ui/core) — Material Design 3 web components.

## Install

```bash
npm install @awc-ui/react @awc-ui/core
```

Requires React 18+.

## Usage

```tsx
import { MdButton } from '@awc-ui/react';

export function Demo() {
  return <MdButton variant="filled">Click me</MdButton>;
}
```

The components register their underlying custom elements automatically on first render.

## Server rendering

For styled markup on first paint (Next.js App Router and other SSR setups), import the same components from the server entry — they render each component's Declarative Shadow DOM on the server and hydrate on the client:

```tsx
import { MdButton } from '@awc-ui/react/server';
```

## Smaller bundles

Tree-shaking works out of the box: importing a component ships only that component plus the shared runtime. Two opt-ins shrink things further.

**Client-only build** — if your app never server-renders, alias the core components to the CSR build, which compiles out the Declarative-Shadow-DOM hydration support (≈3 kB gz):

```ts
// vite.config.ts
resolve: {
  alias: [
    { find: '@awc-ui/core/dist/components', replacement: '@awc-ui/core/dist/components-csr' },
  ],
},
```

Remove the alias if you adopt SSR — the hydrating build is the default for a reason.

**Preact** — the wrappers are `preact/compat`-safe. Since the components are web components, React only provides thin glue, and swapping it for Preact saves ≈50 kB gz with three aliases (most specific first; `react/jsx-runtime` maps automatically):

```ts
// vite.config.ts — and `npm i preact` (keep react + @types for type-checking)
resolve: {
  alias: [
    { find: 'react-dom/client', replacement: 'preact/compat/client' },
    { find: 'react-dom', replacement: 'preact/compat' },
    { find: 'react', replacement: 'preact/compat' },
  ],
},
```

Caveats: no React DevTools/concurrent features, and libraries that touch React internals may misbehave — evaluate for your app.

## Documentation

Component docs, theming, and per-component manuals ship with [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core).
