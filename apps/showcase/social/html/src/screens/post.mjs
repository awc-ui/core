/**
 * One post, and its comments. The first of the two drills.
 *
 * TWO COLUMNS ABOVE 900px, ONE BELOW. The picture takes the space it deserves
 * and the conversation sits beside it, which is the arrangement every app of
 * this shape uses on a wide screen — and on a phone the picture goes back on
 * top, because a comment thread beside a 390px picture is two narrow columns
 * and neither is readable.
 *
 * THE COMMENTS COME FROM THE KIT IN READING ORDER, not in date order: each
 * top-level comment is followed immediately by its replies. A flat newest-first
 * list scatters a reply away from the thing it replies to, which is the one
 * arrangement a comment section must not have.
 */

import {
  REPORTING_INSTANT,
  crumbsFor,
  engagement,
  getComments,
  getPersonById,
  getPostById,
  route,
} from '@awc-ui/showcase-kit/social';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { avatar, count, personName, postActions, postMedia, when } from '../lib/bits.mjs';
import { panel, screen, snackbar } from '../components/shell.mjs';
import { notFoundScreen } from './not-found.mjs';

export function postScreen(t, locale, postId) {
  const post = getPostById(postId);
  if (!post) return notFoundScreen(t, locale);

  const author = getPersonById(post.authorId);
  const comments = getComments(post.id);
  const counts = engagement(post, post.liked, post.saved);
  const here = route.post(post.id);

  return screen(t, {
    locale,
    here,
    title: t('social.screen.post.title'),
    subtitle: t('social.screen.post.subtitle', { name: author.displayName }),
    crumbs: crumbsFor(here, null),
    children: html`<div class="post-detail">
        <div class="post-detail__media">${postMedia(t, post, { eager: true })}</div>

        <div class="post-detail__side">
          ${panel({
            children: html`<header class="post-card__head">
                <!-- personName(), not personLink(): this row is already one
                     link, and an anchor inside an anchor is invalid. -->
                <a class="post-card__author"${attrs({
                  href: localeHref(locale, route.person(author.handle)),
                })}>
                  ${avatar(t, author, { size: 'small', ring: true })}
                  <span class="post-card__names">
                    ${personName(t, author, { showHandle: true })}
                    ${post.locationKey
                      ? html`<span class="post-card__place">${t(post.locationKey)}</span>`
                      : null}
                  </span>
                </a>
                ${when(t, post.postedAt)}
              </header>

              <p class="post-card__caption">${t(post.captionKey)}</p>

              <div class="row">
                ${post.topics.map(
                  (id) => html`<md-chip${attrs({
                    variant: 'assist',
                    appearance: 'outlined',
                    color: 'secondary',
                    label: t(`social.topic.${id}`),
                  })}></md-chip>`,
                )}
              </div>

              ${postActions(t, { postId: post.id, liked: post.liked, saved: post.saved })}

              <!-- stat-row, not dl: four one-word labels with small numbers read
                   across, and .dl gave each its own full-width row — eight lines
                   down a narrow column for four counts. -->
              <dl class="stat-row">
                <div><dt>${t('social.count.likes')}</dt><dd><span${attrs({
                  class: 'post-card__likes',
                  'data-liked-text': t.formatNumber(counts.likeCount + (post.liked ? 0 : 1), {
                    notation: 'compact',
                  }),
                  'data-unliked-text': t.formatNumber(counts.likeCount - (post.liked ? 1 : 0), {
                    notation: 'compact',
                  }),
                })}>${count(t, counts.likeCount)}</span></dd></div>
                <div><dt>${t('social.count.comments')}</dt><dd><span class="post-comment-count">${count(
                  t,
                  counts.commentCount,
                )}</span></dd></div>
                <div><dt>${t('social.count.shares')}</dt><dd>${count(t, counts.shareCount)}</dd></div>
                <div><dt>${t('social.count.saves')}</dt><dd>${count(t, counts.saveCount)}</dd></div>
              </dl>`,
          })}

          ${panel({
            title: t('social.panel.comments'),
            actions: html`<span class="post-comment-count">${count(t, comments.length)}</span>`,
            children: html`${post.commentsDisabled
                ? html`<p class="muted">${t('social.hint.commentsOff')}</p>`
                : comments.length === 0
                  ? html`<div class="empty comment-empty">
                      <p>${t('social.empty.comments')}</p>
                      <p>${t('social.empty.commentsHint')}</p>
                    </div>`
                  : html`<md-list${attrs({
                      class: 'comment-list',
                      label: t('social.panel.comments'),
                      'interaction-mode': 'multi-action',
                      'list-style': 'segmented',
                    })}>
                      ${comments.map((comment) => {
                        const person = getPersonById(comment.authorId);
                        return html`<md-list-item${attrs({
                          /* A reply is indented from a data attribute rather
                             than a nested list: md-list inside md-list gives a
                             screen reader a second list to escape, and the
                             thread is only ever one level deep — the fixture
                             asserts it. */
                          'data-reply': Boolean(comment.replyToId),
                          headline: person.displayName,
                          /*
                           * NO OVERLINE ON A REPLY — the third attempt at this,
                           * and the first that stops adding a line.
                           *
                           * A shouted handle above every comment said nothing;
                           * naming the parent as well shouted louder and put
                           * the parent ahead of the speaker; a plain "Reply"
                           * was quiet enough but still cost a whole line above
                           * the name, so a reply stood taller than the comment
                           * it answered — exactly backwards.
                           *
                           * The relationship is drawn instead: app.css puts an
                           * elbow connector in the indent gutter, running down
                           * from the parent and turning in towards this row's
                           * avatar. A line cannot be read by a screen reader,
                           * so the word moves into the trailing slot as
                           * visually-hidden text — announced, and occupying
                           * nothing.
                           */
                          'supporting-text': t(comment.bodyKey),
                          lines: '2',
                        })}>
                          <span slot="leading">${avatar(t, person, { size: 'small' })}</span>
                          <span slot="trailing" class="comment-trailing">
                            ${comment.replyToId
                              ? html`<span class="visually-hidden">${t('social.action.reply')}</span>`
                              : null}
                            ${when(t, comment.postedAt)}
                            <!-- A bare number in a trailing slot is a number
                                 with no unit. The heart is what says what it
                                 counts, and it is aria-hidden because the label
                                 beside it does the same job for a screen
                                 reader. -->
                            <span class="comment-likes">
                              <span class="material-symbols-outlined" aria-hidden="true">favorite</span>
                              ${count(t, comment.likeCount)}
                              <span class="visually-hidden">${t('social.count.likes')}</span>
                            </span>
                          </span>
                        </md-list-item>`;
                      })}
                    </md-list>`}

              ${post.commentsDisabled
                ? null
                : html`<div class="comment-compose">
                    <!-- auto-grow, not a fixed single line: a comment is prose
                         of unknown length, and a one-line box that scrolls its
                         own content hides what you just wrote.

                         OUTLINED, not the default filled, and the reason is the
                         one-row multiline specifically. A filled field reserves
                         a band at the top for its label to float into: measured
                         at 28px above the textarea against 8px below. On a
                         single-line box that band is simply empty, so the label
                         sat near the bottom of a 60px control under a broad
                         strip of nothing. An outlined field carries its label in
                         the border notch and pads symmetrically. -->
                    <md-text-field${attrs({
                      class: 'comment-draft',
                      variant: 'outlined',
                      label: t('social.action.comment'),
                      multiline: 'auto-grow',
                      rows: '1',
                      'full-width': true,
                    })}></md-text-field>
                    <!-- THE ROW A NEW COMMENT BECOMES, written once and kept
                         in a template.

                         A comment the reader adds has a name, a body and a
                         timestamp, and two of those three are translated: "You"
                         and the relative time. Built in JavaScript they would be
                         English on all three pages. So the build renders the row
                         complete, with the timestamp resolved against the
                         reporting instant (which is "now" — it is the instant
                         everything else on the page is measured from), and the
                         client clones it and fills in the one part that is the
                         reader's own words.

                         A template element and not a hidden div: its contents
                         are an inert fragment rather than part of the document,
                         so the parity census does not see a row here that the
                         four SPA builds do not have. -->
                    <template class="comment-mine">
                      <md-list-item${attrs({
                        'data-mine': true,
                        headline: t('social.common.you'),
                        'supporting-text': '',
                        lines: '2',
                      })}>
                        <span slot="trailing">${when(t, REPORTING_INSTANT)}</span>
                      </md-list-item>
                    </template>
                    <md-button${attrs({
                      class: 'comment-post',
                      variant: 'filled',
                      icon: 'send',
                      /* Soft-disabled with a stated reason rather than silently
                         inert — the same gate the two banking tickets use. */
                      'soft-disabled': true,
                      'data-you': t('social.common.you'),
                      'data-msg': t('social.msg.posted'),
                    })}>${t('social.action.post')}</md-button>
                  </div>`}`,
          })}
        </div>
      </div>

      ${snackbar(t)}`,
  });
}
