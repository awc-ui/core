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

import { useState } from 'react';
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
  const { isFollowing, setFollowing } = useEngagement();
  const { message, say, close } = useSnackbar();
  const [shown, setShown] = useState(FEED_PAGE);

  const items = feedItems();
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
      <StoryRail rings={rail} />

      <div className="feed-layout">
        <div className="feed">
          {visible.length === 0 ? (
            <EmptyState message={t('social.empty.feed')} hint={t('social.empty.feedHint')} />
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
            <div className="feed__end">
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
