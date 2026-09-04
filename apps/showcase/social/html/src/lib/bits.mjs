/**
 * The small, repeated pieces: a formatted count, a relative timestamp, the
 * person line, the media frame, and the action row under a post.
 *
 * Each takes a domain value and resolves BOTH halves of it through the kit: the
 * COLOUR and the ICON through `status.ts`, the LABEL through the dictionary key
 * that travels beside the value. Nothing here contains English, so nothing here
 * can render English into a translated page.
 *
 * THIS IS THE CONTRACT FOR SCREENS. If you are writing one of the seven:
 *
 *   - Never call `Intl` and never call `toFixed`. Counts go through `count()`,
 *     timestamps through `when()`. Both are pinned to the page's locale, and
 *     `when()` is pinned to the fixture's reporting instant rather than the
 *     clock — which on a build that writes files and stops is not a nicety but
 *     the difference between a correct page and one that was correct once.
 *   - Never write an `<img>` by hand. `media()` is the only place a picture is
 *     drawn, and the only place that can guarantee the alt text and the
 *     reserved aspect box.
 *   - Never write `kind === 'like' ? 'error' : …`. Use the icon and tone maps.
 *   - A `…Key` field is a dictionary key, not a label. Pass it to `t()`.
 *
 * Each helper takes the translator explicitly. There is no context to read it
 * from: these run once per page at build time, and the locale is a property of
 * the route.
 */

import {
  REPORTING_INSTANT,
  accountKindTone,
  activityIcon,
  activityTone,
  countOptions,
  followAction,
  postKindIcon,
  route,
} from '@awc-ui/showcase-kit/social';
import { attrs, escape, html, raw } from './html.mjs';
import { localeHref } from './i18n.mjs';

/* ------------------------------------------------------------- formatting */

/**
 * A count.
 *
 * COMPACT ABOVE A THOUSAND, EXACT BELOW IT, and `exact` forces the long form
 * where the reader would dispute the rounding — a follower total on a profile
 * header is a number people check, a like count on a feed post is not. The
 * threshold and the digit rule are the kit's, not this function's.
 */
export function count(t, value, { exact = false } = {}) {
  return html`<span class="num">${t.formatNumber(value, countOptions(value, exact ? 'exact' : 'compact'))}</span>`;
}

/**
 * How long ago, in words, inside a `<time>` that still carries the instant.
 *
 * THE MACHINE-READABLE VALUE SURVIVES. "3h ago" is unambiguous to a reader and
 * useless to anything parsing the page, so the ISO instant stays in `datetime`
 * — and the `title` carries the full formatted date, which is what a reader who
 * actually wants the day does next.
 *
 * Measured against `REPORTING_INSTANT`, never the clock. On the four SPA builds
 * that keeps every screenshot and every parity comparison stable; on this one
 * it is stronger than that, because the alternative is baking the build
 * machine's wall clock into a file that is then served for a month.
 */
export function when(t, at, { style = 'narrow' } = {}) {
  return html`<time${attrs({
    datetime: at,
    title: t.formatDate(at.slice(0, 10), 'long'),
    class: 'when',
  })}>${t.formatRelativeTime(at, REPORTING_INSTANT, { style })}</time>`;
}

/* ------------------------------------------------------------------ chips */

/** Every chip in the app resolves its label and colour the same way. */
export function stateChip(t, { labelKey, color, icon, appearance = 'outlined', attributes = {} }) {
  return html`<md-chip${attrs({
    ...attributes,
    variant: 'assist',
    appearance,
    color,
    icon,
    label: t(labelKey),
  })}></md-chip>`;
}

/**
 * A topic, as a filter chip.
 *
 * `selected` is a BOOLEAN ATTRIBUTE — presence means true — so a false value
 * has to emit no attribute at all rather than `selected="false"`, which the
 * component would read as selected and the other four builds do not write.
 * `attrs()` already drops `false`, which is exactly why it does.
 */
export function topicChip(t, id, { selected = false } = {}) {
  return html`<md-chip${attrs({
    variant: 'filter',
    appearance: 'outlined',
    'data-topic': id,
    selected,
    label: t(`social.topic.${id}`),
  })}></md-chip>`;
}

/* ----------------------------------------------------------------- people */

/**
 * An avatar, with the story ring when there is a story behind it.
 *
 * THE RING IS A CLASS, NOT A BORDER PROP. `md-avatar` has no ring of its own,
 * and giving it one with a `style` attribute would be refused outright by the
 * deployed Content-Security-Policy (`style-src-attr 'none'`). So the state goes
 * on a wrapping span as a data attribute and `app.css` draws the ring, which
 * also lets the unseen and seen rings differ by more than colour.
 */
export function avatar(t, person, { size = 'small', ring = false } = {}) {
  const state = !ring ? 'none' : person.storyUnseen ? 'unseen' : person.hasStory ? 'seen' : 'none';

  return html`<span class="avatar"${attrs({ 'data-ring': state })}>
    <md-avatar${attrs({
      src: person.avatar,
      name: person.displayName,
      initials: person.initials,
      size,
      /* `label` is the accessible name and `alt` the image's own. Both are set:
         the avatar is inside a link whose text already names the person, so an
         empty alt would be right for a decorative image — but this one is
         generated portrait artwork and naming it is convention 5. */
      label: person.displayName,
      alt: t('social.alt.arcs'),
    })}></md-avatar>
    ${state === 'none'
      ? null
      : html`<span class="visually-hidden">${t(
          state === 'unseen' ? 'social.hint.storyUnseen' : 'social.hint.storySeen',
        )}</span>`}
  </span>`;
}

/** The blue tick, with a name a screen reader can read. */
export function verified(t, person) {
  if (!person.verified) return null;
  return html`<md-tooltip${attrs({ text: t('social.verified') })}><span${attrs({
    class: 'verified material-symbols-outlined',
    role: 'img',
    'aria-label': t('social.verified'),
  })}>verified</span></md-tooltip>`;
}

/**
 * A person's name, verified tick and optional handle — WITH NO ANCHOR.
 *
 * This exists because two callers are already links themselves. A post card's
 * header wraps the avatar AND the name in one target, and putting `personLink`
 * inside it produced an `<a>` inside an `<a>`: invalid HTML, which a parser
 * silently unnests into something nobody wrote and a screen reader reads as two
 * overlapping links for one name.
 *
 * So the presentation is here and the link is `personLink` below, which is just
 * this in an anchor. A caller uses whichever it is not already inside.
 */
export function personName(t, person, { showHandle = false } = {}) {
  return html`<span class="person-link__name">${person.displayName}</span>${verified(t, person)}${
    showHandle ? html`<span class="person-link__handle">@${person.handle}</span>` : null
  }`;
}

/**
 * A person's name and handle, linking to their profile.
 *
 * THE VIEWER'S OWN NAME LINKS TO `/profile/`, not to `/people/<their handle>/`.
 * Both would render, and the second would be a second URL for the same page —
 * which is the kind of thing that makes a "you" state appear on a screen that
 * has already decided it is looking at someone else.
 */
export function personLink(t, locale, person, { showHandle = false, children } = {}) {
  const self = person.relationship === 'self';
  return html`<a class="person-link"${attrs({
    href: localeHref(locale, self ? route.profile() : route.person(person.handle)),
  })}>${children ?? personName(t, person, { showHandle })}</a>`;
}

/** The account-type chip. `personal` earns none — see the kit's tone map. */
export function accountKindChip(t, person) {
  const tone = accountKindTone[person.kind];
  if (!tone) return null;
  return stateChip(t, { labelKey: person.kindKey, color: tone });
}

/**
 * The follow button, in whichever of its four states applies.
 *
 * WHAT IS WRITTEN HERE IS THE FIXTURE'S ANSWER, and the reader's override
 * arrives later: `src/client/engagement.mjs` re-labels the button in place when
 * it is pressed. Both states therefore have to be reachable from the markup, so
 * the OTHER state's label, icon and variant ride along on data attributes
 * rather than being computed in the browser — the client script has no
 * translator, and composing "Following" in JavaScript would put one English
 * word into all three locales.
 */
export function followButton(t, person, { following, size = 'sm' } = {}) {
  /* The kit's table answers for the FIXTURE's relationship; a viewer who has
     since pressed the button is either following or not, and the two remaining
     states are the only ones that can be shown after an override. */
  const reciprocal = person.relationship === 'follower' || person.relationship === 'mutual';
  const on = followAction[reciprocal ? 'mutual' : 'following'];
  const off = followAction[reciprocal ? 'follower' : 'none'];
  const action = following ? on : off;
  if (!action) return null;

  return html`<md-button${attrs({
    class: 'follow-button',
    variant: action.variant,
    size,
    icon: action.icon ?? undefined,
    'data-person': person.id,
    'data-following': following,
    'data-on-label': t(on.labelKey),
    'data-on-icon': on.icon ?? '',
    'data-on-variant': on.variant,
    'data-off-label': t(off.labelKey),
    'data-off-icon': off.icon ?? '',
    'data-off-variant': off.variant,
    /* The two snackbar sentences, already translated and with the name already
       substituted. The client picks one; it never builds one. */
    'data-msg-on': t('social.msg.followed', { name: person.displayName }),
    'data-msg-off': t('social.msg.unfollowed', { name: person.displayName }),
  })}>${t(action.labelKey)}</md-button>`;
}

/* ------------------------------------------------------------------ media */

/**
 * One picture, in a box whose height is reserved before it decodes.
 *
 * THIS IS THE WHOLE REASON THIS HELPER EXISTS. A feed that lets images size
 * themselves reflows every post below the one that just arrived — the single
 * most recognisable failure of a photo feed. The aspect ratio is known at build
 * time, travels on the record, and is applied from a CLASS (`data-aspect`)
 * rather than an inline style, because `style-src-attr 'none'` refuses the
 * latter outright.
 *
 * `loading` and `decoding` are set for the same reason: a grid of forty images
 * that all decode synchronously blocks the main thread on first paint.
 */
export function media(t, item, { className, eager = false } = {}) {
  return html`<img${attrs({
    class: className ? `media ${className}` : 'media',
    'data-aspect': item.aspect,
    src: item.src,
    alt: t(item.altKey),
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    draggable: 'false',
  })} />`;
}

/**
 * A post's pictures: one image, or a pager over several.
 *
 * THE PAGER IS BUTTONS AND DOTS, not a swipe handler. A swipe is not reachable
 * from a keyboard and this app is measured for that; the buttons are real
 * controls with real names, and the dots are a live region announcing which of
 * how many. On a touch screen the buttons are 48px under `pointer: coarse`.
 *
 * EVERY PICTURE IS IN THE MARKUP, and all but the first are `hidden`. The four
 * SPA builds swap one element's `src` from state; this build has no state, so
 * the alternative would be a client script that knows each picture's URL, alt
 * text and aspect ratio — three things the page already knows and one of which
 * (the alt) is translated. Paging is then an attribute flip on elements that
 * already exist, which is also what makes the page correct with JavaScript off:
 * the first picture is simply the picture.
 *
 * `href` puts the anchor around the IMAGE ONLY, never around the pager. Wrapped
 * around the whole frame it swallowed the two buttons, so paging to the next
 * picture navigated to the post instead — a control inside a link is broken
 * twice over: the click bubbles, and a keyboard press fires both.
 */
export function postMedia(t, post, { eager = false, href } = {}) {
  const total = post.media.length;

  const frame = (item, index) => {
    const picture = media(t, item, { eager: eager && index === 0 });
    const inner = href
      ? html`<a class="post-media__link"${attrs({ href })}>${picture}</a>`
      : picture;
    return html`<div class="post-media__frame"${attrs({
      'data-index': String(index),
      hidden: index > 0,
    })}>
      ${inner}
      ${post.kind === 'video' && item.durationSec !== null
        ? html`<span class="post-media__duration on-media"><span class="material-symbols-outlined" aria-hidden="true">${
            postKindIcon.video
          }</span>${t('social.hint.videoDuration', { seconds: t.formatNumber(item.durationSec) })}</span>`
        : null}
    </div>`;
  };

  return html`<div class="post-media"${attrs({ 'data-total': String(total) })}>
    ${post.media.map(frame)}
    ${total > 1
      ? html`<md-icon-button${attrs({
          class: 'post-media__nav post-media__nav--prev',
          icon: 'chevron_left',
          'aria-label': t('social.action.previous'),
          'soft-disabled': true,
        })}></md-icon-button>
        <md-icon-button${attrs({
          class: 'post-media__nav post-media__nav--next',
          icon: 'chevron_right',
          'aria-label': t('social.action.next'),
        })}></md-icon-button>
        <div class="post-media__dots" role="status">
          <!-- The count sentence is a TEMPLATE with two holes, refilled in place
               by the client when the picture changes. Never assembled in
               JavaScript: "1 of 4" puts its words in a different order in
               Arabic, and the client script has no dictionary. -->
          <span class="visually-hidden"${attrs({
            'data-count-template': t('social.postKind.carouselCount', {
              index: '%index%',
              total: '%total%',
            }),
          })}>${t('social.postKind.carouselCount', { index: 1, total })}</span>
          ${post.media.map(
            (item, index) => html`<span class="post-media__dot"${attrs({ 'data-on': index === 0 })}></span>`,
          )}
        </div>`
      : null}
  </div>`;
}

/* ---------------------------------------------------------------- actions */

/**
 * The row under a post: like, comment, share, save.
 *
 * THE HEART IS THE ONLY COLOURED CONTROL, and it is coloured only when it is
 * on. Four coloured icons is four things shouting; one is a state.
 *
 * Every button carries a real accessible name that says what pressing it will
 * DO — "Like" when it is off, "Unlike" when it is on — rather than naming the
 * icon. The counts are beside them as text, not inside the names, because a
 * screen reader reading "Like, 1,240" on every post in a feed is noise.
 *
 * As with the follow button, BOTH LABELS TRAVEL IN THE MARKUP: the client
 * script swaps between two translated strings rather than composing either.
 */
export function postActions(t, { postId, liked, saved }) {
  return html`<div class="post-actions"${attrs({ 'data-post': postId })}>
    <md-icon-button${attrs({
      class: 'post-actions__like',
      icon: liked ? 'favorite' : 'favorite_border',
      color: liked ? 'error' : undefined,
      'data-on': liked,
      'aria-label': t(liked ? 'social.action.unlike' : 'social.action.like'),
      'data-on-label': t('social.action.unlike'),
      'data-off-label': t('social.action.like'),
      'data-msg-on': t('social.msg.liked'),
    })}></md-icon-button>
    <md-icon-button${attrs({
      icon: 'mode_comment',
      'aria-label': t('social.action.comment'),
    })}></md-icon-button>
    <md-icon-button${attrs({
      class: 'post-actions__share',
      icon: 'send',
      'aria-label': t('social.action.share'),
      'data-msg': t('social.msg.linkCopied'),
    })}></md-icon-button>
    <span class="post-actions__spacer"></span>
    <md-icon-button${attrs({
      class: 'post-actions__save',
      icon: saved ? 'bookmark' : 'bookmark_border',
      'data-on': saved,
      'aria-label': t(saved ? 'social.action.unsave' : 'social.action.save'),
      'data-on-label': t('social.action.unsave'),
      'data-off-label': t('social.action.save'),
      'data-msg-on': t('social.msg.saved'),
      'data-msg-off': t('social.msg.unsaved'),
    })}></md-icon-button>
  </div>`;
}

/* --------------------------------------------------------------- activity */

/** The leading glyph on an activity row, in the kind's own tone. */
export function activityGlyph(kind) {
  return html`<span class="activity-icon"${attrs({
    'data-tone': activityTone[kind],
    'aria-hidden': 'true',
  })}><span class="material-symbols-outlined">${activityIcon[kind]}</span></span>`;
}

/* -------------------------------------------------------- search highlight */

/** The regex metacharacters, so a query can be dropped into a pattern. */
const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

/**
 * The mark's colours are a CONTAINER/ON-CONTAINER PAIR, never a literal — the
 * user-agent default (black on yellow) survives into the dark theme.
 */
const HIGHLIGHT_STYLE =
  'background:var(--md-sys-color-tertiary-container);' +
  'color:var(--md-sys-color-on-tertiary-container);' +
  'font-weight:500;padding-inline:1px;' +
  'border-radius:var(--md-sys-shape-corner-extra-small)';

/**
 * The run of `text` a search query matched, wrapped in `<mark>`.
 *
 * NEVER built by interpolating the query into markup: `split()` with ONE
 * capture group returns the pieces as strings and each one is escaped here, so
 * every match is escaped by construction.
 *
 * (The pre-rendered pages have no query — this is for the client enhancement,
 * which highlights the run a live search matched.)
 */
export function highlight(text, query) {
  const needle = (query ?? '').trim();
  if (!needle) return html`${text}`;

  const parts = String(text).split(
    new RegExp(`(${needle.replace(REGEX_METACHARACTERS, '\\$&')})`, 'gi'),
  );

  return raw(
    parts
      .map((part, index) =>
        index % 2 === 1 ? `<mark style="${HIGHLIGHT_STYLE}">${escape(part)}</mark>` : escape(part),
      )
      .join(''),
  );
}
