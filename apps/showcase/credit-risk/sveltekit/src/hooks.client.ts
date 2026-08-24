/**
 * One job: photograph the server's markup before Svelte edits it.
 *
 * `init` is the only seam SvelteKit offers that runs on the client BEFORE
 * hydration — kit's `client.js` does `await _app.hooks.init?.()` and only then
 * `await _hydrate(target, hydrate)`. By the time it runs the document is fully
 * parsed (kit's start script is the last node in the body) and every
 * server-rendered component is in place with its declarative shadow root
 * already attached by the parser.
 *
 * A moment later Svelte's `claim_element` will strip every attribute the
 * `.svelte` templates do not declare, including the `s-id` marker Stencil's
 * runtime reads to decide whether to adopt the server's shadow root or render a
 * second copy into it. `src/lib/adopt.ts` carries the whole story; this file is
 * only where the shutter goes.
 */
import type { ClientInit } from '@sveltejs/kit';
import { captureServerRender } from '$lib/adopt';

export const init: ClientInit = () => {
  captureServerRender();
};
