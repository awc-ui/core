// SPIKE PROBE — NOT part of the Fieldstone showcase.
//
// Fieldstone's four real routes are 100% `'use client'`, so they import the
// client wrappers from '@awc-ui/react' and their prerendered HTML contains
// bare <md-*> tags with zero Declarative Shadow DOM. This route exists only to
// answer the separate question "does the DSD pipeline survive
// `output: 'export'` + basePath?" by rendering the SSR wrappers from
// '@awc-ui/react/server' inside a Server Component. It does — see the
// <template shadowrootmode="open"> blocks in this page's HTML.
//
// Do not count this route when tallying the showcase's DSD coverage.
import { MdButton, MdBadge, MdCheckbox } from '@awc-ui/react/server';

export default function DsdProbe() {
  return (
    <main style={{ padding: 32, display: 'grid', gap: 16, maxWidth: 640 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>SPIKE probe — not a Fieldstone screen</h1>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
        These three components are rendered through <code>@awc-ui/react/server</code> in a
        Server Component, proving Declarative Shadow DOM still emits under Next.js{' '}
        <code>output: &apos;export&apos;</code> with a base path. Fieldstone&apos;s own
        routes do not use these wrappers and emit no DSD.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <MdButton variant="filled">Filled</MdButton>
        <MdBadge value="3" />
        <MdCheckbox checked>Server-checked</MdCheckbox>
      </div>
    </main>
  );
}
