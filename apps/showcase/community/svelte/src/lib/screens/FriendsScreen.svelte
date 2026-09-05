<!--
  FOUR SECTIONS IN ONE ORDER: requests waiting on you, requests you are waiting
  on, suggestions, then everyone — by WHO IS BLOCKED.

  THE FOUR LISTS ARE THE FIXTURE'S AND THE OVERRIDES ARE APPLIED OVER THEM.
  Re-deriving them from current state made a row VANISH the instant it was acted
  on. A row that has been acted on stays where it is and changes what it says.
-->
<script lang="ts">
  import {
    getFriends,
    getOutgoing,
    getRequests,
    getSuggestions,
    getTotals,
  } from '@awc-ui/showcase-kit/community';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import FriendsSkeleton from '$lib/skeletons/FriendsSkeleton.svelte';
  import Count from '$lib/bits/Count.svelte';
  import FriendButton from '$lib/bits/FriendButton.svelte';
  import PersonRow from './PersonRow.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';
  import { friendshipFor, friendships, setFriendship } from '$lib/engagement';
  import { t } from '$lib/showcase';

  const totals = getTotals();
  const requests = getRequests();
  const outgoing = getOutgoing();
  const suggestions = getSuggestions(6);
  const friends = getFriends();
  const { message, say, close } = createSnackbar();
</script>

<Screen
  title={$t('community.screen.friends.title')}
  subtitle={$t('community.screen.friends.subtitle')}
>
  <svelte:fragment slot="skeleton"><FriendsSkeleton /></svelte:fragment>
  <svelte:fragment slot="aside"><Count value={totals.friendCount} /></svelte:fragment>

  <Panel title={$t('community.panel.requests')}>
    <svelte:fragment slot="actions">
      {#if totals.requestCount > 0}<Count value={totals.requestCount} />{/if}
    </svelte:fragment>
    {#if requests.length === 0}
      <EmptyState message={$t('community.empty.requests')} />
    {:else}
      <div class="person-grid">
        {#each requests as person (person.id)}
          <PersonRow {person}>
            {#if friendshipFor($friendships, person) === 'incoming'}
              <span class="request-actions">
                <md-button
                  variant="filled"
                  size="sm"
                  on:mdClick={() => {
                    setFriendship(person, 'friend');
                    say('community.msg.friendAccepted', { name: person.displayName });
                  }}
                >
                  {$t('community.action.accept')}
                </md-button>
                <md-button
                  variant="outlined"
                  size="sm"
                  on:mdClick={() => {
                    setFriendship(person, 'none');
                    say('community.msg.friendDeclined', { name: person.displayName });
                  }}
                >
                  {$t('community.action.decline')}
                </md-button>
              </span>
            {:else}
              <!-- Answered. The row states the outcome rather than disappearing
                   under the reader's hand. -->
              <span class="person-row__meta"
                >{$t(`community.friendship.${friendshipFor($friendships, person)}`)}</span
              >
            {/if}
          </PersonRow>
        {/each}
      </div>
    {/if}
  </Panel>

  {#if outgoing.length > 0}
    <Panel title={$t('community.panel.outgoing')}>
      <svelte:fragment slot="actions"><Count value={outgoing.length} /></svelte:fragment>
      <div class="person-grid">
        {#each outgoing as person (person.id)}
          <PersonRow {person}>
            <span class="request-actions">
              <FriendButton
                {person}
                state={friendshipFor($friendships, person)}
                on:act={(e) => {
                  setFriendship(person, e.detail);
                  say(
                    e.detail === 'none'
                      ? 'community.msg.requestCancelled'
                      : 'community.msg.friendRequested',
                    { name: person.displayName },
                  );
                }}
              />
            </span>
          </PersonRow>
        {/each}
      </div>
    </Panel>
  {/if}

  <Panel title={$t('community.panel.suggested')}>
    <svelte:fragment slot="actions"><Count value={suggestions.length} /></svelte:fragment>
    <div class="person-grid">
      {#each suggestions as person (person.id)}
        <PersonRow {person}>
          <span class="request-actions">
            <FriendButton
              {person}
              state={friendshipFor($friendships, person)}
              on:act={(e) => {
                setFriendship(person, e.detail);
                say(
                  e.detail === 'outgoing'
                    ? 'community.msg.friendRequested'
                    : 'community.msg.requestCancelled',
                  { name: person.displayName },
                );
              }}
            />
          </span>
        </PersonRow>
      {/each}
    </div>
  </Panel>

  <Panel title={$t('community.panel.allFriends')}>
    <svelte:fragment slot="actions"><Count value={friends.length} /></svelte:fragment>
    {#if friends.length === 0}
      <EmptyState
        message={$t('community.empty.friends')}
        hint={$t('community.empty.friendsHint')}
      />
    {:else}
      <div class="person-grid">
        {#each friends as person (person.id)}
          <PersonRow {person}>
            <span class="request-actions">
              <FriendButton
                {person}
                state={friendshipFor($friendships, person)}
                on:act={(e) => {
                  setFriendship(person, e.detail);
                  say('community.msg.friendRemoved', { name: person.displayName });
                }}
              />
            </span>
          </PersonRow>
        {/each}
      </div>
    {/if}
  </Panel>

  <SnackbarHost message={$message} on:close={close} />
</Screen>
