<script>
  import '@awc-ui/core/css/tokens.css';
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { toast, notify } from '$lib/toast.js';

  let snackEl;

  // Client-only: register the custom elements so the server DSD hydrates.
  onMount(() => {
    let unsub;
    (async () => {
      const { defineCustomElements } = await import('@awc-ui/core/loader');
      defineCustomElements(window);
      unsub = toast.subscribe((t) => {
        if (t && snackEl && typeof snackEl.show === 'function') {
          snackEl.message = t.message;
          snackEl.show();
        }
      });
    })();
    return () => unsub && unsub();
  });

  const createLabels = {
    'New task': 'Task added to the Backlog column',
    'New milestone': 'Milestone pinned to the Alpenglow 2.4 roadmap',
    'New note': 'Note saved to the sprint journal',
  };

  function onQuickCreate(e) {
    const label = e.target && e.target.label;
    notify(createLabels[label] || 'Item created');
  }

  $: path = $page.url.pathname;
</script>

<header class="topbar">
  <div class="brand">
    <span class="brand-mark" aria-hidden="true">CA</span>
    <div class="brand-text">
      <span class="brand-name">Cairn</span>
      <span class="brand-sub">Fernline Software · Alpenglow 2.4</span>
    </div>
  </div>
  <nav class="nav" aria-label="Main">
    <a href="/" class="nav-link" aria-current={path === '/' ? 'page' : undefined}>Tasks</a>
    <a href="/sprint" class="nav-link" aria-current={path === '/sprint' ? 'page' : undefined}>Sprint</a>
  </nav>
</header>

<slot />

<md-fab
  id="cairn-create-fab"
  icon="add"
  aria-label="Quick create"
  class="create-fab"
></md-fab>

<md-fab-menu anchor="cairn-create-fab" placement="up" menu-label="Quick create" on:mdClick={onQuickCreate}>
  <md-fab-menu-item icon="task_alt" label="New task"></md-fab-menu-item>
  <md-fab-menu-item icon="flag" label="New milestone"></md-fab-menu-item>
  <md-fab-menu-item icon="edit_note" label="New note"></md-fab-menu-item>
</md-fab-menu>

<md-snackbar bind:this={snackEl} closeable></md-snackbar>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--md-sys-spacing-gap-lg);
    padding: var(--md-sys-spacing-inset-md) var(--md-sys-spacing-inset-xl);
    background: var(--md-sys-color-surface-container);
    border-block-end: 1px solid var(--md-sys-color-outline-variant);
    position: sticky;
    inset-block-start: 0;
    z-index: var(--md-sys-z-index-app-bar);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--md-sys-spacing-gap-md);
  }

  .brand-mark {
    display: grid;
    place-items: center;
    inline-size: 40px;
    block-size: 40px;
    border-radius: var(--md-sys-shape-corner-medium);
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    font: var(--md-sys-typescale-title-medium-font);
  }

  .brand-text {
    display: flex;
    flex-direction: column;
  }

  .brand-name {
    font: var(--md-sys-typescale-title-large-font);
  }

  .brand-sub {
    font: var(--md-sys-typescale-label-medium-font);
    color: var(--md-sys-color-on-surface-variant);
  }

  .nav {
    display: flex;
    gap: var(--md-sys-spacing-gap-sm);
  }

  .nav-link {
    text-decoration: none;
    font: var(--md-sys-typescale-label-large-font);
    color: var(--md-sys-color-on-surface-variant);
    padding: 8px 20px;
    border-radius: var(--md-sys-shape-corner-full);
    transition: background var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
  }

  .nav-link:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .nav-link[aria-current='page'] {
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
  }

  .create-fab {
    position: fixed;
    inset-block-end: 24px;
    inset-inline-end: 24px;
    z-index: var(--md-sys-z-index-navigation);
  }
</style>
