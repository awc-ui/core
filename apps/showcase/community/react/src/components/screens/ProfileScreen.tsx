/**
 * Your own profile.
 *
 * NO FRIENDSHIP BUTTON — `friendAction.self` is `null`, and a screen that had
 * to render "add yourself as a friend" has gone wrong somewhere upstream. The
 * timeline, the about panel and the photo grid are all shared with the person
 * drill; the only thing this screen adds is that it is yours.
 */

import { getViewer, profileSummary } from '@awc-ui/showcase-kit/community';
import { useT } from '@/lib/showcase';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { ProfileSkeleton } from '@/components/skeletons';
import { Count } from '@/components/bits';
import { AboutPanel, PhotoPanel, ProfileHeader } from './ProfileParts';
import { Timeline } from './Timeline';
import { Snackbar, useSnackbar } from './Snackbar';

export function ProfileScreen() {
  const t = useT();
  const { message, say, close } = useSnackbar();
  const summary = profileSummary(getViewer().id);

  return (
    <Screen
      title={t('community.screen.profile.title')}
      subtitle={t('community.screen.profile.subtitle')}
      aside={<Count value={summary.posts.length} />}
      skeleton={<ProfileSkeleton />}
    >
      <div className="columns">
        <div className="columns__main">
          <ProfileHeader summary={summary} />
          <Timeline posts={summary.posts} onMessage={say} />
        </div>
        <aside className="columns__rail">
          <AboutPanel summary={summary} />
          <PhotoPanel summary={summary} />
        </aside>
      </div>

      {summary.posts.length === 0 ? <EmptyState message={t('community.empty.posts')} /> : null}
      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
