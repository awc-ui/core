# @awc-ui/theme

Material Design 3 theme generation for [AWC UI](https://www.npmjs.com/package/@awc-ui/core): compute full MD3 color schemes from a seed color (via Google's [`@material/material-color-utilities`](https://www.npmjs.com/package/@material/material-color-utilities)), emit them as CSS custom properties, and apply them at runtime.

## Install

```bash
npm install @awc-ui/theme
```

## Usage

Generate and apply a theme in the browser:

```ts
import { computeTheme, applyThemeStylesheet } from '@awc-ui/theme';

const theme = computeTheme({ primaryHex: '#6750A4' });
applyThemeStylesheet(theme); // injects the --md-sys-* custom properties
```

Or generate static CSS at build time / server-side:

```ts
import { computeTheme, generateCss } from '@awc-ui/theme';

const css = generateCss(computeTheme({ primaryHex: '#6750A4' }));
// write `css` to a file and ship it instead of computing in the browser
```

### Off-main-thread

Heavy palette computation can run in a Web Worker — the package ships a ready-made worker entry:

```ts
// Vite
import ThemeWorker from '@awc-ui/theme/worker?worker';
const worker = new ThemeWorker();
```

The worker bundle is self-contained (dependencies inlined), so it also works with a plain `new Worker(url, { type: 'module' })`.

## Docs

Theming guides and the interactive theme generator: **[awc-ui.dev](https://awc-ui.dev/theming/overview/)**.

## License

MIT
