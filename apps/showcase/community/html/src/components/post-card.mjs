/**
 * One post. The most-repeated component in the app and the most complex, and
 * both for the same reason: four kinds share it, and one of them contains
 * another post.
 *
 * THE ORDER IS BYLINE, BODY, ATTACHMENT, AGGREGATE, ACTIONS — the body comes
 * SECOND, which is the whole inversion from Lyra. There the picture is the post
 * and the caption trails it; here the writing is the post and the picture, link
 * or shared card is an attachment to it.
 *
 * THE WHOLE CARD IS NOT A LINK: wrapping it would swallow the reaction picker,
 * its six option buttons and the comment box.
 */

import { reactionSummary, route } from '@awc-ui/showcase-kit/community';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import {
  audienceMark,
  avatar,
  media,
  reactButton,
  reactionSummaryRow,
  verified,
  when,
} from '../lib/bits.mjs';
import { panel } from './shell.mjs';
import { commentThread } from './thread.mjs';

/** How long a body has to be before the "see more" control is written. */
const LONG_BODY = 180;

/* ------------------------------------------------------------- the byline */

function byline(t, locale, item, { compact = false } = {}) {
  const { post, author, group } = item;
  return html`<header class="post-card__head">
    <a class="post-card__author"${attrs({
      href: localeHref(locale, route.person(author.handle)),
    })}>${avatar(t, author, { size: compact ? 'small' : 'medium' })}</a>
    <div class="post-card__names">
      <span class="post-card__in">
        <a class="post-card__author"${attrs({
          href: localeHref(locale, route.person(author.handle)),
        })}><span class="person-row__name">${author.displayName}</span>${verified(t, author)}</a>
        ${group
          ? html`<span aria-hidden="true">&rsaquo;</span>
              <a class="post-card__group"${attrs({
                href: localeHref(locale, route.group(group.slug)),
                'aria-label': t('community.hint.postedIn', { group: group.name }),
              })}>${group.name}</a>`
          : null}
      </span>
      <span class="post-card__meta">
        <a class="when"${attrs({ href: localeHref(locale, route.post(post.id)) })}>${when(
          t,
          post.postedAt,
        )}</a>
        <span aria-hidden="true">&middot;</span>
        ${audienceMark(t, post.audience, post.audienceKey)}
        ${post.pinned
          ? html`<span aria-hidden="true">&middot;</span><span>${t('community.hint.pinned')}</span>`
          : null}
      </span>
    </div>
  </header>`;
}

/* --------------------------------------------------------------- the body */

function body(t, post) {
  const text = t(post.bodyKey);
  const long = text.length > LONG_BODY;
  return html`<p class="post-card__body"${attrs({ 'data-clamped': long })}>${text}</p>
    ${long
      ? html`<button type="button" class="post-card__more"${attrs({
          /* Both labels in the markup: the client swaps between them and has no
             dictionary of its own. */
          'data-more': t('community.action.seeMore'),
          'data-less': t('community.action.seeLess'),
        })}>${t('community.action.seeMore')}</button>`
      : null}`;
}

/* --------------------------------------------------------- the attachment */

function attachment(t, locale, item, { nested = false } = {}) {
  const { post } = item;

  if (post.media.length > 0) {
    return html`<div class="post-photos"${attrs({ 'data-count': String(post.media.length) })}>
      ${post.media.map(
        (m, index) => html`<a class="post-photos__cell"${attrs({
          href: localeHref(locale, route.post(post.id)),
          'aria-label': t(m.altKey),
        })}>${media(t, m, { eager: !nested && index === 0 })}</a>`,
      )}
    </div>`;
  }

  if (post.link) {
    /* NOT AN ANCHOR — nothing here navigates off the app, so a live href would
       put a real outbound request behind a fictional article; and a non-anchor
       can sit inside the post's own link target without nesting anchors. */
    return html`<md-tooltip${attrs({ text: t('community.hint.linkNotReal') })}>
      <div class="link-card">
        ${media(t, post.link.image, { className: 'link-card__image' })}
        <div class="link-card__text">
          <span class="link-card__domain">${post.link.domain}</span>
          <p class="link-card__title">${t(post.link.titleKey)}</p>
          <p class="link-card__about">${t(post.link.descriptionKey)}</p>
        </div>
      </div>
    </md-tooltip>`;
  }

  if (item.shared) {
    /* Rendered whole, byline and attachment and all, but NEVER its actions or
       comments: those belong to the original, and pressing them here would
       react to a post the reader is not looking at. */
    const inner = {
      post: item.shared.post,
      author: item.shared.author,
      group: item.shared.group,
      shared: null,
      preview: [],
      hiddenComments: 0,
    };
    return html`<div class="shared-post">
      ${byline(t, locale, inner, { compact: true })}
      ${body(t, inner.post)}
      ${attachment(t, locale, inner, { nested: true })}
    </div>`;
  }

  return null;
}

/* ---------------------------------------------------------------- the card */

export function postCard(t, locale, item, { showComments = false } = {}) {
  const { post } = item;
  const summary = reactionSummary(post.reactions, post.viewerReaction, post.viewerReaction);

  return panel({
    children: html`<article class="post-card"${attrs({ 'data-post': post.id })}>
      ${item.shared
        ? html`<p class="post-card__meta">${t(
            item.shared.group ? 'community.hint.sharedGroupPost' : 'community.hint.sharedPost',
            { name: item.author.displayName, group: item.shared.group?.name ?? '' },
          )}</p>`
        : null}

      ${byline(t, locale, item)}
      ${body(t, post)}
      ${attachment(t, locale, item)}

      ${reactionSummaryRow(t, {
        summary,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        shipped: post.viewerReaction !== null,
      })}

      <div class="post-actions">
        ${reactButton(t, { mine: post.viewerReaction })}
        <md-button${attrs({
          class: 'post-actions__comment',
          variant: 'text',
          icon: 'mode_comment',
          'aria-expanded': String(showComments),
        })}>${t('community.action.comment')}</md-button>
        <md-button${attrs({
          class: 'post-actions__share',
          variant: 'text',
          icon: 'share',
          'data-msg': t('community.msg.linkCopied'),
        })}>${t('community.action.share')}</md-button>
      </div>

      <!--
        THE THREAD IS WRITTEN EITHER WAY, but where it starts CLOSED it goes
        into a template rather than a hidden div.

        A hidden div was the first version and the parity census caught it: the
        census counts ELEMENTS, not visible ones, so a thread per card on the
        feed read as 64 extra avatars and 11 extra buttons against the four
        builds that render a thread only when it is open. A template's contents
        are an inert fragment outside the document, so they count for nothing —
        and cloning it still costs no translation, because every name, body and
        timestamp inside was written by the build in the page's language.
      -->
      ${showComments
        ? html`<div class="post-card__thread">
            ${post.commentsDisabled
              ? html`<p class="muted">${t('community.hint.commentsOff')}</p>`
              : commentThread(t, locale, post.id)}
          </div>`
        : html`<template class="post-card__thread-template">
            <div class="post-card__thread">
              ${post.commentsDisabled
                ? html`<p class="muted">${t('community.hint.commentsOff')}</p>`
                : commentThread(t, locale, post.id)}
            </div>
          </template>`}
    </article>`,
  });
}
