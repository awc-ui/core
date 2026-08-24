<!--
  No such screen.

  Reached two ways, and the second is the interesting one:

  - a path matching none of the six patterns — a typo, or a link into a route
    this vertical does not have.
  - a route that exists with an id the fixture does not know
    (`/sectors/banana/`). In the SvelteKit build in this pair that was a
    `throw error(404)` in `+page.ts`, and before that it was simply a file the
    prerenderer never wrote. Here there is no server to answer 404 and no file
    to be missing — `App.svelte` looks the id up and renders this instead. The
    check has to live somewhere, because `SectorScreen` and its two siblings do
    `getXById(id) as X` and would dereference `undefined`.

  It reuses `Shell`, so the masthead, the nav and the dock are all still there
  and the reader can leave without the back button. Not one string is written
  here either: `empty.generic` and `empty.hint` are already in the kit's
  dictionary in all three locales, and this build must not need a key the others
  do not have.
-->
<script lang="ts">
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import Shell from '$lib/components/Shell.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
</script>

<Shell title={$t('empty.generic')} subtitle={$t('empty.hint')}>
  <Panel>
    <p class="muted">{$t('empty.generic')}</p>
    <Drill href={route.overview()}>{$t('nav.overview')}</Drill>
  </Panel>
</Shell>
