/**
 * Activity — what happened to you, newest first.
 *
 * GROUPED BY AGE, NOT PAGED. Four buckets from the kit — today, this week, this
 * month, earlier — and empty ones are dropped rather than rendered as a heading
 * over nothing. A notification list is read by recency and nothing else, so age
 * is the only structure worth imposing.
 *
 * THE SENTENCE IS A TRANSLATED TEMPLATE, not a name concatenated with a verb.
 * `{name} liked your post` is one dictionary entry per kind, so Arabic puts the
 * verb where Arabic puts the verb — building it here from a name and a label
 * would have hard-coded English word order into all three locales.
 *
 * READ AND UNREAD ARE BOTH IN THE LIST. Marking everything read is one button,
 * and it changes the badge in the rail. Filtering the read ones out would make
 * the button look like it deleted them.
 */

import { useState } from 'react';
import { activityGroups, getTotals } from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { EmptyState, Panel, Screen } from '@/components/Shell';
import { ActivityIcon, Avatar, Count, Media, When } from '@/components/bits';
import { PanelSkeleton } from '@/components/skeletons';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';

export function ActivityScreen() {
  const t = useT();
  const totals = getTotals();
  const groups = activityGroups();

  /* Read state is the screen's own override on top of the fixture, exactly as
     a like is — and it is NOT hoisted into the engagement provider, because
     unlike a like it means nothing anywhere else in the app. */
  const [allRead, setAllRead] = useState(false);
  const unread = allRead ? 0 : totals.unreadActivityCount;

  return (
    <Screen
      title={t('social.screen.activity.title')}
      subtitle={t('social.screen.activity.subtitle')}
      aside={unread > 0 ? <Count value={unread} /> : undefined}
      actions={
        unread > 0 ? (
          <md-button variant="text" size="sm" icon="done_all" onClick={() => setAllRead(true)}>
            {t('social.action.markAllRead')}
          </md-button>
        ) : undefined
      }
      skeleton={<PanelSkeleton height="560px" lines={10} />}
    >
      {groups.length === 0 ? (
        <EmptyState message={t('social.empty.activity')} />
      ) : (
        groups.map((group) => (
          <Panel
            key={group.bucket}
            title={t(group.labelKey)}
            actions={<Count value={group.rows.length} />}
          >
            <md-list
              label={t(group.labelKey)}
              interaction-mode="multi-action"
              list-style="segmented"
            >
              {group.rows.map(({ activity, actor, post }) => (
                <md-list-item
                  key={activity.id}
                  /* The unread mark is a data attribute driving a rule in
                     app.css, not a colour prop: `md-list-item` has no "unread"
                     state, and a bolder row is a better carrier than a tint
                     that a reader has to compare against its neighbours. */
                  data-unread={!activity.read && !allRead ? '' : undefined}
                  headline={t(`social.activity.${activity.kind}`, { name: actor.displayName })}
                  supporting-text={`@${actor.handle}`}
                  lines="2"
                >
                  <span slot="leading" className="activity-leading">
                    <Avatar person={actor} size="small" />
                    <ActivityIcon kind={activity.kind} />
                  </span>
                  <span slot="trailing" className="activity-trailing">
                    <When at={activity.at} />
                    {/* A follow has no post to show, so the thumbnail slot is
                        genuinely empty rather than filled with a placeholder. */}
                    {post ? (
                      <Link className="activity-thumb" href={route.post(post.id)}>
                        <Media media={post.media[0]} className="activity-thumb__img" />
                      </Link>
                    ) : null}
                  </span>
                </md-list-item>
              ))}
            </md-list>
          </Panel>
        ))
      )}
    </Screen>
  );
}
