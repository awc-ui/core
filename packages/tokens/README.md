# @awc-ui/tokens

Framework-agnostic Material Design 3 design tokens for
[AWC UI](https://awc-ui.dev), published as CSS custom properties. The package
contains the default light and dark color schemes, typography, elevation,
motion, shape, state, and component tokens used by `@awc-ui/core`.

## Install

```bash
npm install @awc-ui/tokens
```

## Use

Import the token sheet once from your application entry:

```js
import "@awc-ui/tokens/tokens.css";
```

Or link it directly in a plain HTML project:

```html
<link rel="stylesheet" href="./node_modules/@awc-ui/tokens/src/tokens.css" />
```

The tokens inherit through Shadow DOM, so the same stylesheet themes AWC UI
Web Components and your application CSS:

```css
.product-card {
  color: var(--md-sys-color-on-surface);
  background: var(--md-sys-color-surface-container);
  border-radius: var(--md-sys-shape-corner-large);
}
```

## Dark mode

Set one attribute on the document or any subtree:

```html
<html data-theme="dark"></html>
```

See the [theming guide](https://awc-ui.dev/theming/overview/), the complete
[token reference](https://awc-ui.dev/theming/tokens/), and the interactive
[Material Design 3 theme generator](https://awc-ui.dev/theme-generator/).

## Related packages

- [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core) — accessible
  Material Design 3 Web Components.
- [`@awc-ui/theme`](https://www.npmjs.com/package/@awc-ui/theme) — generate
  light and dark token sets from brand seed colors.

## License

[MIT](./LICENSE) © AWC UI contributors
