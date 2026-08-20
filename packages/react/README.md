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

## Documentation

Component docs, theming, and per-component manuals ship with [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core).
