<script lang="ts">
  import type { ProfileSummary } from '@awc-ui/showcase-kit/community';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Media from '$lib/bits/Media.svelte';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  export let summary: ProfileSummary;
</script>

{#if summary.photos.length > 0}
  <Panel title={$t('community.panel.photos')}>
    <svelte:fragment slot="actions"><Count value={summary.photos.length} /></svelte:fragment>
    <div class="photo-grid">
      {#each summary.photos as photo (photo.media.id)}
        <Drill
          linkClass="photo-grid__cell"
          href={route.post(photo.postId)}
          aria-label={$t(photo.media.altKey)}
        >
          <Media media={photo.media} />
        </Drill>
      {/each}
    </div>
  </Panel>
{/if}
