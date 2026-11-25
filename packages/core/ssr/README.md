# Framework hydration

Load `@awc-ui/core/css/tokens.css` before the page paints. It includes the tokens
and the visibility guard for client-only components; native server-rendered
shadow roots remain visible.

Use the same Core version for `@awc-ui/core/hydrate` on the server and the
SSR-capable `@awc-ui/core/components/*` entries or lazy loader in the browser.
The `components-csr/*` entries do not adopt server shadow roots. Rebuild
prerendered HTML with the client assets after an upgrade, including cached
pages. Preserve the renderer's internal attributes and comments.

Core's hydration annotations distinguish parent-authored classes from a nested
component's own host classes. This preserves date-field floating labels,
select fills and insets, and nested button/menu appearance without freezing
later state changes. The framework handoff below handles the separate case
where a framework replaces a host's class attribute.

Vue, Angular and Svelte can replace a custom element's `class` while claiming
server markup. Preserve the component classes before framework hydration:

```js
import { preserveSsrClasses } from '@awc-ui/core/ssr/classes';

const finishFrameworkClaim = preserveSsrClasses();
// Run framework hydration, then call from its mounted/bootstrap hook:
finishFrameworkClaim();
```

The returned function marks framework claim complete; it is not a cancellation
function. Each host remains protected until its component has adopted the server
render. Either loading order is supported. Application class changes remain
intact, and component state updates become the new baseline. Protection ends on
a genuine user action or when the host disconnects, so initial selected or
expanded classes cannot be replayed over later interaction.

Nuxt should call the helper in an `enforce: 'pre'` client plugin and finish from
`app:mounted`. Angular should start in its application initializer and finish
from `ApplicationRef.whenStable()` after bootstrap, outside `NgZone`. Register
the bootstrap listener after `provideRouter()` so initial navigation has started
before waiting for stability; root bootstrap alone can precede route hydration.
The repository examples show both integrations.

`createSvelteHydration()` from `@awc-ui/core/ssr/sveltekit` includes this protection:
call `capture()` in the client init hook, then `restore()` from the root layout's
`onMount` before importing component entries. Keep the helper's instance shared
between those hooks.

This fixes a first-paint regression where framework class replacement removed
`hydrated` and appearance classes from a styled server host, hiding its entire
subtree until the component runtime arrived. The guard for unstyled client-only
components remains enabled.

Initial control state does not replay interaction animations during adoption.
Loading indicators remain intentional activity, and the first real action
retains its normal feedback. Validate with JavaScript disabled, delayed client
registration, and after adoption: check values and layout, original host and
shadow-root identity, and the first interaction.
