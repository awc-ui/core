<!--
  Avatar, name, optional group, time and audience.

  TWO SHAPES IN ONE: a plain post says "Ada Lindqvist", a group post says
  "Ada Lindqvist › Nordic Film Club" with both halves linking somewhere
  different. The chevron rather than the word "in" is deliberate; the translated
  "in {group}" string is still used, on the group link's accessible name.
-->
<script lang="ts">
  import type { FeedItem } from '@awc-ui/showcase-kit/community';
  import Drill from '$lib/components/Drill.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import AudienceMark from '$lib/bits/AudienceMark.svelte';
  import PersonName from '$lib/bits/PersonName.svelte';
  import When from '$lib/bits/When.svelte';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';

  export let item: FeedItem;
  export let compact = false;
</script>

<header class="post-card__head">
  <Drill linkClass="post-card__author" href={route.person(item.author.handle)}>
    <Avatar person={item.author} size={compact ? 'small' : 'medium'} />
  </Drill>
  <div class="post-card__names">
    <span class="post-card__in">
      <Drill linkClass="post-card__author" href={route.person(item.author.handle)}>
        <PersonName person={item.author} />
      </Drill>
      {#if item.group}
        <span aria-hidden="true">›</span>
        <Drill
          linkClass="post-card__group"
          href={route.group(item.group.slug)}
          aria-label={$t('community.hint.postedIn', { group: item.group.name })}
        >
          {item.group.name}
        </Drill>
      {/if}
    </span>
    <span class="post-card__meta">
      <Drill linkClass="when" href={route.post(item.post.id)}>
        <When at={item.post.postedAt} />
      </Drill>
      <span aria-hidden="true">·</span>
      <AudienceMark audience={item.post.audience} labelKey={item.post.audienceKey} />
      {#if item.post.pinned}
        <span aria-hidden="true">·</span>
        <span>{$t('community.hint.pinned')}</span>
      {/if}
    </span>
  </div>
</header>
