<!-- THERE IS NO PRESENCE AND NO "ACTIVE NOW" DOT: nobody is online, there is no
     socket, and a green dot that is always on says something false about a
     person. The block is a contact list and is labelled as one. -->
<script lang="ts">
  import { rightRail } from '@awc-ui/showcase-kit/community';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import EventRailRow from './EventRailRow.svelte';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';

  const rail = rightRail();
</script>

{#if rail.birthdays.length > 0}
  <Panel title={$t('community.panel.birthdays')}>
    <div class="rail-block">
      {#each rail.birthdays as person (person.id)}
        <Drill linkClass="rail-row" href={route.person(person.handle)}>
          <span class="material-symbols-outlined" aria-hidden="true">cake</span>
          <span class="rail-row__text">
            <span class="rail-row__name">{person.displayName}</span>
          </span>
        </Drill>
      {/each}
      <span class="rail-row__meta">{$t('community.hint.birthdayToday')}</span>
    </div>
  </Panel>
{/if}

{#if rail.events.length > 0}
  <Panel title={$t('community.panel.upcoming')}>
    <div class="rail-block">
      {#each rail.events as event (event.id)}
        <EventRailRow {event} />
      {/each}
    </div>
  </Panel>
{/if}

<Panel title={$t('community.panel.contacts')}>
  <div class="rail-block">
    {#each rail.contacts as person (person.id)}
      <Drill linkClass="rail-row" href={route.person(person.handle)}>
        <Avatar {person} size="small" />
        <span class="rail-row__text">
          <span class="rail-row__name">{person.displayName}</span>
        </span>
      </Drill>
    {/each}
  </div>
</Panel>
