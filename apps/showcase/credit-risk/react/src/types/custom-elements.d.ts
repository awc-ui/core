/**
 * JSX typings for the raw custom elements.
 *
 * This app renders `md-*` tags directly rather than importing `@awc-ui/react`.
 * The wrappers are lovely, but every one of them imports `@awc-ui/core`, which
 * drags Stencil's lazy loader into the bundle — and a bundled loader resolves
 * its entry chunks relative to its own location, so it would look for them
 * under `/showcase/credit-risk/react/assets/`, where Vite never wrote them.
 * Changing bundlers changes the directory in that sentence and nothing else:
 * it was `/_next/static/…` in the Next build, and it was measured on the docs
 * site before that (see `scripts/sync-runtime.mjs`). That is why the components
 * arrive from a static `<script type="module">` instead.
 *
 * The tags are listed one by one rather than behind a `` `md-${string}` ``
 * pattern index signature: TypeScript resolves an intrinsic element by exact
 * property lookup and ignores pattern signatures here, so the pattern compiles
 * but every tag still errors. A bare `[tag: string]: any` would work and would
 * also switch off typo checking for every real HTML element in the app, which is
 * too high a price.
 *
 * Props are typed loosely on purpose. The authority for every prop name is
 * the component's own readme under `packages/core/src/components`, not a mirror
 * that would silently rot against it. Object-valued props (`series`, `nodes`,
 * `data`) have no attribute form at all and are assigned through refs — see
 * `components/elements.tsx`.
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
      'md-badge': CE;
      'md-divider': CE;
      'md-status-dot': CE;
      'md-meter': CE;

      /* charts */
      'md-sparkline': CE;
      'md-bar-chart': CE;
      'md-line-chart': CE;
      'md-area-chart': CE;
      'md-organization-chart': CE;

      /* navigation */
      'md-tabs': CE;
      'md-tab': CE;
      'md-tab-panels': CE;
      'md-tab-panel': CE;
      'md-breadcrumbs': CE;
      'md-breadcrumb-item': CE;

      /* tables */
      'md-table-container': CE;
      'md-table': CE;
      'md-table-head': CE;
      'md-table-body': CE;
      'md-table-foot': CE;
      'md-table-row': CE;
      'md-table-cell': CE;
      'md-table-sort-label': CE;
      'md-table-pagination': CE;

      /* inputs */
      'md-segmented-button-set': CE;
      'md-segmented-button': CE;
      'md-select': CE;
      'md-select-option': CE;

      /* the showcase kit's own control bar */
      'awc-showcase-dock': CE;
    }
  }
}

export {};
