<!-- The avatar overlaps the cover's lower edge by a negative margin rather than
     absolute positioning — out of flow, the text under it needs a hard-coded
     push that is wrong at every other avatar size. -->
<script lang="ts">
  import type { ProfileSummary } from '@awc-ui/showcase-kit/community';
  import Panel from '$lib/components/Panel.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Media from '$lib/bits/Media.svelte';
  import Verified from '$lib/bits/Verified.svelte';
  import { t } from '$lib/showcase';
  export let summary: ProfileSummary;
</script>

<Panel>
  <div class="profile-head">
    <Media media={summary.person.cover} className="profile-head__cover" eager />
    <div class="profile-head__row">
      <span class="profile-head__avatar">
        <Avatar person={summary.person} size="large" />
      </span>
      <div class="profile-head__text">
        <h2 class="profile-head__name">
          {summary.person.displayName}
          <Verified person={summary.person} />
        </h2>
        <span class="profile-head__handle">@{summary.person.handle}</span>
      </div>
      {#if $$slots.action}
        <div class="profile-head__action"><slot name="action" /></div>
      {/if}
    </div>
  </div>

  <dl class="stat-row">
    <div>
      <dt>{$t('community.count.friends')}</dt>
      <dd><Count value={summary.person.friendCount} /></dd>
    </div>
    <div>
      <dt>{$t('community.count.posts')}</dt>
      <dd><Count value={summary.posts.length} /></dd>
    </div>
    <div>
      <dt>{$t('community.count.reactions')}</dt>
      <dd><Count value={summary.reactionsReceived} compact /></dd>
    </div>
    <!-- Mutuals are only meaningful for somebody else — on your own profile the
         number would be your friend count again. -->
    {#if summary.person.friendship !== 'self'}
      <div>
        <dt>{$t('community.count.mutualLabel')}</dt>
        <dd><Count value={summary.person.mutualCount} /></dd>
      </div>
    {/if}
  </dl>
</Panel>
