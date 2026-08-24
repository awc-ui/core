/**
 * A route that proves RUNTIME server rendering, not build-time prerendering.
 *
 * Two things have to be true, and they are different claims:
 *
 *  1. The markup exists before any JavaScript runs. `curl` executes no JS, so
 *     if the response already contains `<template shadowrootmode="open">` the
 *     components were rendered by the server, not by the browser.
 *
 *  2. It was rendered FOR THIS REQUEST. Build-time prerendering also satisfies
 *     (1) — the HTML is just a file on disk. The distinguishing evidence is
 *     that two requests differ: `renderedAt` is stamped while handling the
 *     request, so identical values across two curls would mean a cached
 *     artifact, not a live render.
 *
 * `force-dynamic` opts out of Next's static optimisation, which is what the
 * default page (marked "○ Static" in the build output) gets.
 */
export const dynamic = 'force-dynamic';

import { MdButton, MdBadge } from '@awc-ui/react/server';

export default function SsrProof() {
  const renderedAt = new Date().toISOString();
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Runtime SSR proof</h1>
      <p>
        rendered-at: <span id="rendered-at">{renderedAt}</span>
      </p>
      <MdButton variant="filled">Server rendered</MdButton>
      <MdBadge value="7" />
    </main>
  );
}
