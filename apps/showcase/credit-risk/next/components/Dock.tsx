'use client';

/**
 * `<awc-showcase-dock>` — the same bar on every screen.
 *
 * The bare import is the registration: the module defines the element and, on
 * the client, immediately stamps the persisted/URL state onto <html>. It is a
 * no-op in Node — `element.ts` resolves `HTMLElement` to a stub class so the
 * module stays importable in a server graph — so the server render emits the
 * tag and the browser upgrades it. Nothing here listens for
 * `awc-showcase-change`; `ShowcaseProvider` owns the single subscription, and a
 * second listener would double-render every screen.
 *
 * `frameworks` now lists SEVEN ids, not six: `react` is the client-routed SPA
 * and `next` — this build — is the runtime server-rendered one. Both are real
 * entries in the switcher, which is the whole point of splitting them.
 *
 * `base-path` is the prefix BEFORE the framework segment, not this app's Next
 * `basePath` — the dock swaps the segment inside the path it finds, and only
 * falls back to `base-path` when the current segment is not in the URL.
 */

import '@awc-ui/showcase-kit/dock';
import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '@/lib/routes';

export function Dock() {
  return (
    <awc-showcase-dock
      frameworks={FRAMEWORKS.join(',')}
      framework={FRAMEWORK}
      base-path={SHOWCASE_BASE}
      position="bottom"
    />
  );
}
