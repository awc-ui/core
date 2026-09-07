/**
 * The feed — the screen this app is judged on.
 *
 * POSTS FROM PEOPLE YOU FOLLOW, NEWEST FIRST, and the selection rule is the
 * kit's `getFeed()` rather than this screen's: someone who follows YOU does not
 * thereby appear here, and that asymmetry is the whole reason `Relationship`
 * has four values instead of a boolean.
 *
 * ONE COLUMN, CAPPED. A feed is a column of pictures and it is read at one
 * width; letting it stretch across a 1600px monitor makes every photograph a
 * letterbox. `.feed` caps it and centres it, and the suggestions panel takes
 * the space beside it where there is space to take.
 *
 * IT PAGES BY REVEALING, NOT BY FETCHING. `FEED_PAGE` posts are shown and the
 * rest arrive on a press. There is no infinite scroll and that is deliberate:
 * a scroll handler that appends on intersection is untestable in a parity
 * check, unreachable from a keyboard, and would make the document height —
 * which `verify-showcase-parity` compares across five builds — depend on how
 * far the harness happened to scroll.
 */

import {
  discoveryCopy,
  discoveryCount,
  discoverFeed,
  type DiscoveryFilter,
} from '@awc-ui/showcase-kit/social';
import { useRef, useState } from 'react';
import { useCustomEvent } from '@/components/elements';
import { FEED_PAGE, feedItems, storyRail, suggestedPeople } from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { Avatar, Count, FollowButton } from '@/components/bits';
import { StoryRail } from './StoryRail';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { PanelSkeleton } from '@/components/skeletons';
import { PostCard } from './PostCard';
import { Snackbar, useSnackbar } from './Snackbar';

export function FeedScreen() {
  const t = useT();
  const { isFollowing, setFollowing, isSaved } = useEngagement();
  const { message, say, close } = useSnackbar();
  const [shown, setShown] = useState(FEED_PAGE);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');
  const copy = discoveryCopy(t.locale);
  const allItems = feedItems();
  const items = discoverFeed(allItems, search, filter, t, (item) => isSaved(item.post));
  const searchRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<string>>(searchRef, 'mdInput', (event) => {
    setSearch(event.detail ?? '');
    setShown(FEED_PAGE);
  });
  const visible = items.slice(0, shown);
  const rail = storyRail();
  const suggestions = suggestedPeople(5);

  return (
    <Screen
      title={t('social.screen.feed.title')}
      subtitle={t('social.screen.feed.subtitle')}
      skeleton={<PanelSkeleton height="640px" lines={6} />}
    >
      {/*
        THE STORY RAIL SCROLLS SIDEWAYS, and it is a real overflow container
        rather than a carousel component. Nothing here advances on its own, so a
        carousel's machinery — autoplay, pause, an index announced to AT — would
        all be inert. `StoryRail` hides the scrollbar and adds the two chevrons
        that replace it; the scrolling itself is still the browser's.
      */}
      <section className="discovery-hero" aria-label={copy.eyebrow}>
        <div>
          <span className="discovery-hero__eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="discovery-hero__stat">
          <span className="material-symbols-outlined" aria-hidden="true">
            camera
          </span>
          <strong className="discovery-hero__number">{t.formatNumber(allItems.length)}</strong>
          <span className="discovery-hero__caption">{copy.stat}</span>
        </div>
      </section>

      <StoryRail rings={rail} />

      <div className="feed-layout">
        <div className="feed">
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
                variant={filter === 'saved' ? 'tonal' : 'text'}
                size="sm"
                icon="bookmark"
                aria-pressed={filter === 'saved'}
                onClick={() => {
                  setFilter('saved');
                  setShown(FEED_PAGE);
                }}
              >
                {copy.second}
              </md-button>
              <md-button
                variant={filter === 'carousel' ? 'tonal' : 'text'}
                size="sm"
                icon="view_carousel"
                aria-pressed={filter === 'carousel'}
                onClick={() => {
                  setFilter('carousel');
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
          {visible.length === 0 ? (
            <EmptyState message={copy.empty} hint={copy.hint} />
          ) : (
            visible.map((item, index) => (
              <PostCard
                key={item.post.id}
                item={item}
                /* Only the first decodes eagerly. Everything below the fold is
                   lazy, which is what keeps forty images off the first paint. */
                eager={index === 0}
                onMessage={say}
              />
            ))
          )}

          {shown < items.length ? (
            <div className="feed__more">
              <md-button variant="tonal" icon="expand_more" onClick={() => setShown(items.length)}>
                {t('social.action.viewAll')}
              </md-button>
            </div>
          ) : (
            <div className="feed__end" hidden={items.length === 0}>
              <span className="material-symbols-outlined" aria-hidden="true">
                check_circle
              </span>
              <p className="strong">{t('social.common.caughtUp')}</p>
              <p className="muted">{t('social.common.caughtUpHint')}</p>
            </div>
          )}
        </div>

        {/*
          THE SUGGESTIONS PANEL IS ASIDE CONTENT AND IT SAYS SO. It is not part
          of the feed's reading order — `app.css` moves it below the column on a
          phone rather than above it, because a reader who opened the app came
          for the posts.
        */}
        <aside className="feed-aside">
          <Panel title={t('social.panel.suggested')} actions={<Count value={suggestions.length} />}>
            {/*
              PLAIN ROWS, NOT `md-list-item`. Four text slots and a trailing
              action do not fit in a 340px aside: the handle rendered as a
              truncated small-caps overline and "Follows you" wrapped to three
              lines beside the button. The component was honest about the space
              it had; two lines and a button is what actually fits. `app.css`
              carries the measurement.
            */}
            <div className="stack">
              {suggestions.map((person) => (
                <div key={person.id} className="suggest-row">
                  <Avatar person={person} size="small" />
                  <span className="suggest-row__text">
                    <Link className="suggest-row__name" href={route.person(person.handle)}>
                      {person.displayName}
                    </Link>
                    <span className="suggest-row__meta">{t(person.relationshipKey)}</span>
                  </span>
                  <FollowButton
                    person={person}
                    following={isFollowing(person)}
                    onToggle={(next) => {
                      setFollowing(person, next);
                      say(next ? 'social.msg.followed' : 'social.msg.unfollowed', {
                        name: person.displayName,
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
