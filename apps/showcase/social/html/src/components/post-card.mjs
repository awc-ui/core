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

import { engagement, getPersonById, route } from '@awc-ui/showcase-kit/social';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { avatar, count, personName, postActions, postMedia, when } from '../lib/bits.mjs';

export function postCard(t, locale, item, { eager = false } = {}) {
  const { post, author, preview, hiddenComments } = item;

  /* The FIXTURE's answer, which is what a static document can state. The kit
     does the arithmetic of turning an override plus a shipped count into the
     number on screen, and `src/client/engagement.mjs` calls the same function
     with the same post when the reader presses the heart — five builds must not
     each write `likeCount + (liked && !post.liked ? 1 : 0)` slightly
     differently. */
  const counts = engagement(post, post.liked, post.saved);

  return html`<article class="post-card"${attrs({ 'data-post': post.id })}>
    <header class="post-card__head">
      <!-- ONE link around the avatar and the name, with the name rendered by
           personName() rather than personLink() — the latter is an anchor, and
           an anchor inside an anchor is invalid HTML that a parser silently
           unnests into something nobody wrote. -->
      <a class="post-card__author"${attrs({ href: localeHref(locale, route.person(author.handle)) })}>
        ${avatar(t, author, { size: 'small', ring: true })}
        <span class="post-card__names">
          ${personName(t, author)}
          ${post.locationKey ? html`<span class="post-card__place">${t(post.locationKey)}</span>` : null}
        </span>
      </a>
      ${when(t, post.postedAt)}
      <!-- No overflow menu. Every action behind one — report, copy link, mute —
           would be a control that does nothing in a fixture-backed demo, and
           the app bar's disclaimer already says this is not a real product. An
           empty corner beats a dead menu. -->
    </header>

    ${postMedia(t, post, { eager, href: localeHref(locale, route.post(post.id)) })}

    ${postActions(t, { postId: post.id, liked: post.liked, saved: post.saved })}

    <div class="post-card__body">
      <!-- The like count is REWRITTEN IN PLACE by the client when the heart is
           pressed, so it carries the shipped figure and the two numbers it can
           become. Formatting a count in the browser would mean choosing between
           compact and exact without the kit's rule and formatting it without
           the page's locale. -->
      <p class="post-card__counts">
        <span${attrs({
          class: 'post-card__likes',
          'data-liked-text': t.formatNumber(counts.likeCount + (post.liked ? 0 : 1), { notation: 'compact' }),
          'data-unliked-text': t.formatNumber(counts.likeCount - (post.liked ? 1 : 0), { notation: 'compact' }),
        })}>${count(t, counts.likeCount)}</span>
        ${t('social.count.likes').toLocaleLowerCase(t.locale)}
      </p>

      <!-- The caption is ONE paragraph led by the author's handle, which is how
           every app of this shape writes it: the name is part of the sentence,
           not a label above it. -->
      <p class="post-card__caption">
        <a class="post-card__handle"${attrs({
          href: localeHref(locale, route.person(author.handle)),
        })}>${author.handle}</a>
        ${t(post.captionKey)}
      </p>

      ${post.commentsDisabled
        ? html`<p class="post-card__muted">${t('social.hint.commentsOff')}</p>`
        : html`${hiddenComments > 0
            ? html`<a class="post-card__more"${attrs({
                href: localeHref(locale, route.post(post.id)),
              })}>${t('social.action.viewComments', { count: t.formatNumber(post.commentCount) })}</a>`
            : null}
          ${preview.map((comment) => {
            /* The record carries an author ID, not a handle — resolving it here
               is what stops `per-07` appearing where a name belongs. The
               fixture guarantees every comment's author exists, so the fallback
               is for a bad id rather than a missing person. */
            const person = getPersonById(comment.authorId);
            return html`<p class="post-card__comment">
              <a class="post-card__handle"${attrs({
                href: localeHref(locale, person ? route.person(person.handle) : route.explore()),
              })}>${person?.handle ?? comment.authorId}</a>
              ${t(comment.bodyKey)}
            </p>`;
          })}`}
    </div>
  </article>`;
}
