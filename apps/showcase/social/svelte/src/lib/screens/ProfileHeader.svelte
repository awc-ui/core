<!--
  The header, shared by the two profile screens.

  YOUR PROFILE AND SOMEONE ELSE'S ARE THE SAME SCREEN with two differences: the
  follow button, and which tabs exist. Written twice they would drift on the
  third change.

  THE THREE COUNTS ARE EXACT, not compact. A follower total is a number people
  check — "1.2K followers" on an account with 1,180 is a figure its owner would
  dispute — which is the distinction `countOptions` draws.
-->
<script lang="ts">
  import type { ProfileSummary } from '@awc-ui/showcase-kit/social';
  import { t } from '$lib/showcase';
  import Panel from '$lib/components/Panel.svelte';
  import AccountKindChip from '$lib/bits/AccountKindChip.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Verified from '$lib/bits/Verified.svelte';

  export let summary: ProfileSummary;
</script>

<Panel>
  <div class="profile-head">
    <Avatar person={summary.person} size="large" ring />

    <div class="profile-head__text">
      <div class="profile-head__names">
        <h2 class="profile-head__name">
          {summary.person.displayName}
          <Verified person={summary.person} />
        </h2>
        <span class="profile-head__handle">@{summary.person.handle}</span>
        <AccountKindChip person={summary.person} />
      </div>

      <dl class="stat-row">
        <div>
          <dt>{$t('social.count.posts')}</dt>
          <dd><Count value={summary.posts.length} exact /></dd>
        </div>
        <div>
          <dt>{$t('social.count.followers')}</dt>
          <dd><Count value={summary.person.followerCount} exact /></dd>
        </div>
        <div>
          <dt>{$t('social.count.following')}</dt>
          <dd><Count value={summary.person.followingCount} exact /></dd>
        </div>
        <div>
          <dt>{$t('social.count.likes')}</dt>
          <dd><Count value={summary.likes} /></dd>
        </div>
      </dl>

      <p class="profile-head__bio">{$t(summary.person.bioKey)}</p>
      {#if summary.person.locationKey}
        <p class="muted profile-head__place">
          <span class="material-symbols-outlined" aria-hidden="true">place</span>
          {$t(summary.person.locationKey)}
        </p>
      {/if}
    </div>

    {#if $$slots.action}
      <div class="profile-head__action"><slot name="action" /></div>
    {/if}
  </div>

  {#if summary.topTopics.length > 0}
    <div class="row">
      <span class="muted">{$t('social.panel.topics')}</span>
      {#each summary.topTopics as topic (topic.id)}
        <md-chip
          variant="assist"
          appearance="outlined"
          color="secondary"
          icon={topic.icon}
          label={$t(topic.labelKey)}
        ></md-chip>
      {/each}
    </div>
  {/if}
</Panel>
