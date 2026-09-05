/**
 * Friends — the screen the bidirectional graph exists for.
 *
 * FOUR SECTIONS IN ONE ORDER: requests waiting on you, requests you are waiting
 * on, suggestions, then everyone. That order is not alphabetical or by size, it
 * is by WHO IS BLOCKED: a request waiting on the reader is the only thing on
 * this screen somebody else cannot proceed without.
 *
 * A REQUEST HAS TWO BUTTONS, NOT A TOGGLE, and this is where `Friendship`'s
 * five values earn themselves. Accept and Decline are different outcomes, not
 * two positions of one control — and the incoming and outgoing states are the
 * same pending relationship from opposite ends, so they get opposite verbs and
 * live in different sections.
 */

import {
  getFriends,
  getOutgoing,
  getRequests,
  getSuggestions,
  getTotals,
} from '@awc-ui/showcase-kit/community';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { FriendsSkeleton } from '@/components/skeletons';
import { Avatar, Count, FriendButton, PersonLink } from '@/components/bits';
import { Snackbar, useSnackbar } from './Snackbar';

/** Name, mutuals and whatever control the section puts beside them. */
function PersonRow({
  person,
  children,
}: {
  person: Parameters<typeof PersonLink>[0]['person'];
  children?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="person-row" data-person={person.id}>
      <PersonLink person={person}>
        <Avatar person={person} size="medium" />
      </PersonLink>
      <span className="person-row__text">
        <PersonLink person={person} />
        <span className="person-row__meta">
          {person.mutualCount === 1
            ? t('community.count.mutualOne')
            : t('community.count.mutual', { count: t.formatNumber(person.mutualCount) })}
        </span>
        {children}
      </span>
    </div>
  );
}

export function FriendsScreen() {
  const t = useT();
  const totals = getTotals();
  const { friendshipFor, setFriendship } = useEngagement();
  const { message, say, close } = useSnackbar();

  /*
   * THE FOUR LISTS ARE THE FIXTURE'S, AND THE OVERRIDES ARE APPLIED OVER THEM
   * RATHER THAN RE-BUCKETING.
   *
   * Re-deriving the sections from the current state on every render was the
   * first version, and it made a row VANISH the instant it was acted on:
   * accepting a request moved that person out of `requests` and into `friends`
   * mid-press, so the button the reader had just hit disappeared under their
   * cursor and the list jumped. A row that has been acted on stays where it is
   * and changes what it says — which is what every product of this shape does,
   * and the only version that does not move the target.
   */
  const requests = getRequests();
  const outgoing = getOutgoing();
  const suggestions = getSuggestions(6);
  const friends = getFriends();

  return (
    <Screen
      title={t('community.screen.friends.title')}
      subtitle={t('community.screen.friends.subtitle')}
      aside={<Count value={totals.friendCount} />}
      skeleton={<FriendsSkeleton />}
    >
      <Panel
        title={t('community.panel.requests')}
        actions={totals.requestCount > 0 ? <Count value={totals.requestCount} /> : undefined}
      >
        {requests.length === 0 ? (
          <EmptyState message={t('community.empty.requests')} />
        ) : (
          <div className="person-grid">
            {requests.map((person) => {
              const state = friendshipFor(person);
              return (
                <PersonRow key={person.id} person={person}>
                  {state === 'incoming' ? (
                    <span className="request-actions">
                      <md-button
                        variant="filled"
                        size="sm"
                        onClick={() => {
                          setFriendship(person, 'friend');
                          say('community.msg.friendAccepted', { name: person.displayName });
                        }}
                      >
                        {t('community.action.accept')}
                      </md-button>
                      <md-button
                        variant="outlined"
                        size="sm"
                        onClick={() => {
                          setFriendship(person, 'none');
                          say('community.msg.friendDeclined', { name: person.displayName });
                        }}
                      >
                        {t('community.action.decline')}
                      </md-button>
                    </span>
                  ) : (
                    /* Answered. The row stays and states the outcome rather
                       than disappearing under the reader's hand. */
                    <span className="person-row__meta">{t(`community.friendship.${state}`)}</span>
                  )}
                </PersonRow>
              );
            })}
          </div>
        )}
      </Panel>

      {outgoing.length > 0 ? (
        <Panel title={t('community.panel.outgoing')} actions={<Count value={outgoing.length} />}>
          <div className="person-grid">
            {outgoing.map((person) => (
              <PersonRow key={person.id} person={person}>
                <span className="request-actions">
                  <FriendButton
                    person={person}
                    state={friendshipFor(person)}
                    onAct={(next) => {
                      setFriendship(person, next);
                      say(
                        next === 'none'
                          ? 'community.msg.requestCancelled'
                          : 'community.msg.friendRequested',
                        { name: person.displayName },
                      );
                    }}
                  />
                </span>
              </PersonRow>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title={t('community.panel.suggested')} actions={<Count value={suggestions.length} />}>
        <div className="person-grid">
          {suggestions.map((person) => (
            <PersonRow key={person.id} person={person}>
              <span className="request-actions">
                <FriendButton
                  person={person}
                  state={friendshipFor(person)}
                  onAct={(next) => {
                    setFriendship(person, next);
                    say(
                      next === 'outgoing'
                        ? 'community.msg.friendRequested'
                        : 'community.msg.requestCancelled',
                      { name: person.displayName },
                    );
                  }}
                />
              </span>
            </PersonRow>
          ))}
        </div>
      </Panel>

      <Panel title={t('community.panel.allFriends')} actions={<Count value={friends.length} />}>
        {friends.length === 0 ? (
          <EmptyState message={t('community.empty.friends')} hint={t('community.empty.friendsHint')} />
        ) : (
          <div className="person-grid">
            {friends.map((person) => (
              <PersonRow key={person.id} person={person}>
                <span className="request-actions">
                  <FriendButton
                    person={person}
                    state={friendshipFor(person)}
                    onAct={(next) => {
                      setFriendship(person, next);
                      say('community.msg.friendRemoved', { name: person.displayName });
                    }}
                  />
                </span>
              </PersonRow>
            ))}
          </div>
        )}
      </Panel>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
