# showcase-caduceus — Caduceus Health patient portal

A fictional patient portal for Caduceus Health, built as an Angular 17 SSR showcase for AWC UI.
Every route is prerendered by Angular's application builder, then post-processed by the AWC UI
hydrate module (`scripts/inject-dsd.mjs`) so the `<md-*>` tags ship with Declarative Shadow DOM;
the client registers the custom elements via an `APP_INITIALIZER` import of
`@awc-ui/core/dist/components`, and all styling uses MD3 tokens only (with a teal-blue brand
override of the primary role in `src/styles.css`).

## Screens

- `/` — **Sign in**: email + password (`md-text-field`) followed by a 6-digit second factor
  (`md-otp-field` with `auto-submit`), both stages driven by one real `<form>`.
- `/appointments` — **Appointments**: upcoming-visit list plus a three-step booking intake
  (`md-stepper` in linear mode) with visit-type/provider selects, and `md-date-picker` +
  `md-time-picker` scheduling; booking confirms through `md-snackbar`.
- `/lab-results` — **Lab results**: an `md-table` panel where each analyte shows a
  reference-range `md-meter` (success/warning/error status colors) and an `md-status-dot`
  status column, with a key/legend card.
- `/vitals` — **Vitals**: `md-line-chart` trends (heart rate, blood pressure, weight, glucose)
  switched by an `md-segmented-button-set`, plus stat tiles with an in-range `md-meter`.

## AWC components exercised

`md-app-bar`, `md-icon-button`, `md-navigation-bar`, `md-navigation-tab`, `md-card`,
`md-button`, `md-text-field`, `md-otp-field`, `md-select`, `md-select-option`, `md-stepper`,
`md-step`, `md-date-picker`, `md-time-picker`, `md-list`, `md-list-item`, `md-divider`,
`md-chip`, `md-snackbar`, `md-table-container`, `md-table`, `md-table-head`, `md-table-body`,
`md-table-row`, `md-table-cell`, `md-meter`, `md-status-dot`, `md-line-chart`,
`md-segmented-button-set`, `md-segmented-button`.

## Run it

```bash
# dev server (client-side rendering)
pnpm --filter @awc-ui/showcase-caduceus dev

# full SSR build: prerender all four routes + inject Declarative Shadow DOM
pnpm --filter @awc-ui/showcase-caduceus build
```

All people, providers, clinics, and readings are fictional.
