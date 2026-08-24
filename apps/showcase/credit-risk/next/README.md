# Aurelia Bank — Credit Risk Console (Next.js)

The Next.js build of the `credit-risk` showcase vertical. Six framework builds
render the same six screens from the same fixture; this one exports to static
HTML and is served at `awc-ui.dev/showcase/credit-risk/react/`.

```bash
pnpm --filter @awc-ui/showcase-credit-risk-react build   # -> out/
node scripts/serve-out.mjs 4399                          # serve out/ at the real mount path
```

`build` runs `sync-runtime` first, which needs `packages/core/dist` to exist
(`pnpm --filter @awc-ui/core build`).

## Screens

| Route | Screen |
|---|---|
| `/` | Portfolio overview — KPI tiles with sparklines, sector bars, rating distribution, exposure trend by rating band, largest exposures |
| `/sectors/[sector]/` | Concentration and utilisation meters, sector EL/RWA trend, the sector's counterparties (7 pages) |
| `/counterparties/[id]/` | Obligor header, then tabs for facilities, rating history and group structure (24 pages) |
| `/facilities/[id]/` | Terms, covenant headroom meters, collateral net of haircuts, balance schedule to maturity (61 pages) |
| `/watchlist/` | Early-warning signals, filtered by severity and sector |
| `/stress/` | Baseline / adverse / severe, EL and RWA comparison charts, per-sector impact |

95 routes, all statically exported.

## The three decisions worth knowing

**The components are not bundled.** Stencil's lazy runtime is copied into
`public/awc-runtime/` by `scripts/sync-runtime.mjs` and loaded from a static
absolute URL by a module script in `app/layout.tsx`. Putting it through a
bundler makes it resolve its entry chunks under `/_next/static/`, where the
export never wrote them, and every element renders at zero height. The full
post-mortem is in that script, and originally in
`apps/docs/src/components/Head.astro`. `@awc-ui/react` is not used for the same
reason — the wrappers import `@awc-ui/core` and put the loader straight back
into the graph. Object-valued props are assigned through refs instead; see
`components/elements.tsx`.

**Every screen is a client component.** The dock changes the locale at runtime
and the whole page has to re-render in the new language, which a server
component cannot do. Each `page.tsx` is a thin server wrapper that owns
`generateStaticParams`; the screen underneath owns the render. The fixture
selectors are pure and synchronous, so the exported HTML still carries real rows
and real numbers.

**Nothing is invented.** The fixture is frozen at 2026-03-31 with no clock and
no randomness anywhere. The trends are derived in `lib/derive.ts` from the one
time dimension the fixture has — eight quarterly rating observations per
counterparty — calibrated so the last point of every series equals the KPI
printed above it.
