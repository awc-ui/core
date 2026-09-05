/**
 * A post's comments, two levels deep, with a collapse control on each run of
 * replies and a box to add one.
 *
 * THE WHOLE TREE IS WRITTEN, including the replies past the page size — they
 * carry `hidden` rather than being absent, so expanding is an attribute removal
 * rather than markup the client would have to build. Every name, body and
 * timestamp in it is already translated and already formatted; the client has
 * no dictionary and no Intl.
 *
 * ONE TOGGLE AT A TIME. Both controls are written and exactly one is shown, the
 * same way the feed's two endings are — keying them off a count that does not
 * change on expand showed "View 1 more reply" directly above "Hide replies".
 */

import { REPLY_PAGE, commentTree, reactionSummary, subtreeSize, route } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { avatar, count, when } from '../lib/bits.mjs';

function branch(t, locale, node) {
  const { comment, author, replyingTo } = node;
  const summary = reactionSummary(comment.reactions, comment.viewerReaction, comment.viewerReaction);
  const shipped = comment.viewerReaction !== null;

  const hidden = node.children.slice(REPLY_PAGE);
  const hiddenCount = hidden.reduce((total, child) => total + 1 + subtreeSize(child), 0);
  const self =
    author.friendship === 'self' ? route.profile() : route.person(author.handle);

  return html`<div class="thread__branch">
    <div class="comment"${attrs({
      'data-comment': comment.id,
      'data-depth': String(comment.depth),
    })}>
      <a class="comment__avatar"${attrs({ href: localeHref(locale, self) })}>${avatar(t, author, {
        size: 'small',
      })}</a>

      <div>
        <div class="comment__bubble">
          <!-- "Replying to X" AT DEPTH 2 ONLY: at depth 1 the indent is
               unambiguous, at depth 2 siblings may sit between. -->
          ${comment.depth === 2 && replyingTo
            ? html`<span class="comment__replying">${t('community.hint.replyingTo', {
                name: replyingTo.displayName,
              })}</span>`
            : null}
          <a class="comment__author"${attrs({ href: localeHref(locale, self) })}>${
            author.displayName
          }</a>
          <p class="comment__body">${t(comment.bodyKey)}</p>
        </div>

        <div class="comment__foot">
          ${when(t, comment.postedAt)}
          <button type="button" class="comment__act"${attrs({
            'data-comment': comment.id,
            'data-on': shipped,
            'aria-pressed': String(shipped),
          })}>${t('community.reaction.like')}</button>
          <span class="comment__likes"${attrs({
            hidden: summary.total === 0,
            /* Both spellings of the count, pre-formatted — the client picks. */
            'data-on-text': t.formatNumber(shipped ? summary.total : summary.total + 1),
            'data-off-text': t.formatNumber(shipped ? summary.total - 1 : summary.total),
          })}>
            <span class="material-symbols-outlined" aria-hidden="true">thumb_up</span>
            ${count(t, summary.total)}
            <span class="visually-hidden">${t('community.count.reactions')}</span>
          </span>
        </div>
      </div>
    </div>

    ${node.children.length > 0
      ? html`<div class="thread__children">
          ${node.children.map(
            (child, index) => html`<div class="thread__reply"${attrs({
              hidden: index >= REPLY_PAGE,
            })}>${branch(t, locale, child)}</div>`,
          )}
          ${hiddenCount > 0
            ? html`<button type="button" class="thread__toggle thread__toggle--more">${
                hiddenCount === 1
                  ? t('community.action.viewRepliesOne')
                  : t('community.action.viewReplies', { count: t.formatNumber(hiddenCount) })
              }</button>
              <button type="button" class="thread__toggle thread__toggle--less" hidden>${t(
                'community.action.hideReplies',
              )}</button>`
            : null}
        </div>`
      : null}
  </div>`;
}

export function commentThread(t, locale, postId) {
  const roots = commentTree(postId);

  return html`<div class="thread">
    ${roots.length === 0
      ? html`<div class="empty comment-empty">
          <p>${t('community.empty.comments')}</p>
          <p>${t('community.empty.commentsHint')}</p>
        </div>`
      : roots.map((node) => branch(t, locale, node))}

    <!-- THE ROW A NEW COMMENT BECOMES, written once and kept in a template.

         A comment the reader adds has a name and a body, and one of those is
         translated. Built in JavaScript it would be English on all three pages.
         A template element and not a hidden div: its contents are an inert
         fragment outside the document, so the parity census does not count a
         row here that the four SPA builds do not have. -->
    <template class="comment-mine">
      <div class="comment" data-mine="">
        <div>
          <div class="comment__bubble">
            <span class="comment__author">${t('community.common.you')}</span>
            <p class="comment__body"></p>
          </div>
        </div>
      </div>
    </template>

    <div class="comment-compose">
      <!-- OUTLINED and auto-grow: a filled field reserves 28px above the
           textarea for its label and 8px below, which on a one-row box puts the
           label near the bottom under a strip of nothing. -->
      <md-text-field${attrs({
        class: 'comment-draft',
        variant: 'outlined',
        label: t('community.action.comment'),
        multiline: 'auto-grow',
        rows: '1',
        'full-width': true,
      })}></md-text-field>
      <md-button${attrs({
        class: 'comment-post',
        variant: 'filled',
        icon: 'send',
        'soft-disabled': true,
        'data-msg': t('community.msg.commentPosted'),
      })}>${t('community.action.post')}</md-button>
    </div>
  </div>`;
}
