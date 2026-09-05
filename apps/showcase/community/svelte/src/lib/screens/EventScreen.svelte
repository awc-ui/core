<!-- A PAST EVENT SAYS SO AND KEEPS NO BUTTONS: there is no answering an event
     that has happened. Measured against the REPORTING INSTANT, not the clock,
     so a past event stays past in every screenshot. -->
<script lang="ts">
  import {
    REPORTING_INSTANT,
    RSVP_CHOICES,
    eventSummary,
    getEventBySlug,
    rsvpIcon,
  } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import CoverSkeleton from '$lib/skeletons/CoverSkeleton.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Count from '$lib/bits/Count.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Media from '$lib/bits/Media.svelte';
  import RsvpChip from '$lib/bits/RsvpChip.svelte';
  import TimeText from '$lib/bits/TimeText.svelte';
  import NotFoundScreen from './NotFoundScreen.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { rsvpFor, rsvps, setRsvp } from '$lib/engagement';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';

  export let slug: string;
  const { message, say, close } = createSnackbar();

  $: found = getEventBySlug(slug);
  $: summary = found ? eventSummary(found.id) : null;
  $: rsvp = found ? rsvpFor($rsvps, found) : 'none';
  $: past = found ? Date.parse(found.startsAt) < Date.parse(REPORTING_INSTANT) : false;

  function answer(choice: (typeof RSVP_CHOICES)[number]) {
    if (!found) return;
    const next = rsvp === choice ? 'none' : choice;
    setRsvp(found, next);
    say(
      next === 'going'
        ? 'community.msg.rsvpGoing'
        : next === 'interested'
          ? 'community.msg.rsvpInterested'
          : next === 'declined'
            ? 'community.msg.rsvpDeclined'
            : null,
      { name: found.name },
    );
  }
</script>

{#if !summary}
  <NotFoundScreen />
{:else}
  <Screen
    title={summary.event.name}
    subtitle={$t('community.screen.event.subtitle')}
    crumbLabel={summary.event.name}
  >
    <svelte:fragment slot="skeleton"><CoverSkeleton /></svelte:fragment>
    <svelte:fragment slot="aside"><RsvpChip {rsvp} /></svelte:fragment>

    <div class="columns">
      <div class="columns__main">
        <Panel>
          <Media media={summary.event.cover} className="event-cover" eager />
          <h2 class="profile-head__name">{summary.event.name}</h2>

          <div class="profile-facts">
            <p class="profile-fact">
              <span class="material-symbols-outlined" aria-hidden="true">schedule</span><DateText
                at={summary.event.startsAt}
                format="long"
              />, <TimeText at={summary.event.startsAt} />
              {$t('community.common.to')}
              <TimeText at={summary.event.endsAt} />
            </p>
            <p class="profile-fact">
              <span class="material-symbols-outlined" aria-hidden="true"
                >{summary.event.online ? 'videocam' : 'place'}</span
              >{summary.event.online
                ? $t('community.hint.online')
                : $t(summary.event.placeKey ?? 'community.common.na')}
            </p>
            {#if summary.group}
              <p class="profile-fact">
                <span class="material-symbols-outlined" aria-hidden="true">groups</span><Drill
                  linkClass="post-card__group"
                  href={route.group(summary.group.slug)}>{summary.group.name}</Drill
                >
              </p>
            {/if}
          </div>

          {#if past}
            <p class="muted">{$t('community.hint.eventOver')}</p>
          {:else}
            <div class="row">
              {#each RSVP_CHOICES as choice (choice)}
                <md-button
                  variant={rsvp === choice ? 'filled' : 'outlined'}
                  icon={rsvpIcon[choice]}
                  data-rsvp={choice}
                  data-on={rsvp === choice ? '' : undefined}
                  on:mdClick={() => answer(choice)}
                >
                  {$t(`community.rsvp.${choice}`)}
                </md-button>
              {/each}
            </div>
          {/if}

          <p>{$t(summary.event.descriptionKey)}</p>
        </Panel>
      </div>

      <aside class="columns__rail">
        <Panel title={$t('community.panel.hostedBy')}>
          <Drill linkClass="rail-row" href={route.person(summary.host.handle)}>
            <Avatar person={summary.host} size="medium" />
            <span class="rail-row__text">
              <span class="rail-row__name">{summary.host.displayName}</span>
            </span>
          </Drill>
        </Panel>

        <Panel title={$t('community.panel.attendance')}>
          <dl class="stat-row">
            <div>
              <dt>{$t('community.count.going')}</dt>
              <dd><Count value={summary.event.goingCount} /></dd>
            </div>
            <div>
              <dt>{$t('community.count.interested')}</dt>
              <dd><Count value={summary.event.interestedCount} /></dd>
            </div>
          </dl>
          {#if summary.friendsGoing.length > 0}
            <p class="muted">
              {summary.friendsGoing.length === 1
                ? $t('community.hint.friendsGoingOne')
                : $t('community.hint.friendsGoing', {
                    count: $t.formatNumber(summary.friendsGoing.length),
                  })}
            </p>
            <div class="rail-block">
              {#each summary.friendsGoing as person (person.id)}
                <Drill linkClass="rail-row" href={route.person(person.handle)}>
                  <Avatar {person} size="small" />
                  <span class="rail-row__text">
                    <span class="rail-row__name">{person.displayName}</span>
                  </span>
                </Drill>
              {/each}
            </div>
          {/if}
        </Panel>
      </aside>
    </div>

    <SnackbarHost message={$message} on:close={close} />
  </Screen>
{/if}
