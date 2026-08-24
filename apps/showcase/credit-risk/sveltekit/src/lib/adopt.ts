/**
 * MAKE THE SERVER'S SHADOW DOM SURVIVE SVELTE'S HYDRATION, SO THE RUNTIME
 * ADOPTS IT INSTEAD OF RENDERING A SECOND COPY INTO IT.
 *
 * This file exists because of one line in `svelte/internal`, and it is worth
 * quoting rather than paraphrasing (`claim_element_base`, svelte 4.2.20,
 * src/runtime/internal/dom.js):
 *
 *     const remove = [];
 *     for (let j = 0; j < node.attributes.length; j++) {
 *       const attribute = node.attributes[j];
 *       if (!attributes[attribute.name]) remove.push(attribute.name);
 *     }
 *     remove.forEach((v) => node.removeAttribute(v));
 *
 * Svelte 4 hydrates by CLAIMING the nodes the server sent, and a claimed
 * element keeps only the attributes its own template declares. `attributes` is
 * the literal list the compiler read out of the `.svelte` file — there is no
 * hook, no allow-list, and spread attributes are filtered out of it entirely
 * (`get_claim_statement` in the compiler). Everything else on the element is
 * removed.
 *
 * On `<md-badge value={n}>` the template declares exactly one attribute. The
 * server sent seven:
 *
 *     value class role aria-label variant density s-id
 *
 * Six of them are the component's own work — Stencil's `renderToString` runs
 * the real component on the server, so `role="status"`, `aria-label`, the
 * reflected `variant`/`density` and the `md-badge--large` classes are as much a
 * part of the server render as the shadow root is. Svelte deletes all six on
 * sight, because a `.svelte` file cannot possibly have declared them.
 *
 * ── WHY THAT DUPLICATES THE PAGE ─────────────────────────────────────────────
 *
 * The seventh, `s-id`, is the one that costs. Stencil stamps it on every host
 * it server-renders and `c-id` on every node inside the shadow root, and its
 * client runtime reads `s-id` in `connectedCallback` — once, on the element's
 * first connection — to decide between two paths:
 *
 *   - `s-id` present: reconstruct the vdom from the `c-id` annotations and
 *     ADOPT the shadow root the parser already built from the server's
 *     `<template shadowrootmode="open">`. No second render.
 *   - `s-id` absent: an ordinary fresh component. Render into the shadow root.
 *
 * The second path does not CLEAR the shadow root first — there is nothing in it
 * the runtime believes it owns — so it appends. Measured on the overview
 * before this file existed: 239 shadow-hosting elements against 207 in the
 * `next` and `nuxt` builds, every nav item drawing its icon twice, a chip
 * reading "24 of 61 24 of 61", and the watchlist badge reading "77" where the
 * figure is 7. None of it was visible to a text assertion, because
 * `innerText` does not cross a shadow boundary.
 *
 * ── WHY IT WAS A RACE, AND IS NOT ANY MORE ───────────────────────────────────
 *
 * Two independent async chains used to decide the outcome: SvelteKit's start
 * script importing the app, and a `<script type="module">` in `<head>`
 * importing the component runtime. Stencil defers its deferred
 * connectedCallbacks past `customElements.define`, so which one won was not
 * even a function of which module landed first. Measured on this machine: one
 * load defined the elements 31 ms BEFORE Svelte claimed anything and still
 * duplicated, because the callback that reads `s-id` had not run yet.
 *
 * So the ordering is made explicit instead, using seams the frameworks
 * themselves guarantee:
 *
 *   1. `captureServerRender()` from `hooks.client.ts`'s `init`, which
 *      SvelteKit awaits BEFORE hydrating (`await _app.hooks.init?.()` precedes
 *      `await _hydrate(...)` in kit's `client.js`). The document is fully
 *      parsed — kit's start script is the last node in the body — so every
 *      server-rendered host is already there, shadow root and all.
 *   2. Svelte hydrates, claiming and stripping.
 *   3. `startComponentRuntime()` from the root layout's `onMount`. Claiming is
 *      the `l()` phase of the whole component tree and finishes before any
 *      `m()` runs, so the first `onMount` in the app is the first moment at
 *      which nothing else will claim anything. It restores what Svelte removed
 *      and only THEN imports the runtime, which now finds `s-id` where the
 *      server put it.
 *
 * Nothing here polls, and nothing here waits on a timer.
 *
 * ── THE COST, STATED PLAINLY ─────────────────────────────────────────────────
 *
 * The runtime used to be imported from `<head>` and now is not, so its lazy
 * entry chunks start downloading after hydration rather than during parse.
 * `hooks.server.ts` emits `<link rel="modulepreload">` for it instead, which
 * fetches and compiles the module with the document but does not execute it —
 * executing it is what defines the elements, and that is the thing that has to
 * happen last. First paint is unaffected either way: it comes from the
 * declarative shadow DOM in the HTML, before any of this runs.
 *
 * The other side of the trade is that a browser which never finishes hydrating
 * never starts the runtime. That page is the JavaScript-disabled page — a
 * complete, styled, readable credit report with inert components — which this
 * build already serves and already documents. A timer-based fallback was
 * considered and rejected: it can only fire while hydration is still in
 * progress, which is precisely when starting the runtime causes the bug above.
 */

import { base } from '$app/paths';

/**
 * Stencil's lazy loader. Not bundled — see `scripts/sync-runtime.mjs` for the
 * post-mortem on what happens when Vite gets hold of it.
 */
const RUNTIME_URL = `${base}/awc-runtime/md3/md3.esm.js`;

/**
 * Elements the server rendered a component into. Stencil writes `s-id` on
 * exactly those, so the selector needs no list of tag names and cannot drift
 * against one. It does not descend into shadow roots, which is correct: Svelte
 * never claims anything in there, so the `c-id` annotations on the shadow
 * children are in no danger and need no snapshot.
 */
const SERVER_RENDERED = '[s-id]';

/** `[element, [[name, value], …]]` for every host, as the server wrote it. */
let serverAttributes: [Element, [string, string][]][] = [];

/**
 * Record every server-rendered host's attributes, before Svelte can claim it.
 *
 * Called from `hooks.client.ts`'s `init`. Cheap enough not to think about: 174
 * elements and about 1,200 attribute pairs on the heaviest screen, read once.
 */
export function captureServerRender(): void {
  serverAttributes = [...document.querySelectorAll(SERVER_RENDERED)].map((element) => [
    element,
    [...element.attributes].map((attribute) => [attribute.name, attribute.value]),
  ]);
}

/**
 * Put back what `claim_element` removed.
 *
 * ONLY what it REMOVED. An attribute Svelte has written a value into is the
 * app's own, and the app wins — this is a repair of collateral damage, not a
 * second opinion about the markup. In practice the two sets do not overlap:
 * the first client render must agree with the server's for hydration to mean
 * anything, so anything missing after the claim was the component's, not the
 * template's.
 *
 * An element Svelte could not match — it creates a fresh one and detaches the
 * server's — is still in the snapshot, now orphaned. Writing attributes onto a
 * detached node is harmless and it will never be upgraded; the replacement has
 * no `s-id`, so the runtime renders it cold, which is the right answer for an
 * element that genuinely is new.
 */
function restoreServerRender(): void {
  for (const [element, attributes] of serverAttributes) {
    for (const [name, value] of attributes) {
      if (!element.hasAttribute(name)) element.setAttribute(name, value);
    }
  }
  // The snapshot is initial-hydration bookkeeping. Client-side navigations
  // render fresh components with no server markup behind them, so holding
  // these references any longer would only keep detached nodes alive.
  serverAttributes = [];
}

/**
 * Hand the components over to the runtime, after hydration and not before.
 *
 * Called from the root layout's `onMount`. Idempotent, because a layout that
 * is destroyed and recreated must not import the module twice — the import is
 * memoised by the module graph anyway, but re-running the restore over an empty
 * snapshot after the runtime has taken over would be misleading to read.
 *
 * `@vite-ignore` because the URL is a static asset served from `static/`, not a
 * module in the app's graph: Vite must leave it exactly as written or it will
 * try to resolve it at build time and fail.
 */
let started = false;
export function startComponentRuntime(): void {
  if (started) return;
  started = true;

  restoreServerRender();

  void import(/* @vite-ignore */ RUNTIME_URL).catch((error) =>
    console.error('[awc-ui] component registration failed', error),
  );
}
