<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { joinAction, type Group } from '@awc-ui/showcase-kit/community';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Media from '$lib/bits/Media.svelte';
  import PrivacyChip from '$lib/bits/PrivacyChip.svelte';
  import RoleChip from '$lib/bits/RoleChip.svelte';
  import { roleFor, roles, setRole } from '$lib/engagement';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';

  export let group: Group;
  const dispatch = createEventDispatcher<{
    message: { key: string | null; params?: Record<string, string | number> };
  }>();

  $: role = roleFor($roles, group);
  $: action = joinAction[role];

  function press() {
    /* Joining a PRIVATE group asks rather than joins — the whole point of the
       privacy flag, and the state `pending` exists to hold. */
    const was = role;
    const next = was === 'none' ? (group.privacy === 'private' ? 'pending' : 'member') : 'none';
    setRole(group, next);
    dispatch('message', {
      key:
        next === 'member'
          ? 'community.msg.joined'
          : next === 'pending'
            ? 'community.msg.requested'
            : was === 'pending'
              ? 'community.msg.requestCancelled'
              : 'community.msg.left',
      params: { name: group.name },
    });
  }
</script>

<Panel>
  <div class="group-card" data-group={group.id}>
    <Drill href={route.group(group.slug)} aria-label={group.name}>
      <Media media={group.cover} className="group-card__cover" />
    </Drill>
    <Drill linkClass="group-card__name" href={route.group(group.slug)}>{group.name}</Drill>
    <div class="row">
      <PrivacyChip {group} />
      <RoleChip {role} />
    </div>
    <p class="group-card__about">{$t(group.descriptionKey)}</p>
    <p class="person-row__meta">
      <Count value={group.memberCount} compact />
      {$t('community.count.members').toLocaleLowerCase($t.locale)}{group.weeklyPostCount > 0
        ? ` · ${
            group.weeklyPostCount === 1
              ? $t('community.count.weeklyPostsOne')
              : $t('community.count.weeklyPosts', {
                  count: $t.formatNumber(group.weeklyPostCount),
                })
          }`
        : ''}
    </p>
    {#if action}
      <md-button variant={action.variant} size="sm" icon={action.icon} on:mdClick={press}>
        {$t(action.labelKey)}
      </md-button>
    {/if}
  </div>
</Panel>
