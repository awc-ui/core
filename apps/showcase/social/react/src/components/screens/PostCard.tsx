/**
 * One post in the feed. The most-repeated component in the app, so its
 * decisions are repeated twelve times a screen.
 *
 * THE HEADER, THE PICTURE, THE ACTIONS, THE CAPTION, THE COMMENTS — in that
 * order, which is the order every app of this shape uses and is not arbitrary:
 * the picture is the content, so nothing but a name goes above it; the actions
 * sit directly under it because that is where the thumb is after looking; and
 * the caption comes after the actions because it is prose, and prose that
 * pushed the actions down the screen would move the target every time a caption
 * ran long.
 *
 * THE WHOLE CARD IS NOT A LINK. Only the name, the picture and the comment
 * count navigate. Wrapping the card would swallow the four action buttons
 * inside it — a control inside a link is reachable but announces the link's
 * name, and pressing it with a keyboard fires both.
 */

import { engagement, getPersonById, type FeedItem } from '@awc-ui/showcase-kit/social';
import { Link } from '@/lib/router';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { route } from '@/lib/routes';
import { Avatar, Count, PersonName, PostActions, PostMedia, When } from '@/components/bits';

export function PostCard({ item, eager = false, onMessage }: {
  item: FeedItem;
  /** The first card in the feed decodes eagerly; the rest are lazy. */
  eager?: boolean;
  /** Raise a snackbar. `null` says nothing happened worth announcing. */
  onMessage: (key: string | null) => void;
}) {
  const t = useT();
  const { isLiked, isSaved, toggleLike, toggleSave } = useEngagement();
  const { post, author, preview, hiddenComments } = item;

  const liked = isLiked(post);
  const saved = isSaved(post);
  /* The kit does the arithmetic of turning an override plus a shipped count
     into the number on screen — five builds must not each write
     `likeCount + (liked && !post.liked ? 1 : 0)` slightly differently. */
  const counts = engagement(post, liked, saved);

  return (
    <article className="post-card">
      <header className="post-card__head">
        {/* ONE link around the avatar and the name, and `PersonName` inside it
            rather than `PersonLink` — the latter is an anchor, and an anchor
            inside an anchor is invalid HTML that the DOM API builds without
            complaint and a screen reader reads as two overlapping links. */}
        <Link className="post-card__author" href={route.person(author.handle)}>
          <Avatar person={author} size="small" ring />
          <span className="post-card__names">
            <PersonName person={author} />
            {post.locationKey ? (
              <span className="post-card__place">{t(post.locationKey)}</span>
            ) : null}
          </span>
        </Link>
        <When at={post.postedAt} />
        {/* No overflow menu. Every action behind one — report, copy link, mute
            — would be a control that does nothing in a fixture-backed demo,
            and the app bar's disclaimer already says this is not a real
            product. An empty corner beats a dead menu. */}
      </header>

      {/* The href goes INTO `PostMedia`, which puts the anchor around the image
          only. Wrapping the whole thing put the pager buttons inside the link,
          so paging to the next picture navigated to the post instead. */}
      <PostMedia post={post} eager={eager} href={route.post(post.id)} />

      <PostActions
        liked={liked}
        saved={saved}
        /* Liking announces; UNliking does not. A snackbar is for something the
           reader may want to undo or verify, and taking a like back is already
           its own confirmation — the heart empties. Saving is the other way
           round: the post goes somewhere the reader cannot see from here, so
           both directions are worth saying. */
        onLike={() => onMessage(toggleLike(post) ? 'social.msg.liked' : null)}
        onSave={() => onMessage(toggleSave(post) ? 'social.msg.saved' : 'social.msg.unsaved')}
        onComment={() => {}}
        onShare={() => onMessage('social.msg.linkCopied')}
      />

      <div className="post-card__body">
        <p className="post-card__counts">
          <Count value={counts.likeCount} /> {t('social.count.likes').toLocaleLowerCase(t.locale)}
        </p>

        {/* The caption is ONE paragraph led by the author's handle, which is
            how every app of this shape writes it — the name is part of the
            sentence, not a label above it. */}
        <p className="post-card__caption">
          <Link className="post-card__handle" href={route.person(author.handle)}>
            {author.handle}
          </Link>{' '}
          {t(post.captionKey)}
        </p>

        {post.commentsDisabled ? (
          <p className="post-card__muted">{t('social.hint.commentsOff')}</p>
        ) : (
          <>
            {hiddenComments > 0 ? (
              <Link className="post-card__more" href={route.post(post.id)}>
                {t('social.action.viewComments', { count: t.formatNumber(post.commentCount) })}
              </Link>
            ) : null}
            {preview.map((comment) => {
              /* The record carries an author ID, not a handle — resolving it
                 here is what stops `per-07` appearing where a name belongs.
                 The fixture guarantees every comment's author exists, so the
                 fallback is for a bad id rather than a missing person. */
              const person = getPersonById(comment.authorId);
              return (
                <p key={comment.id} className="post-card__comment">
                  <Link
                    className="post-card__handle"
                    href={person ? route.person(person.handle) : route.explore()}
                  >
                    {person?.handle ?? comment.authorId}
                  </Link>{' '}
                  {t(comment.bodyKey)}
                </p>
              );
            })}
          </>
        )}
      </div>
    </article>
  );
}
