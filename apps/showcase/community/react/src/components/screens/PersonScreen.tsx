/**
 * Somebody else's profile.
 *
 * THE SAME HEADER, ABOUT PANEL AND TIMELINE AS YOUR OWN, plus a friendship
 * button. The viewer's own handle renders their own screen rather than a
 * read-only copy of it: both URLs resolve — `/people/petra.novak/` is a
 * perfectly reasonable thing to type or be linked — and answering with a page
 * that offered to befriend yourself is the state `friendAction.self` exists to
 * prevent.
 */

import { getPersonByHandle, getViewer, profileSummary } from '@awc-ui/showcase-kit/community';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { EmptyState, Screen } from '@/components/Shell';
import { ProfileSkeleton } from '@/components/skeletons';
import { Count, FriendButton } from '@/components/bits';
import { AboutPanel, PhotoPanel, ProfileHeader } from './ProfileParts';
import { Timeline } from './Timeline';
import { NotFoundScreen } from './NotFoundScreen';
import { ProfileScreen } from './ProfileScreen';
import { Snackbar, useSnackbar } from './Snackbar';

export function PersonScreen({ handle }: { handle: string }) {
  const t = useT();
  const { friendshipFor, setFriendship } = useEngagement();
  const { message, say, close } = useSnackbar();

  const person = getPersonByHandle(handle);
  if (!person) return <NotFoundScreen />;
  if (person.id === getViewer().id) return <ProfileScreen />;

  const summary = profileSummary(person.id);
  const state = friendshipFor(person);

  return (
    <Screen
      title={person.displayName}
      subtitle={t('community.screen.person.subtitle')}
      crumbLabel={person.displayName}
      aside={<Count value={summary.posts.length} />}
      skeleton={<ProfileSkeleton />}
    >
      <div className="columns">
        <div className="columns__main">
          <ProfileHeader
            summary={summary}
            action={
              <FriendButton
                person={person}
                state={state}
                size="md"
                onAct={(next) => {
                  setFriendship(person, next);
                  say(
                    next === 'outgoing'
                      ? 'community.msg.friendRequested'
                      : next === 'friend'
                        ? 'community.msg.friendAccepted'
                        : state === 'friend'
                          ? 'community.msg.friendRemoved'
                          : 'community.msg.requestCancelled',
                    { name: person.displayName },
                  );
                }}
              />
            }
          />
          {summary.posts.length === 0 ? (
            <EmptyState message={t('community.empty.posts')} />
          ) : (
            <Timeline posts={summary.posts} onMessage={say} />
          )}
        </div>
        <aside className="columns__rail">
          <AboutPanel summary={summary} />
          <PhotoPanel summary={summary} />
        </aside>
      </div>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
