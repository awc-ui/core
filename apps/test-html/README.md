# @awc-ui/test-html

Vanilla HTML playground that renders every AWC UI custom element (no
framework binding) on a single page so you can inspect components,
states, and theming against the raw `<md-*>` tags as a sanity check
that the published web components work without any wrapper.

## Run

```bash
pnpm --filter @awc-ui/test-html dev
# → http://127.0.0.1:5170/
```

Or from the repo root:

```bash
pnpm dev:html
```

## Why it exists

The React / Vue / Svelte / Angular playgrounds (`apps/test-*`) prove
each framework wrapper integrates correctly. This app proves the
**core web components** work without any wrapper at all — same
component list, same sections, but driven from plain `<script>` +
DOM event listeners. Useful when:

- diagnosing whether a bug is in the wrapper or in the underlying
  custom element,
- previewing token / theme changes against unwrapped MD3 components,
- doing a quick `Cmd+Shift+I` inspection of shadow-DOM internals
  without React DevTools / Vue DevTools in the way.

## Ports

All five playgrounds use stable, distinct ports so you can run them
side-by-side:

| Playground       | URL                       |
| ---------------- | ------------------------- |
| `test-html`      | http://127.0.0.1:5170/    |
| `test-react`     | http://127.0.0.1:5171/    |
| `test-vue`       | http://127.0.0.1:5172/    |
| `test-svelte`    | http://127.0.0.1:5173/    |
| `test-angular`   | http://127.0.0.1:4200/    |

`strictPort: true` is set on each Vite app, so a port clash fails fast
instead of silently hopping — that way bookmarks stay stable.
