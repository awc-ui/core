# Encore

A live-show discovery and demo ticket booking application built with AWC UI.

From the monorepo root, install dependencies with `pnpm install`, build the core
library, and run `pnpm --filter @awc-ui/encore dev`. The standalone preview is
http://127.0.0.1:4400. `pnpm --filter @awc-ui/encore build` compiles all five hosts;
`pnpm --filter @awc-ui/encore test` checks pricing, availability, validation,
idempotency, filters, exports, and framework routing.

## Architecture

- `src/shell.js`: canonical AWC shell compiled into actual React, Vue, Angular,
  and Svelte templates by `scripts/generate-framework-shells.mjs`.
- `src/app.js` / `src/views.js`: shared hash routes, AWC event handlers, and views.
- `src/model.js`: integer-pence pricing, capacity, checkout validation, IndexedDB
  transactions, local/session preferences, and calendar export.
- `src/loading.js`: AWC skeletons and progress bound to real operations.
- `src/data.js`: nine fictional shows, performances, and ticket areas.
- `src/theme.css`: generated AWC colour roles for light/dark violet, rose, teal.

Checkout is a demo: no real payment, email, or admission ticket. Bookings are
stored per browser/device. IndexedDB serializes inventory checks and inserts in
one transaction; checkout IDs make repeated purchase requests idempotent.
Cancellation retains a record and releases capacity. Form data is escaped before
rendering or SVG export. Illustrative photos load from Unsplash; fonts and icons
are bundled with their licences.

The docs integration stages all five builds under `/showcase/encore/` and includes
an overview with a component map. Use the header selector to change framework
while preserving the route and draft on the same origin.
