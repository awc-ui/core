<!--
  `<awc-showcase-dock>` — the same bar on every screen.

  The registration is a dynamic import in `onMount` rather than a top-level one.
  The module defines the element and immediately stamps the persisted/URL state
  onto <html>, and it is not on the critical path for the first paint — the
  preboot script in `index.html` has already applied lang / dir / theme /
  density by then. Deferring it keeps ~30 kB out of the entry chunk that the
  screens are waiting on. Nothing here listens for `awc-showcase-change`;
  `$lib/showcase` owns the single subscription, and a second listener would
  update every screen twice per change.

  `frameworks` is the kit's list for THIS vertical — five ids, not the
  credit-risk console's ten, and all five are built. The switcher renders the
  roster because it belongs to the route table, not to whichever ports happen
  to exist this week.

  `base-path` is the prefix BEFORE the framework segment, not this app's own
  `BASE_PATH` — the dock swaps this build's segment for another inside the path
  it finds, and only falls back to `base-path` when the current segment is not
  in the URL.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '$lib/routes';
  import { t } from '$lib/showcase';

  onMount(() => {
    import('@awc-ui/showcase-kit/dock');
  });
</script>

<!--
  `label` IS REQUIRED HERE, even though it looks optional.

  The dock falls back to `t('app.title')` for its own heading, and that key
  belongs to the first vertical — so an unlabelled dock in this app announces
  itself as "Credit Risk Console" under a Vela app. It is a shared
  component with one fallback and two consumers; naming it is the consumer's
  job.
-->
<awc-showcase-dock
  frameworks={FRAMEWORKS.join(',')}
  framework={FRAMEWORK}
  base-path={SHOWCASE_BASE}
  position="bottom"
  label={$t('social.app.title')}
></awc-showcase-dock>
