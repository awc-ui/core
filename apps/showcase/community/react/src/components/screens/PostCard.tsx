/**
 * One post. The most-repeated component in the app and the most complex, and
 * both for the same reason: four kinds share it, and one of them contains
 * another post.
 *
 * THE ORDER IS BYLINE, BODY, ATTACHMENT, AGGREGATE, ACTIONS, COMMENTS — and the
 * body comes SECOND, which is the whole inversion from Lyra. There the picture
 * is the post and the caption trails it; here the writing is the post and the
 * picture, link or shared card is an attachment to it.
 *
 * THE WHOLE CARD IS NOT A LINK. Only the author, the group, the timestamp and
 * the comment count navigate. Wrapping the card would swallow the reaction
 * picker, the six option buttons inside it and the comment box — a control
 * inside a link is reachable but announces the link's name, and a keyboard
 * press fires both.
 */

import { useState } from 'react';
import {
  reactionSummary,
  type FeedItem,
  type Post,
} from '@awc-ui/showcase-kit/community';
import { Link } from '@/lib/router';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { Panel } from '@/components/Shell';
import {
  AudienceMark,
  Avatar,
  Media,
  PersonName,
  ReactButton,
  ReactionSummaryRow,
  When,
} from '@/components/bits';
import { CommentThread } from './CommentThread';

/**
 * How many characters of body count as "long".
 *
 * THE CLAMP ITSELF IS CSS — four lines, whatever those lines happen to hold at
 * this width. This number only decides whether to RENDER the "see more"
 * control, and it has to be an estimate because the real answer depends on the
 * column width, the font and the language. It is deliberately generous: a
 * button that appears on a post that turns out not to be clipped is a small
 * oddity, and one that fails to appear on a post that IS clipped hides the end
 * of somebody's writing.
 */
const LONG_BODY = 180;

/* ------------------------------------------------------------ the byline */

/**
 * Avatar, name, optional group, time and audience.
 *
 * TWO SHAPES IN ONE: a plain post says "Ada Lindqvist", a group post says
 * "Ada Lindqvist › Nordic Film Club" with both halves linking somewhere
 * different. The chevron rather than the word "in" is deliberate — see the note
 * on `.post-card__in` in `app.css` — and the translated "in {group}" string is
 * still used, on the group link's accessible name, where word order matters.
 */
function Byline({ item, compact = false }: { item: FeedItem; compact?: boolean }) {
  const t = useT();
  const { post, author, group } = item;

  return (
    <header className="post-card__head">
      <Link className="post-card__author" href={route.person(author.handle)}>
        <Avatar person={author} size={compact ? 'small' : 'medium'} />
      </Link>
      <div className="post-card__names">
        <span className="post-card__in">
          <Link className="post-card__author" href={route.person(author.handle)}>
            <PersonName person={author} />
          </Link>
          {group ? (
            <>
              <span aria-hidden="true">›</span>
              <Link
                className="post-card__group"
                href={route.group(group.slug)}
                aria-label={t('community.hint.postedIn', { group: group.name })}
              >
                {group.name}
              </Link>
            </>
          ) : null}
        </span>
        <span className="post-card__meta">
          <Link className="when" href={route.post(post.id)}>
            <When at={post.postedAt} />
          </Link>
          <span aria-hidden="true">·</span>
          <AudienceMark audience={post.audience} labelKey={post.audienceKey} />
          {post.pinned ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{t('community.hint.pinned')}</span>
            </>
          ) : null}
        </span>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- the body */

function Body({ post }: { post: Post }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const text = t(post.bodyKey);
  const long = text.length > LONG_BODY;

  return (
    <>
      {/* `data-clamped` and not a class: the clamp is a STATE of this
          paragraph, and app.css keys the four-line clamp off exactly that. */}
      <p className="post-card__body" data-clamped={long && !expanded ? '' : undefined}>
        {text}
      </p>
      {long ? (
        <button type="button" className="post-card__more" onClick={() => setExpanded((v) => !v)}>
          {t(expanded ? 'community.action.seeLess' : 'community.action.seeMore')}
        </button>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------- the attachment */

/**
 * Photos, a link card or a shared post — whichever this kind carries.
 *
 * ONE COMPONENT AND NOT THREE BRANCHES AT THE CALL SITE, because a shared post
 * renders its own attachment too and would otherwise need the same three
 * branches written a second time.
 */
function Attachment({ item, nested = false }: { item: FeedItem; nested?: boolean }) {
  const t = useT();
  const { post } = item;

  if (post.media.length > 0) {
    return (
      <div className="post-photos" data-count={String(post.media.length)}>
        {post.media.map((media, index) => (
          <Link
            key={media.id}
            className="post-photos__cell"
            href={route.post(post.id)}
            aria-label={t(media.altKey)}
          >
            <Media media={media} eager={!nested && index === 0} />
          </Link>
        ))}
      </div>
    );
  }

  if (post.link) {
    /* NOT AN ANCHOR — see `LinkPreview` in the kit and `.link-card` in
       app.css. Nothing here navigates off the app, and a non-anchor can sit
       inside the post's own link target without nesting one anchor in
       another. */
    return (
      <md-tooltip text={t('community.hint.linkNotReal')}>
        <div className="link-card">
          <Media media={post.link.image} className="link-card__image" />
          <div className="link-card__text">
            <span className="link-card__domain">{post.link.domain}</span>
            <p className="link-card__title">{t(post.link.titleKey)}</p>
            <p className="link-card__about">{t(post.link.descriptionKey)}</p>
          </div>
        </div>
      </md-tooltip>
    );
  }

  if (item.shared) {
    /*
     * THE INNER POST IS RENDERED WHOLE, byline and attachment and all, but
     * NEVER its actions or its comments: those belong to the original and
     * pressing them here would react to a post the reader is not looking at.
     * It is also not a card — two stacked elevations read as a modal over a
     * modal — so it is a bordered box on the same ground.
     */
    const inner: FeedItem = {
      post: item.shared.post,
      author: item.shared.author,
      group: item.shared.group,
      shared: null,
      preview: [],
      hiddenComments: 0,
    };
    return (
      <div className="shared-post">
        <Byline item={inner} compact />
        <Body post={inner.post} />
        <Attachment item={inner} nested />
      </div>
    );
  }

  return null;
}

/* --------------------------------------------------------------- the card */

export function PostCard({
  item,
  onMessage,
  showComments = false,
}: {
  item: FeedItem;
  /** Raise a snackbar. `null` says nothing happened worth announcing. */
  onMessage: (key: string | null, params?: Record<string, string | number>) => void;
  /** The drill opens its thread; the feed shows a preview and a link. */
  showComments?: boolean;
}) {
  const t = useT();
  const { reactionFor, setReaction } = useEngagement();
  const { post } = item;
  const [open, setOpen] = useState(showComments);

  const mine = reactionFor(post);
  /* The kit does the arithmetic of turning an override plus a shipped count
     into the numbers on screen — including the SWITCH case, where a reader
     moves from one reaction to another and two counts have to move. Five
     builds must not each write that by hand. */
  const summary = reactionSummary(post.reactions, post.viewerReaction, mine);

  return (
    <Panel>
      <article className="post-card" data-post={post.id}>
        {item.shared ? (
          <p className="post-card__meta">
            {t(
              item.shared.group ? 'community.hint.sharedGroupPost' : 'community.hint.sharedPost',
              { name: item.author.displayName, group: item.shared.group?.name ?? '' },
            )}
          </p>
        ) : null}

        <Byline item={item} />
        <Body post={post} />
        <Attachment item={item} />

        <ReactionSummaryRow
          summary={summary}
          commentCount={post.commentCount}
          shareCount={post.shareCount}
          onOpenComments={() => setOpen(true)}
        />

        <div className="post-actions">
          <ReactButton
            mine={mine}
            onPick={(next) => {
              setReaction(post, next);
              /* Reacting announces; taking it back does not. A snackbar is for
                 something the reader may want to verify, and un-reacting is
                 already its own confirmation — the button goes grey. */
              onMessage(next ? 'community.reaction.summary' : null, {
                count: summary.total + (next ? 1 : 0),
              });
            }}
          />
          <md-button
            variant="text"
            icon="mode_comment"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {t('community.action.comment')}
          </md-button>
          <md-button variant="text" icon="share" onClick={() => onMessage('community.msg.linkCopied')}>
            {t('community.action.share')}
          </md-button>
        </div>

        {open ? (
          post.commentsDisabled ? (
            <p className="muted">{t('community.hint.commentsOff')}</p>
          ) : (
            <CommentThread postId={post.id} onMessage={onMessage} />
          )
        ) : null}
      </article>
    </Panel>
  );
}
