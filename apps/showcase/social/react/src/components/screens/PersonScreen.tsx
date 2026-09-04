/**
 * Somebody else's profile. The second of the two drills.
 *
 * THE SAME HEADER AND GRID AS YOUR OWN, plus a follow button and minus the
 * saved and tagged tabs — which are yours, not theirs, and would be either
 * empty or a privacy claim this app is not making.
 *
 * ADDRESSED BY HANDLE, which is what makes the URL of this screen the thing a
 * reader could actually type. The kit's note on `route.person` has the
 * argument; the practical consequence is here, in the lookup.
 */

import { getPersonByHandle, getViewer, profileSummary } from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { Count, FollowButton } from '@/components/bits';
import { PanelSkeleton } from '@/components/skeletons';
import { ProfileHeader, PostGrid } from './ProfileParts';
import { NotFoundScreen } from './NotFoundScreen';
import { ProfileScreen } from './ProfileScreen';
import { Snackbar, useSnackbar } from './Snackbar';

export function PersonScreen({ handle }: { handle: string }) {
  const t = useT();
  const { isFollowing, setFollowing } = useEngagement();
  const { message, say, close } = useSnackbar();

  const person = getPersonByHandle(handle);
  if (!person) return <NotFoundScreen />;

  /*
   * THE VIEWER'S OWN HANDLE RENDERS THEIR OWN SCREEN, rather than a read-only
   * copy of it. Both URLs resolve — `/people/mara.ilves/` is a perfectly
   * reasonable thing to type or to be linked — and answering with a page that
   * offered to follow yourself would be the state `followAction.self` exists to
   * prevent. Delegating is better than duplicating the tabs.
   */
  if (person.id === getViewer().id) return <ProfileScreen />;

  const summary = profileSummary(person.id);
  const following = isFollowing(person);

  return (
    <Screen
      title={person.displayName}
      subtitle={t('social.screen.person.subtitle')}
      crumbLabel={person.displayName}
      aside={<Count value={summary.posts.length} exact />}
      skeleton={<PanelSkeleton height="680px" lines={4} />}
    >
      <ProfileHeader
        summary={summary}
        action={
          <FollowButton
            person={person}
            following={following}
            size="md"
            onToggle={(next) => {
              setFollowing(person, next);
              say(next ? 'social.msg.followed' : 'social.msg.unfollowed', {
                name: person.displayName,
              });
            }}
          />
        }
      />

      <Panel title={t('social.panel.posts')} actions={<Count value={summary.posts.length} exact />}>
        <PostGrid posts={summary.posts} empty={<EmptyState message={t('social.empty.posts')} />} />
      </Panel>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
