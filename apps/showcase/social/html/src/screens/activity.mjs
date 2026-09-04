/**
 * Activity — what happened to you, newest first.
 *
 * GROUPED BY AGE, NOT PAGED. Four buckets from the kit — today, this week, this
 * month, earlier — and empty ones are dropped rather than rendered as a heading
 * over nothing. A notification list is read by recency and nothing else, so age
 * is the only structure worth imposing.
 *
 * THE SENTENCE IS A TRANSLATED TEMPLATE, not a name concatenated with a verb.
 * "{name} liked your post" is one dictionary entry per kind, so Arabic puts the
 * verb where Arabic puts the verb — building it here from a name and a label
 * would have hard-coded English word order into all three locales.
 *
 * READ AND UNREAD ARE BOTH IN THE LIST. Marking everything read is one button,
 * and it changes the badge in the rail. Filtering the read ones out would make
 * the button look like it deleted them.
 *
 * NO SNACKBAR ON THIS SCREEN, which is the one place the four raise-a-message
 * screens are five minus one. Marking everything read is not an action whose
 * effect needs reporting: the bold marks clear, the two badges go, and the
 * button itself leaves — the screen IS the confirmation, and a bar saying so
 * over the top of it would be a second, quieter copy of what just happened.
 */

import { activityGroups, getTotals, route } from '@awc-ui/showcase-kit/social';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { activityGlyph, avatar, count, media, when } from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

export function activityScreen(t, locale) {
  const totals = getTotals();
  const groups = activityGroups();
  const unread = totals.unreadActivityCount;

  return screen(t, {
    locale,
    here: route.activity(),
    title: t('social.screen.activity.title'),
    subtitle: t('social.screen.activity.subtitle'),
    aside: unread > 0 ? count(t, unread) : undefined,
    actions:
      unread > 0
        ? html`<md-button${attrs({
            class: 'activity-mark-all',
            variant: 'text',
            size: 'sm',
            icon: 'done_all',
          })}>${t('social.action.markAllRead')}</md-button>`
        : undefined,
    children: html`${groups.length === 0
        ? emptyState(t('social.empty.activity'))
        : groups.map((group) =>
            panel({
              title: t(group.labelKey),
              actions: count(t, group.rows.length),
              children: html`<md-list${attrs({
                label: t(group.labelKey),
                'interaction-mode': 'multi-action',
                'list-style': 'segmented',
              })}>
                ${group.rows.map(
                  ({ activity, actor, post }) => html`<md-list-item${attrs({
                    /* The unread mark is a data attribute driving a rule in
                       app.css, not a colour prop: md-list-item has no "unread"
                       state, and a bolder row is a better carrier than a tint a
                       reader has to compare against its neighbours. */
                    'data-unread': !activity.read,
                    headline: t(`social.activity.${activity.kind}`, { name: actor.displayName }),
                    'supporting-text': `@${actor.handle}`,
                    lines: '2',
                  })}>
                    <span slot="leading" class="activity-leading">
                      ${avatar(t, actor, { size: 'small' })}
                      ${activityGlyph(activity.kind)}
                    </span>
                    <span slot="trailing" class="activity-trailing">
                      ${when(t, activity.at)}
                      ${post
                        ? html`<a class="activity-thumb"${attrs({
                            href: localeHref(locale, route.post(post.id)),
                          })}>${media(t, post.media[0], { className: 'activity-thumb__img' })}</a>`
                        : null}
                    </span>
                  </md-list-item>`,
                )}
              </md-list>`,
            }),
          )}`,
  });
}
