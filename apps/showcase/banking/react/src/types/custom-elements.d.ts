/**
 * JSX typings for the raw custom elements.
 *
 * This app renders `md-*` tags directly rather than importing `@awc-ui/react`.
 * The wrappers are lovely, but every one of them imports `@awc-ui/core`, which
 * drags Stencil's lazy loader into the bundle — and a bundled loader resolves
 * its entry chunks relative to its own location, so it would look for them
 * under `/showcase/wealth/react/assets/`, where Vite never wrote them. That is
 * why the components arrive from a static `<script type="module">` instead;
 * `scripts/sync-runtime.mjs` has the full post-mortem.
 *
 * The tags are listed one by one rather than behind a `` `md-${string}` ``
 * pattern index signature: TypeScript resolves an intrinsic element by exact
 * property lookup and ignores pattern signatures here, so the pattern compiles
 * but every tag still errors. A bare `[tag: string]: any` would work and would
 * also switch off typo checking for every real HTML element in the app, which
 * is too high a price.
 *
 * Props are typed loosely on purpose. The authority for every prop name is the
 * component's own readme under `packages/core/src/components`, not a mirror
 * that would silently rot against it. Object-valued props (`series`, `data`,
 * `nodes`) have no attribute form at all and are assigned through refs — see
 * `components/elements.tsx`.
 *
 * IF YOU NEED A TAG THAT IS NOT HERE: add it, and read
 * `packages/core/src/components/<tag>/readme.md` first. A tag missing from this
 * list is a TypeScript error; a tag missing from §6 of `main-llm.md` does not
 * exist at all.
 */

import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type CE = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      /* surfaces + indicators */
      'md-card': CE;
      'md-chip': CE;
      'md-button': CE;
      'md-icon-button': CE;
      'md-badge': CE;
      'md-divider': CE;
      'md-status-dot': CE;
      'md-meter': CE;
      'md-avatar': CE;
      'md-progress-indicator': CE;
      'md-tooltip': CE;
      'md-skeleton': CE;

      /* actions */
      'md-fab': CE;
      'md-fab-menu': CE;
      'md-fab-menu-item': CE;
      'md-button-group': CE;
      'md-segmented-button-set': CE;
      'md-segmented-button': CE;
      'md-split-button': CE;

      /* charts */
      'md-sparkline': CE;
      'md-bar-chart': CE;
      'md-line-chart': CE;
      'md-area-chart': CE;
      'md-pie-chart': CE;

      /* navigation */
      'md-app-bar': CE;
      'md-toolbar': CE;
      'md-navigation-rail': CE;
      'md-navigation-rail-tab': CE;
      'md-navigation-bar': CE;
      'md-navigation-tab': CE;
      'md-tabs': CE;
      'md-tab': CE;
      'md-tab-panels': CE;
      'md-tab-panel': CE;
      'md-breadcrumbs': CE;
      'md-breadcrumb-item': CE;
      'md-menu': CE;
      'md-menu-item': CE;
      'md-menu-item-group': CE;
      /* A row that opens a nested menu; the nested `md-menu` goes in its
         `submenu` slot. Used by the holdings screen's overflow menu. */
      'md-sub-menu-item': CE;
      'md-stepper': CE;
      'md-step': CE;

      /* containment */
      'md-dialog': CE;
      'md-side-sheet': CE;
      'md-bottom-sheet': CE;
      'md-snackbar': CE;
      'md-accordion': CE;
      'md-accordion-item': CE;
      'md-list': CE;
      'md-list-item': CE;

      /* tables */
      'md-table-container': CE;
      'md-table': CE;
      'md-table-head': CE;
      'md-table-body': CE;
      'md-table-foot': CE;
      'md-table-row': CE;
      'md-table-cell': CE;
      'md-table-sort-label': CE;
      'md-table-toolbar': CE;
      'md-table-pagination': CE;
      'md-table-expand-toggle': CE;
      'md-organization-chart': CE;

      /* inputs */
      'md-text-field': CE;
      'md-number-field': CE;
      'md-select': CE;
      'md-select-option': CE;
      'md-multi-select': CE;
      'md-autocomplete': CE;
      'md-checkbox': CE;
      'md-radio': CE;
      'md-switch': CE;
      'md-slider': CE;
      'md-search': CE;
      'md-rating': CE;
      'md-otp-field': CE;
      'md-transfer-list': CE;
      'md-date-picker': CE;
      'md-time-picker': CE;

      /* the showcase kit's own control bar */
      'awc-showcase-dock': CE;
    }
  }
}

export {};
