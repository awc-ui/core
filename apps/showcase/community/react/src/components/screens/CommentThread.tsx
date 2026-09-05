/**
 * A post's comments, two levels deep, with a collapse control on each run of
 * replies and a box to add one.
 *
 * THE TREE COMES FROM THE KIT, not from a walk written here. `commentTree()`
 * returns nodes with their children already attached, which is what puts the
 * boundary of a reply-run in the DATA — and that boundary is exactly where the
 * collapse control goes. Five builds each writing the same recursion is five
 * chances to indent the wrong thing.
 *
 * REPLIES ARE COLLAPSED PAST THE SECOND, which is the difference from Lyra's
 * flat one-level thread. A run of five replies at the same indent is what makes
 * a comment section unreadable, and every product that allows nesting ends up
 * collapsing it — so this does it from the start rather than discovering the
 * need later.
 */

import { useRef, useState } from 'react';
import {
  REPLY_PAGE,
  commentTree,
  reactionSummary,
  subtreeSize,
  type ThreadNode,
} from '@awc-ui/showcase-kit/community';
import { useT } from '@/lib/showcase';
import { useEngagement } from '@/lib/engagement';
import { useCustomEvent } from '@/components/elements';
import { Avatar, Count, PersonLink, When } from '@/components/bits';
import { route } from '@/lib/routes';

/* ------------------------------------------------------------- one comment */

function CommentRow({ node }: { node: ThreadNode }) {
  const t = useT();
  const { commentReactionFor, setCommentReaction } = useEngagement();
  const { comment, author, replyingTo } = node;

  const mine = commentReactionFor(comment);
  const summary = reactionSummary(comment.reactions, comment.viewerReaction, mine);

  return (
    <div className="comment" data-comment={comment.id} data-depth={String(comment.depth)}>
      <PersonLink person={author} className="comment__avatar">
        <Avatar person={author} size="small" />
      </PersonLink>

      <div>
        <div className="comment__bubble">
          {/*
            "Replying to Ada" AT DEPTH 2 ONLY.

            At depth 1 the indent is unambiguous — there is exactly one comment
            it could answer and it is directly above. At depth 2 there may be
            siblings in between, so the indent no longer says WHO and the name
            has to. Rendering it at every depth puts a redundant line on every
            reply in the thread.
          */}
          {comment.depth === 2 && replyingTo ? (
            <span className="comment__replying">
              {t('community.hint.replyingTo', { name: replyingTo.displayName })}
            </span>
          ) : null}
          <PersonLink person={author} className="comment__author" />
          <p className="comment__body">{t(comment.bodyKey)}</p>
        </div>

        <div className="comment__foot">
          <When at={comment.postedAt} />
          <button
            type="button"
            className="comment__act"
            data-on={mine ? '' : undefined}
            aria-pressed={mine !== null}
            onClick={() => setCommentReaction(comment, mine ? null : 'like')}
          >
            {t('community.reaction.like')}
          </button>
          {summary.total > 0 ? (
            <span className="comment__likes">
              <span className="material-symbols-outlined" aria-hidden="true">
                thumb_up
              </span>
              <Count value={summary.total} />
              <span className="visually-hidden">{t('community.count.reactions')}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- a run of replies */

/**
 * One node and its children, with the collapse control between them.
 *
 * The control counts the WHOLE subtree, not the direct children: "3 more
 * replies" that reveals three rows and then two more nested under them has
 * undercounted, and the reader has to press again on something that did not
 * say it was there.
 */
function ThreadBranch({ node }: { node: ThreadNode }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const hidden = node.children.slice(REPLY_PAGE);
  const shown = expanded ? node.children : node.children.slice(0, REPLY_PAGE);
  const hiddenCount = hidden.reduce((total, child) => total + 1 + subtreeSize(child), 0);

  return (
    <div className="thread__branch">
      <CommentRow node={node} />
      {node.children.length > 0 ? (
        <div className="thread__children">
          {shown.map((child) => (
            <ThreadBranch key={child.comment.id} node={child} />
          ))}
          {/*
            ONE TOGGLE AT A TIME.

            `hiddenCount` is a property of the DATA — how many replies exist
            past the page size — and it does not change when the reader expands
            them. Both buttons were keyed off it independently, so an expanded
            run showed "View 1 more replies" directly above "Hide replies":
            two controls contradicting each other, one of which was already
            done. Which one to show is a question about the STATE, so `expanded`
            is what decides it.
          */}
          {expanded ? (
            <button type="button" className="thread__toggle" onClick={() => setExpanded(false)}>
              {t('community.action.hideReplies')}
            </button>
          ) : hiddenCount > 0 ? (
            <button type="button" className="thread__toggle" onClick={() => setExpanded(true)}>
              {/* A singular form, not the plural with a 1 in it — the commonest
                  case in this thread is exactly one hidden reply. */}
              {hiddenCount === 1
                ? t('community.action.viewRepliesOne')
                : t('community.action.viewReplies', { count: t.formatNumber(hiddenCount) })}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- the thread */

export function CommentThread({
  postId,
  onMessage,
}: {
  postId: string;
  onMessage: (key: string | null, params?: Record<string, string | number>) => void;
}) {
  const t = useT();
  const [added, setAdded] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const draftRef = useRef<HTMLElement | null>(null);

  /*
   * `mdInput` THROUGH A REF, NOT `onInput` AS A JSX PROP.
   *
   * React's `onInput` binds the NATIVE input event, and `md-text-field` reports
   * through a custom `mdInput` whose detail IS the bare string. The two never
   * meet: the draft stays empty, the Post button stays soft-disabled, and
   * nothing throws — the field simply does not work. The same mistake cost Lyra
   * a debugging round, which is why the browser test types into this field.
   */
  useCustomEvent<CustomEvent<string>>(draftRef, 'mdInput', (event) =>
    setDraft(String(event.detail ?? '')),
  );

  const roots = commentTree(postId);

  return (
    <div className="thread">
      {roots.length === 0 && added.length === 0 ? (
        <div className="empty">
          <p>{t('community.empty.comments')}</p>
          <p>{t('community.empty.commentsHint')}</p>
        </div>
      ) : (
        roots.map((node) => <ThreadBranch key={node.comment.id} node={node} />)
      )}

      {added.map((body, index) => (
        <div key={`added-${index}`} className="comment" data-mine="">
          <div>
            <div className="comment__bubble">
              <span className="comment__author">{t('community.common.you')}</span>
              <p className="comment__body">{body}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="comment-compose">
        {/*
          OUTLINED and `auto-grow`, for the reason Lyra's post screen documents
          at length: a filled field reserves 28px above the textarea for its
          label to float into and only 8px below, which on a one-row box puts
          the label near the bottom of a 60px control under a strip of nothing.
          An outlined field carries its label in the border notch and pads
          symmetrically.
        */}
        <md-text-field
          ref={draftRef}
          variant="outlined"
          label={t('community.action.comment')}
          value={draft}
          multiline="auto-grow"
          rows={1}
          full-width
        />
        <md-button
          variant="filled"
          icon="send"
          soft-disabled={draft.trim() === '' || undefined}
          onClick={() => {
            if (draft.trim() === '') return;
            setAdded((prev) => [...prev, draft.trim()]);
            setDraft('');
            onMessage('community.msg.commentPosted');
          }}
        >
          {t('community.action.post')}
        </md-button>
      </div>
    </div>
  );
}
