/**
 * Your own profile: posts, saved, tagged.
 *
 * THREE TABS, AND `md-tabs` IS THE RIGHT COMPONENT HERE — the one place in this
 * app it is. The house rule is that destinations are a rail or a bar and never
 * tabs; these are not destinations. They are three views of the SAME thing (the
 * viewer's relationship to a set of posts), inside one screen, with one URL,
 * which is exactly what `md-tabs` is specified for.
 *
 * SAVED IS THE ONLY TAB THAT MOVES. Its contents come from the engagement
 * provider rather than the fixture, so a post saved on the feed appears here
 * without a reload — which is the point of hoisting that state above the
 * router.
 */

import { useState } from 'react';
import { getPosts, getViewer, profileSummary } from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { Count } from '@/components/bits';
import { PanelSkeleton } from '@/components/skeletons';
import { ProfileHeader, PostGrid } from './ProfileParts';

type Tab = 'posts' | 'saved' | 'tagged';

export function ProfileScreen() {
  const t = useT();
  const { savedIds } = useEngagement();
  const [tab, setTab] = useState<Tab>('posts');

  const viewer = getViewer();
  const summary = profileSummary(viewer.id);
  const all = getPosts();
  const saved = all.filter((post) => savedIds(all).has(post.id));

  /* Nothing in the fixture models "tagged in" — inventing a field for one tab
     would be data added to serve a layout. The tab exists because a profile has
     one and its empty state is the honest answer. */
  const tagged: typeof all = [];

  const shown = tab === 'posts' ? summary.posts : tab === 'saved' ? saved : tagged;

  return (
    <Screen
      title={t('social.screen.profile.title')}
      subtitle={t('social.screen.profile.subtitle')}
      aside={<Count value={summary.posts.length} exact />}
      skeleton={<PanelSkeleton height="680px" lines={4} />}
    >
      <ProfileHeader summary={summary} />

      <Panel>
        {/* `md-tabs` drives the panel switch through its own `mdTabChange`,
            and the panels are siblings rather than children of the tab strip —
            which is what `md-tab-panels` expects. */}
        <md-tabs
          variant="primary"
          onMdTabChange={(event: any) => setTab((event.detail?.value ?? 'posts') as Tab)}
        >
          <md-tab value="posts" label={t('social.panel.posts')} icon="grid_on" />
          <md-tab value="saved" label={t('social.panel.saved')} icon="bookmark" />
          <md-tab value="tagged" label={t('social.panel.tagged.short')} icon="sell" />
        </md-tabs>

        <PostGrid
          posts={shown}
          empty={
            tab === 'saved' ? (
              <EmptyState message={t('social.empty.saved')} hint={t('social.empty.savedHint')} />
            ) : tab === 'tagged' ? (
              <EmptyState message={t('social.empty.tagged')} />
            ) : (
              <EmptyState message={t('social.empty.posts')} />
            )
          }
        />
      </Panel>
    </Screen>
  );
}
