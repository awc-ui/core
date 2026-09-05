<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { RSVP_CHOICES, rsvpIcon, type CommunityEvent } from '@awc-ui/showcase-kit/community';
  import Drill from '$lib/components/Drill.svelte';
  import Count from '$lib/bits/Count.svelte';
  import RsvpChip from '$lib/bits/RsvpChip.svelte';
  import TimeText from '$lib/bits/TimeText.svelte';
  import EventDate from './EventDate.svelte';
  import { rsvpFor, rsvps, setRsvp } from '$lib/engagement';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';

  export let event: CommunityEvent;
  const dispatch = createEventDispatcher<{
    message: { key: string | null; params?: Record<string, string | number> };
  }>();

  $: rsvp = rsvpFor($rsvps, event);

  function answer(choice: (typeof RSVP_CHOICES)[number]) {
    const next = rsvp === choice ? 'none' : choice;
    setRsvp(event, next);
    dispatch('message', {
      key:
        next === 'going'
          ? 'community.msg.rsvpGoing'
          : next === 'interested'
            ? 'community.msg.rsvpInterested'
            : next === 'declined'
              ? 'community.msg.rsvpDeclined'
              : null,
      params: { name: event.name },
    });
  }
</script>

<div class="event-row" data-event={event.id}>
  <EventDate at={event.startsAt} />
  <div class="event-row__text">
    <Drill linkClass="event-row__name" href={route.event(event.slug)}>{event.name}</Drill>
    <span class="event-row__meta">
      <TimeText at={event.startsAt} />
      <span aria-hidden="true">·</span>
      <span class="material-symbols-outlined" aria-hidden="true"
        >{event.online ? 'videocam' : 'place'}</span
      >
      {event.online ? $t('community.hint.online') : $t(event.placeKey ?? 'community.common.na')}
    </span>
    <!-- `__counts`, not `__meta`: a sentence rather than a row of items, so it
         must not carry the flex gap. -->
    <span class="event-row__counts">
      <Count value={event.goingCount} />
      {$t('community.count.going').toLocaleLowerCase($t.locale)}{event.friendsGoingCount > 0
        ? ` · ${
            event.friendsGoingCount === 1
              ? $t('community.hint.friendsGoingOne')
              : $t('community.hint.friendsGoing', {
                  count: $t.formatNumber(event.friendsGoingCount),
                })
          }`
        : ''}
    </span>
    <span class="row"><RsvpChip {rsvp} /></span>
  </div>

  <!-- THREE CHOICES, NOT FIVE. `invited` is a state somebody else put the
       reader in, and `none` is the absence of an answer rather than one. -->
  <span class="event-row__action row">
    {#each RSVP_CHOICES as choice (choice)}
      <md-icon-button
        icon={rsvpIcon[choice]}
        data-rsvp={choice}
        data-on={rsvp === choice ? '' : undefined}
        color={rsvp === choice ? 'primary' : undefined}
        aria-label={$t(`community.rsvp.${choice}`)}
        aria-pressed={rsvp === choice}
        on:mdClick={() => answer(choice)}
      ></md-icon-button>
    {/each}
  </span>
</div>
