/**
 * The feed — the screen this app is judged on.
 *
 * THREE COLUMNS ON A WIDE SCREEN, which is this vertical's signature layout and
 * the thing Lyra has no equivalent of: rail, feed, and a right rail of
 * contacts, birthdays and events. `.columns` in `app.css` carries the
 * measurements and the two breakpoints.
 *
 * POSTS FROM FRIENDS AND FROM GROUPS YOU ARE IN, newest first, and the
 * selection rule is the kit's `feedItems()` rather than this screen's: a
 * stranger's post never appears even inside a group you belong to, which keeps
 * the feed explicable — everything in it is by somebody you know.
 *
 * IT PAGES BY REVEALING, NOT BY FETCHING. `FEED_PAGE` posts are shown and the
 * rest arrive on a press. There is no infinite scroll and that is deliberate: a
 * scroll handler that appends on intersection is untestable in a parity check,
 * unreachable from a keyboard, and would make the document height — which
 * `verify-showcase-parity` compares across five builds — depend on how far the
 * harness happened to scroll.
 */

import { useState } from 'react';
import { FEED_PAGE, feedItems, getViewer } from '@awc-ui/showcase-kit/community';
import { useT } from '@/lib/showcase';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { FeedSkeleton } from '@/components/skeletons';
import { Avatar } from '@/components/bits';
import { PostCard } from './PostCard';
import { RightRail } from './RightRail';
import { Snackbar, useSnackbar } from './Snackbar';
import { Composer } from './Composer';

export function FeedScreen() {
  const t = useT();
  const { message, say, close } = useSnackbar();
  const [shown, setShown] = useState(FEED_PAGE);

  const viewer = getViewer();
  const items = feedItems();
  const visible = items.slice(0, shown);

  return (
    <Screen
      title={t('community.screen.feed.title')}
      subtitle={t('community.screen.feed.subtitle')}
      skeleton={<FeedSkeleton />}
    >
      <div className="columns">
        <div className="columns__main">
          <Panel>
            <Composer viewer={viewer} onMessage={say} />
          </Panel>

          {visible.length === 0 ? (
            <EmptyState message={t('community.empty.feed')} hint={t('community.empty.feedHint')} />
          ) : (
            visible.map((item) => <PostCard key={item.post.id} item={item} onMessage={say} />)
          )}

          {shown < items.length ? (
            <div className="feed__more">
              <md-button variant="tonal" icon="expand_more" onClick={() => setShown(items.length)}>
                {t('community.action.viewAll')}
              </md-button>
            </div>
          ) : (
            <div className="feed__end">
              <span className="material-symbols-outlined" aria-hidden="true">
                check_circle
              </span>
              <p className="strong">{t('community.common.caughtUp')}</p>
              <p className="muted">{t('community.common.caughtUpHint')}</p>
            </div>
          )}
        </div>

        <aside className="columns__rail" aria-label={t('community.panel.contacts')}>
          <RightRail />
        </aside>
      </div>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
