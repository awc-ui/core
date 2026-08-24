<!--
  `<awc-showcase-dock>` — the same bar on every screen.

  The registration is a client-only dynamic import rather than a top-level one:
  the module defines the element and, in the browser, immediately stamps the
  persisted/URL state onto <html>. It is a no-op in Node, so importing it at the
  top would be harmless — but keeping it in `onMount` says out loud that nothing
  the server renders depends on it. Nothing here listens for
  `awc-showcase-change`; `$lib/showcase` owns the single subscription, and a
  second listener would update every screen twice per change.

  `base-path` is the prefix BEFORE the framework segment, not this app's
  SvelteKit `base` — the dock swaps `sveltekit` for `vue` inside the path it
  finds, and only falls back to `base-path` when the current segment is not in
  the URL.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '$lib/routes';

  onMount(() => {
    import('@awc-ui/showcase-kit/dock');
  });
</script>

<awc-showcase-dock
  frameworks={FRAMEWORKS.join(',')}
  framework={FRAMEWORK}
  base-path={SHOWCASE_BASE}
  position="bottom"
></awc-showcase-dock>
