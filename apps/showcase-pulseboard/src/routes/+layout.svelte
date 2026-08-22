<script>
  import '@awc-ui/core/css/tokens.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { base } from '$app/paths';

  // Client-only: register the custom elements so the server DSD hydrates.
  onMount(async () => {
    const { defineCustomElements } = await import('@awc-ui/core/loader');
    defineCustomElements(window);
  });

  const destinations = [
    { value: '/', icon: 'monitoring', label: 'Overview' },
    { value: '/funnels', icon: 'filter_alt', label: 'Funnels' },
    { value: '/events', icon: 'stream', label: 'Events' },
  ];

  // SvelteKit does NOT prefix `base` onto in-app hrefs automatically, and
  // `$page.url.pathname` DOES include it — so both directions are handled here.
  $: currentRoute = ($page.url.pathname.slice(base.length).replace(/\/$/, '') || '/');
  $: activeIndex = destinations.findIndex((d) => d.value === currentRoute);
</script>

<div class="shell">
  <md-navigation-rail
    full-height
    label="Pulseboard sections"
    active-index={activeIndex}
    class="rail"
  >
    <span slot="logo" class="brand-mark" aria-hidden="true">P</span>
    {#each destinations as d}
      <md-navigation-rail-tab
        icon={d.icon}
        label={d.label}
        value={d.value}
        href={d.value === '/' ? `${base}/` : `${base}${d.value}/`}
      ></md-navigation-rail-tab>
    {/each}
    <div slot="footer" class="rail-footer">
      <span class="rail-footer-org">Harborlight Labs</span>
    </div>
  </md-navigation-rail>

  <div class="content">
    <slot />
  </div>
</div>

<style>
  :global(body) {
    background: var(--md-sys-color-surface);
    color: var(--md-sys-color-on-surface);
    font: var(--md-sys-typescale-body-medium-font);
    font-family: Roboto, system-ui, sans-serif;
  }

  .shell {
    display: flex;
    min-block-size: 100dvh;
    align-items: stretch;
  }

  .rail {
    position: sticky;
    inset-block-start: 0;
    block-size: 100dvh;
    flex: none;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    inline-size: 40px;
    block-size: 40px;
    border-radius: 12px;
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    font: var(--md-sys-typescale-title-medium-font);
  }

  .rail-footer {
    display: grid;
    place-items: center;
    padding-block-end: 12px;
  }

  .rail-footer-org {
    writing-mode: vertical-rl;
    font: var(--md-sys-typescale-label-small-font);
    color: var(--md-sys-color-on-surface-variant);
    letter-spacing: 0.08em;
  }

  .content {
    flex: 1;
    min-inline-size: 0;
    background: var(--md-sys-color-surface);
  }
</style>
