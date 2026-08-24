/**
 * Typings for the raw custom elements.
 *
 * This app renders `md-*` tags directly rather than importing a wrapper
 * package. The wrappers are lovely, but every one of them imports
 * `@awc-ui/core`, which drags Stencil's lazy loader into the Vite bundle — and
 * a bundled loader looks for its entry chunks under `_app/`, where the build
 * never wrote them. That was measured on the docs site first (see
 * `scripts/sync-runtime.mjs`) and is why the components arrive from a static
 * `<script type="module">`.
 *
 * TWO THINGS ARE DECLARED HERE, and only two.
 *
 * `svelteHTML.IntrinsicElements` lists the tags. Props are typed loosely on
 * purpose: the authority for every prop name is the component's own readme
 * under `packages/core/src/components`, not a mirror here that would silently
 * rot against it. Object-valued props (`series`, `nodes`, `data`) have no
 * attribute form at all and are assigned through the `objectProps` action — see
 * `src/lib/elements.ts`.
 *
 * `HTMLAttributes` gains the library's `md*` events. Svelte's `on:` directive
 * is a real `addEventListener` and works on any element for any event name, but
 * its TYPES only know the standard DOM events — so `on:mdClick` on a plain
 * `<nav>` (which is where the section nav listens, because the event bubbles
 * from the buttons inside it) is a type error without this. They are declared
 * on HTMLAttributes rather than per-tag precisely because they bubble: the
 * whole point of listening on the container is that the emitter is a
 * descendant.
 */

declare global {
  namespace App {}

  namespace svelteHTML {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type CE = Record<string, any>;

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface HTMLAttributes<T> {
      'on:mdClick'?: (event: CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>) => void;
      'on:mdSelect'?: (event: CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>) => void;
      'on:mdSortChange'?: (event: CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>) => void;
      'on:mdPageChange'?: (event: CustomEvent<{ page: number }>) => void;
      'on:mdRowsPerPageChange'?: (event: CustomEvent<{ rowsPerPage: number }>) => void;
      'on:mdBarClick'?: (event: CustomEvent<{ dataIndex: number }>) => void;
      'on:mdChange'?: (event: CustomEvent<unknown>) => void;
    }
  }
}

export {};
