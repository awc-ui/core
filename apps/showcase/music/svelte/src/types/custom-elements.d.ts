/**
 * Typings for the raw custom elements.
 *
 * This app renders `md-*` tags directly rather than importing a wrapper
 * package. The wrappers are lovely, but every one of them imports
 * `@awc-ui/core`, which drags Stencil's lazy loader into the Vite bundle — and
 * a bundled loader looks for its entry chunks under `assets/`, where the build
 * never wrote them. That is why the components arrive from a classic
 * `<script>` in `index.html` that injects a module one;
 * `scripts/sync-runtime.mjs` has the full post-mortem.
 *
 * TWO THINGS ARE DECLARED HERE, and only two.
 *
 * `svelteHTML.IntrinsicElements` lists the tags — the same list the React
 * build's `src/types/custom-elements.d.ts` carries, plus the two the planning
 * screen adds through its `planning-elements.d.ts` (`md-color-picker`,
 * `md-loading-indicator`). Props are typed loosely on purpose: the authority
 * for every prop name is the component's own readme under
 * `packages/core/src/components`, not a mirror here that would silently rot
 * against it. Object-valued props (`series`, `nodes`, `data`, `items`,
 * `options`) have no attribute form at all and are assigned through the
 * `objectProps` action — see `src/lib/elements.ts`.
 *
 * `HTMLAttributes` gains the library's `md*` events. Svelte's `on:` directive
 * is a real `addEventListener` and works on any element for any event name, but
 * its TYPES only know the standard DOM events — so `on:mdClick` on a plain
 * `<div>` (delegation targets, because the events bubble) is a type error
 * without this. They are declared on HTMLAttributes rather than per-tag
 * precisely because they bubble: the whole point of listening on a container is
 * that the emitter is a descendant.
 */

declare global {
  namespace svelteHTML {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type CE = Record<string, any>;

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
      /** Status & feedback — the brand-consistent indeterminate wait. */
      'md-loading-indicator': CE;

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
      /** Selection — an arbitrary colour. Used by the planning screen. */
      'md-color-picker': CE;

      /* the showcase kit's own control bar */
      'awc-showcase-dock': CE;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface HTMLAttributes<T> {
      /* Navigation + selection. The detail shapes worth typing are typed;
         everything else is the loose CustomEvent the readme documents. */
      'on:mdClick'?: (
        event: CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>,
      ) => void;
      'on:mdSelect'?: (
        event: CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>,
      ) => void;
      'on:mdChange'?: (event: CustomEvent<unknown>) => void;
      'on:mdInput'?: (event: CustomEvent<unknown>) => void;

      /* tables */
      'on:mdSortChange'?: (
        event: CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>,
      ) => void;
      'on:mdPageChange'?: (event: CustomEvent<{ page: number }>) => void;
      'on:mdRowsPerPageChange'?: (event: CustomEvent<{ rowsPerPage: number }>) => void;
      'on:mdRowClick'?: (event: CustomEvent<{ value?: string }>) => void;

      /* charts + org chart */
      'on:mdBarClick'?: (event: CustomEvent<{ dataIndex: number }>) => void;
      'on:mdSelectionChange'?: (event: CustomEvent<unknown>) => void;

      /* search + fields */
      'on:mdSearch'?: (event: CustomEvent<unknown>) => void;
      'on:mdClear'?: (event: CustomEvent<unknown>) => void;
      'on:mdSubmit'?: (event: CustomEvent<unknown>) => void;

      /* open/close surfaces */
      'on:mdOpen'?: (event: CustomEvent<unknown>) => void;
      'on:mdClose'?: (event: CustomEvent<unknown>) => void;
      'on:mdCancel'?: (event: CustomEvent<unknown>) => void;
      'on:mdAction'?: (event: CustomEvent<unknown>) => void;
      'on:mdRemove'?: (event: CustomEvent<unknown>) => void;

      /* app bar, split button, stepper, tabs, rating */
      'on:mdLeadingClick'?: (event: CustomEvent<unknown>) => void;
      'on:mdTrailingClick'?: (event: CustomEvent<unknown>) => void;
      'on:mdStepChange'?: (event: CustomEvent<unknown>) => void;
      'on:mdBeforeChange'?: (event: CustomEvent<unknown>) => void;
      'on:mdComplete'?: (event: CustomEvent<unknown>) => void;
      'on:mdTabChange'?: (event: CustomEvent<unknown>) => void;
    }
  }
}

export {};
