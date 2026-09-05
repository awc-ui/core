/**
 * The header and the panels shared by the two profile screens.
 *
 * YOUR PROFILE AND SOMEBODY ELSE'S ARE THE SAME SCREEN with two differences:
 * the button in the header, and whether "groups you are both in" has anything
 * to say. Written twice they would drift on the third change; written once, the
 * differences are two props and are visible side by side here.
 */

import type { ReactNode } from 'react';
import type { ProfileSummary } from '@awc-ui/showcase-kit/community';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { Panel } from '@/components/Shell';
import { Avatar, Count, DateText, Media, Verified } from '@/components/bits';

/**
 * Cover, avatar, name, counts.
 *
 * THE AVATAR OVERLAPS THE COVER'S LOWER EDGE by a negative margin rather than
 * absolute positioning — see the note on `.profile-head` in `app.css`. Out of
 * flow, the text under it has to be pushed down by a hard-coded amount that is
 * wrong at every other avatar size.
 */
export function ProfileHeader({
  summary,
  action,
}: {
  summary: ProfileSummary;
  /** The friendship button, or nothing on your own profile. */
  action?: ReactNode;
}) {
  const t = useT();
  const { person, posts, reactionsReceived } = summary;

  return (
    <Panel>
      <div className="profile-head">
        <Media media={person.cover} className="profile-head__cover" eager />
        <div className="profile-head__row">
          <span className="profile-head__avatar">
            <Avatar person={person} size="large" />
          </span>
          <div className="profile-head__text">
            <h2 className="profile-head__name">
              {person.displayName}
              <Verified person={person} />
            </h2>
            <span className="profile-head__handle">@{person.handle}</span>
          </div>
          {action ? <div className="profile-head__action">{action}</div> : null}
        </div>
      </div>

      <dl className="stat-row">
        <div>
          <dt>{t('community.count.friends')}</dt>
          <dd>
            <Count value={person.friendCount} />
          </dd>
        </div>
        <div>
          <dt>{t('community.count.posts')}</dt>
          <dd>
            <Count value={posts.length} />
          </dd>
        </div>
        <div>
          <dt>{t('community.count.reactions')}</dt>
          <dd>
            <Count value={reactionsReceived} compact />
          </dd>
        </div>
        {/* Mutuals are only meaningful for somebody else — on your own profile
            the number would be your friend count again. */}
        {person.friendship !== 'self' ? (
          <div>
            {/* ITS OWN LABEL, not the sentence with the number cut out of it.
                `count.mutual` is "{count} mutual friends", and stripping the
                placeholder left a lowercase fragment sitting beside "Friends",
                "Posts" and "Reactions" — and would have left a grammatically
                broken one in Romanian and Arabic, where the words around a
                number inflect with it. */}
            <dt>{t('community.count.mutualLabel')}</dt>
            <dd>
              <Count value={person.mutualCount} />
            </dd>
          </div>
        ) : null}
      </dl>
    </Panel>
  );
}

/** Bio, where they are, what they do, when they joined. */
export function AboutPanel({ summary }: { summary: ProfileSummary }) {
  const t = useT();
  const { person, sharedGroups } = summary;

  return (
    <Panel title={t('community.panel.about')}>
      <div className="profile-facts">
        <p className="profile-fact">{t(person.bioKey)}</p>
        {person.workKey ? (
          <p className="profile-fact">
            <span className="material-symbols-outlined" aria-hidden="true">
              work
            </span>
            {t(person.workKey)}
          </p>
        ) : null}
        {person.locationKey ? (
          <p className="profile-fact">
            <span className="material-symbols-outlined" aria-hidden="true">
              place
            </span>
            {t(person.locationKey)}
          </p>
        ) : null}
        <p className="profile-fact">
          <span className="material-symbols-outlined" aria-hidden="true">
            schedule
          </span>
          {t('community.hint.joinedCorvus', { date: '' })}
          <DateText at={person.joinedAt} style="long" />
        </p>
      </div>

      {sharedGroups.length > 0 ? (
        <>
          <p className="muted">{t('community.panel.sharedGroups')}</p>
          <div className="row">
            {sharedGroups.map((group) => (
              <Link key={group.id} className="post-card__group" href={route.group(group.slug)}>
                {group.name}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </Panel>
  );
}

/**
 * A three-across grid of the photos lifted out of somebody's posts.
 *
 * SQUARE-CROPPED, which is the one place this app throws away an aspect ratio
 * it is otherwise careful about: a grid whose cells were 1:1, 4:5 and 16:9 is
 * not a grid. The full ratio comes back the moment the reader opens the post.
 */
export function PhotoPanel({ summary }: { summary: ProfileSummary }) {
  const t = useT();
  if (summary.photos.length === 0) return null;

  return (
    <Panel title={t('community.panel.photos')} actions={<Count value={summary.photos.length} />}>
      <div className="photo-grid">
        {summary.photos.map(({ postId, media }) => (
          <Link
            key={media.id}
            className="photo-grid__cell"
            href={route.post(postId)}
            aria-label={t(media.altKey)}
          >
            <Media media={media} />
          </Link>
        ))}
      </div>
    </Panel>
  );
}
