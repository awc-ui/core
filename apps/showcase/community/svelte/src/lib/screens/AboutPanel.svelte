<script lang="ts">
  import type { ProfileSummary } from '@awc-ui/showcase-kit/community';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  export let summary: ProfileSummary;
</script>

<Panel title={$t('community.panel.about')}>
  <div class="profile-facts">
    <p class="profile-fact">{$t(summary.person.bioKey)}</p>
    {#if summary.person.workKey}
      <!-- The glyph and the text are adjacent with no whitespace between them:
           Svelte preserves it, and `.profile-fact` is a block, so a newline
           here renders as a visible space the React port does not have. -->
      <p class="profile-fact">
        <span class="material-symbols-outlined" aria-hidden="true">work</span>{$t(
          summary.person.workKey,
        )}
      </p>
    {/if}
    {#if summary.person.locationKey}
      <p class="profile-fact">
        <span class="material-symbols-outlined" aria-hidden="true">place</span>{$t(
          summary.person.locationKey,
        )}
      </p>
    {/if}
    <p class="profile-fact">
      <span class="material-symbols-outlined" aria-hidden="true">schedule</span>{$t(
        'community.hint.joinedCorvus',
        { date: '' },
      )}<DateText at={summary.person.joinedAt} format="long" />
    </p>
  </div>

  {#if summary.sharedGroups.length > 0}
    <p class="muted">{$t('community.panel.sharedGroups')}</p>
    <div class="row">
      {#each summary.sharedGroups as group (group.id)}
        <Drill linkClass="post-card__group" href={route.group(group.slug)}>{group.name}</Drill>
      {/each}
    </div>
  {/if}
</Panel>
