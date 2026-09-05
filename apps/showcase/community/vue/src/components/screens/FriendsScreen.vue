<!--
  Friends — the screen the bidirectional graph exists for.

  FOUR SECTIONS IN ONE ORDER: requests waiting on you, requests you are waiting
  on, suggestions, then everyone. That order is by WHO IS BLOCKED: a request
  waiting on the reader is the only thing here somebody else cannot proceed
  without.

  A REQUEST HAS TWO BUTTONS, NOT A TOGGLE. Accept and Decline are different
  outcomes, not two positions of one control.

  THE FOUR LISTS ARE THE FIXTURE'S AND THE OVERRIDES ARE APPLIED OVER THEM.
  Re-deriving the sections from current state made a row VANISH the instant it
  was acted on — accepting moved that person out of `requests` mid-press, so the
  button disappeared under the cursor. A row that has been acted on stays where
  it is and changes what it says.
-->
<script setup lang="ts">
import {
  getFriends,
  getOutgoing,
  getRequests,
  getSuggestions,
  getTotals,
} from '@awc-ui/showcase-kit/community';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import FriendsSkeleton from '~/components/skeletons/FriendsSkeleton.vue';
import Count from '~/components/bits/Count.vue';
import FriendButton from '~/components/bits/FriendButton.vue';
import PersonRow from './PersonRow.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';
import { useEngagement } from '~/composables/useEngagement';
import { useT } from '~/composables/useShowcase';

const t = useT();
const totals = getTotals();
const { friendshipFor, setFriendship } = useEngagement();
const { message, say, close } = useSnackbar();

const requests = getRequests();
const outgoing = getOutgoing();
const suggestions = getSuggestions(6);
const friends = getFriends();
</script>

<template>
  <Screen
    :title="t('community.screen.friends.title')"
    :subtitle="t('community.screen.friends.subtitle')"
  >
    <template #skeleton><FriendsSkeleton /></template>
    <template #aside><Count :value="totals.friendCount" /></template>

    <Panel :title="t('community.panel.requests')">
      <template v-if="totals.requestCount > 0" #actions>
        <Count :value="totals.requestCount" />
      </template>
      <EmptyState v-if="requests.length === 0" :message="t('community.empty.requests')" />
      <div v-else class="person-grid">
        <PersonRow v-for="person in requests" :key="person.id" :person="person">
          <span v-if="friendshipFor(person) === 'incoming'" class="request-actions">
            <md-button
              variant="filled"
              size="sm"
              @click="
                () => {
                  setFriendship(person, 'friend');
                  say('community.msg.friendAccepted', { name: person.displayName });
                }
              "
            >
              {{ t('community.action.accept') }}
            </md-button>
            <md-button
              variant="outlined"
              size="sm"
              @click="
                () => {
                  setFriendship(person, 'none');
                  say('community.msg.friendDeclined', { name: person.displayName });
                }
              "
            >
              {{ t('community.action.decline') }}
            </md-button>
          </span>
          <!-- Answered. The row states the outcome rather than disappearing
               under the reader's hand. -->
          <span v-else class="person-row__meta">{{
            t(`community.friendship.${friendshipFor(person)}`)
          }}</span>
        </PersonRow>
      </div>
    </Panel>

    <Panel v-if="outgoing.length > 0" :title="t('community.panel.outgoing')">
      <template #actions><Count :value="outgoing.length" /></template>
      <div class="person-grid">
        <PersonRow v-for="person in outgoing" :key="person.id" :person="person">
          <span class="request-actions">
            <FriendButton
              :person="person"
              :state="friendshipFor(person)"
              @act="
                (next) => {
                  setFriendship(person, next);
                  say(
                    next === 'none'
                      ? 'community.msg.requestCancelled'
                      : 'community.msg.friendRequested',
                    { name: person.displayName },
                  );
                }
              "
            />
          </span>
        </PersonRow>
      </div>
    </Panel>

    <Panel :title="t('community.panel.suggested')">
      <template #actions><Count :value="suggestions.length" /></template>
      <div class="person-grid">
        <PersonRow v-for="person in suggestions" :key="person.id" :person="person">
          <span class="request-actions">
            <FriendButton
              :person="person"
              :state="friendshipFor(person)"
              @act="
                (next) => {
                  setFriendship(person, next);
                  say(
                    next === 'outgoing'
                      ? 'community.msg.friendRequested'
                      : 'community.msg.requestCancelled',
                    { name: person.displayName },
                  );
                }
              "
            />
          </span>
        </PersonRow>
      </div>
    </Panel>

    <Panel :title="t('community.panel.allFriends')">
      <template #actions><Count :value="friends.length" /></template>
      <EmptyState
        v-if="friends.length === 0"
        :message="t('community.empty.friends')"
        :hint="t('community.empty.friendsHint')"
      />
      <div v-else class="person-grid">
        <PersonRow v-for="person in friends" :key="person.id" :person="person">
          <span class="request-actions">
            <FriendButton
              :person="person"
              :state="friendshipFor(person)"
              @act="
                (next) => {
                  setFriendship(person, next);
                  say('community.msg.friendRemoved', { name: person.displayName });
                }
              "
            />
          </span>
        </PersonRow>
      </div>
    </Panel>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
