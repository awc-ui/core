/**
 * The header and the grid, shared by the two profile screens.
 *
 * YOUR PROFILE AND SOMEONE ELSE'S ARE THE SAME SCREEN with two differences: the
 * follow button, and which tabs exist. Written twice they would drift on the
 * third change; written once, the differences are two props and are visible
 * side by side here.
 */

import type { ReactNode } from 'react';
import { getTotals, type Person, type Post, type ProfileSummary } from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { Avatar, Count, Media, AccountKindChip, Verified } from '@/components/bits';
import { Panel } from '@/components/Shell';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { postKindIcon } from '@awc-ui/showcase-kit/social';

/**
 * The header: portrait, name, three counts, bio.
 *
 * THE THREE COUNTS ARE EXACT, not compact. A follower total is a number people
 * check — "1.2K followers" on an account with 1,180 is a figure its owner would
 * dispute — which is exactly the distinction `countOptions` draws and the
 * reason `<Count exact>` exists.
 */
export function ProfileHeader({
  summary,
  action,
}: {
  summary: ProfileSummary;
  /** The follow button, or nothing on your own profile. */
  action?: ReactNode;
}) {
  const t = useT();
  const { person, posts, likes } = summary;

  return (
    <Panel>
      <div className="profile-head">
        <Avatar person={person} size="large" ring />

        <div className="profile-head__text">
          <div className="profile-head__names">
            <h2 className="profile-head__name">
              {person.displayName}
              <Verified person={person} />
            </h2>
            <span className="profile-head__handle">@{person.handle}</span>
            <AccountKindChip person={person} />
          </div>

          <dl className="stat-row">
            <div>
              <dt>{t('social.count.posts')}</dt>
              <dd>
                <Count value={posts.length} exact />
              </dd>
            </div>
            <div>
              <dt>{t('social.count.followers')}</dt>
              <dd>
                <Count value={person.followerCount} exact />
              </dd>
            </div>
            <div>
              <dt>{t('social.count.following')}</dt>
              <dd>
                <Count value={person.followingCount} exact />
              </dd>
            </div>
            <div>
              <dt>{t('social.count.likes')}</dt>
              <dd>
                <Count value={likes} />
              </dd>
            </div>
          </dl>

          <p className="profile-head__bio">{t(person.bioKey)}</p>
          {person.locationKey ? (
            <p className="muted profile-head__place">
              <span className="material-symbols-outlined" aria-hidden="true">
                place
              </span>
              {t(person.locationKey)}
            </p>
          ) : null}
        </div>

        {action ? <div className="profile-head__action">{action}</div> : null}
      </div>

      {summary.topTopics.length > 0 ? (
        <div className="row">
          <span className="muted">{t('social.panel.topics')}</span>
          {summary.topTopics.map((topic) => (
            <md-chip
              key={topic.id}
              variant="assist"
              appearance="outlined"
              color="secondary"
              icon={topic.icon}
              label={t(topic.labelKey)}
            />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

/**
 * A square grid of posts, three across.
 *
 * PINNED POSTS LEAD, and they say so with a badge — otherwise a grid ordered by
 * anything but date looks like a grid that has lost its order. The ordering
 * itself is `getPersonPosts()` in the kit, so all five builds pin the same two.
 */
export function PostGrid({ posts, empty }: { posts: Post[]; empty: ReactNode }) {
  const t = useT();
  if (posts.length === 0) return <>{empty}</>;

  return (
    <ul className="post-grid">
      {posts.map((post) => {
        const badge = postKindIcon[post.kind];
        return (
          <li key={post.id} className="post-grid__cell">
            <Link
              className="post-grid__link"
              href={route.post(post.id)}
              aria-label={t(post.media[0].altKey)}
            >
              <Media media={post.media[0]} className="post-grid__img" />
              {post.pinned ? (
                <span className="post-grid__pin on-media">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    push_pin
                  </span>
                  {t('social.hint.gridSpan')}
                </span>
              ) : null}
              {badge ? (
                <span className="post-grid__badge on-media material-symbols-outlined" aria-hidden="true">
                  {badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
