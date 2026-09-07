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

import {
  discoveryCopy,
  discoveryCount,
  discoverFeed,
  type DiscoveryFilter,
} from '@awc-ui/showcase-kit/community';
import { useRef, useState } from 'react';
import { useCustomEvent } from '@/components/elements';
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const copy = discoveryCopy(t.locale);
  const allItems = feedItems();
  const items = discoverFeed(allItems, search, filter, t);
  const searchRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string>>(searchRef, 'mdInput', (event) => {
    setSearch(event.detail ?? '');
    setShown(FEED_PAGE);
  });
  const visible = items.slice(0, shown);

  return (
    <Screen
      title={t('community.screen.feed.title')}
      subtitle={t('community.screen.feed.subtitle')}
      skeleton={<FeedSkeleton />}
    >
      <section className="discovery-hero" aria-label={copy.eyebrow}>
        <div>
          <span className="discovery-hero__eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="discovery-hero__stat">
          <span className="material-symbols-outlined" aria-hidden="true">
            diversity_3
          </span>
          <strong className="discovery-hero__number">{t.formatNumber(allItems.length)}</strong>
          <span className="discovery-hero__caption">{copy.stat}</span>
        </div>
      </section>

      <div className="columns">
        <div className="columns__main">
          <div className="discovery-tools">
            <md-text-field ref={searchRef} label={copy.search} value={search}>
              <span slot="leading-icon" className="material-symbols-outlined" aria-hidden="true">
                search
              </span>
            </md-text-field>
            <div className="discovery-tools__filters" role="group" aria-label={copy.eyebrow}>
              <md-button
                variant={filter === 'all' ? 'tonal' : 'text'}
                size="sm"
                icon="auto_awesome"
                aria-pressed={filter === 'all'}
                onClick={() => {
                  setFilter('all');
                  setShown(FEED_PAGE);
                }}
              >
                {copy.all}
              </md-button>
              <md-button
                variant={filter === 'friends' ? 'tonal' : 'text'}
                size="sm"
                icon="people"
                aria-pressed={filter === 'friends'}
                onClick={() => {
                  setFilter('friends');
                  setShown(FEED_PAGE);
                }}
              >
                {copy.second}
              </md-button>
              <md-button
                variant={filter === 'groups' ? 'tonal' : 'text'}
                size="sm"
                icon="groups"
                aria-pressed={filter === 'groups'}
                onClick={() => {
                  setFilter('groups');
                  setShown(FEED_PAGE);
                }}
              >
                {copy.third}
              </md-button>
            </div>
            <div className="discovery-tools__row">
              <p className="discovery-tools__count" role="status">
                {discoveryCount(items.length, t.locale)}
              </p>
              <md-button
                class="discovery-tools__reset"
                size="sm"
                variant="text"
                icon="restart_alt"
                disabled={(!search && filter === 'all') || undefined}
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                  setShown(FEED_PAGE);
                }}
              >
                {copy.clear}
              </md-button>
            </div>
          </div>
          <Panel>
            <Composer viewer={viewer} onMessage={say} />
          </Panel>

          {visible.length === 0 ? (
            <EmptyState message={copy.empty} hint={copy.hint} />
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
            <div className="feed__end" hidden={items.length === 0}>
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
