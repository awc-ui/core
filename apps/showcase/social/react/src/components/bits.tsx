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
 *   - Never call `Intl` and never call `toFixed`. Counts go through `<Count>`,
 *     timestamps through `<When>`. Both are pinned to the page's locale, and
 *     `<When>` is pinned to the fixture's reporting instant rather than the
 *     clock.
 *   - Never render an `<img>` by hand. `<Media>` is the only place a picture is
 *     drawn, and it is the only place that can guarantee the alt text and the
 *     reserved aspect box.
 *   - Never write `kind === 'like' ? 'error' : …`. Use the icon and tone maps.
 *   - A `…Key` field is a dictionary key, not a label. Pass it to `t()`.
 */

import { useState, type ReactNode } from 'react';
import {
  REPORTING_INSTANT,
  accountKindTone,
  activityIcon,
  activityTone,
  countOptions,
  followAction,
  postKindIcon,
  route,
  type Media as MediaRecord,
  type Person,
  type Post,
} from '@awc-ui/showcase-kit/social';
import { Link } from '@/lib/router';
import { useT } from '@/lib/showcase';

/* ------------------------------------------------------------- formatting */

/**
 * A count.
 *
 * COMPACT ABOVE A THOUSAND, EXACT BELOW IT, and `exact` forces the long form
 * where the reader would dispute the rounding — a follower total on a profile
 * header is a number people check, a like count on a feed post is not. The
 * threshold and the digit rule are the kit's, not this component's.
 */
export function Count({ value, exact = false }: { value: number; exact?: boolean }) {
  const t = useT();
  return <span className="num">{t.formatNumber(value, countOptions(value, exact ? 'exact' : 'compact'))}</span>;
}

/**
 * How long ago, in words, inside a `<time>` that still carries the instant.
 *
 * THE MACHINE-READABLE VALUE SURVIVES. "3h ago" is unambiguous to a reader and
 * useless to anything parsing the page, so the ISO instant stays in `datetime`
 * — and the `title` carries the full formatted date, which is what a reader who
 * actually wants the day does next.
 *
 * Measured against `REPORTING_INSTANT`, never `Date.now()`. Every screenshot,
 * every parity comparison and every test would otherwise disagree with itself a
 * minute later.
 */
export function When({ at, style = 'narrow' }: { at: string; style?: 'narrow' | 'short' | 'long' }) {
  const t = useT();
  return (
    <time dateTime={at} title={t.formatDate(at.slice(0, 10), 'long')} className="when">
      {t.formatRelativeTime(at, REPORTING_INSTANT, { style })}
    </time>
  );
}

/* ------------------------------------------------------------------ chips */

/** Every chip in the app resolves its label and colour the same way. */
export function StateChip({
  labelKey,
  color,
  icon,
  appearance = 'outlined',
}: {
  labelKey: string;
  color?: string;
  icon?: string;
  appearance?: 'outlined' | 'filled';
}) {
  const t = useT();
  return <md-chip variant="assist" appearance={appearance} color={color} icon={icon} label={t(labelKey)} />;
}

export function TopicChip({ id, selected }: { id: string; selected?: boolean }) {
  const t = useT();
  return (
    <md-chip
      variant="filter"
      appearance="outlined"
      data-topic={id}
      /* `|| undefined` so a false value emits NO ATTRIBUTE. `selected` is a
         boolean attribute — presence means true — and React writes
         `selected="false"` for a literal false, which the Svelte port omits
         entirely. Two builds would then disagree on the DOM for a chip that is
         simply not chosen. */
      selected={selected || undefined}
      label={t(`social.topic.${id}`)}
    />
  );
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
export function Avatar({
  person,
  size = 'small',
  ring = false,
}: {
  person: Person;
  size?: 'small' | 'medium' | 'large';
  ring?: boolean;
}) {
  const t = useT();
  const state = !ring ? 'none' : person.storyUnseen ? 'unseen' : person.hasStory ? 'seen' : 'none';

  return (
    <span className="avatar" data-ring={state}>
      <md-avatar
        src={person.avatar}
        name={person.displayName}
        initials={person.initials}
        size={size}
        /* `label` is the accessible name and `alt` the image's own. Both are
           set: the avatar is inside a link whose text already names the person,
           so an empty alt would be right for a decorative image — but this one
           is generated portrait artwork and naming it is convention 5. */
        label={person.displayName}
        alt={t('social.alt.arcs')}
      />
      {state === 'none' ? null : (
        <span className="visually-hidden">
          {t(state === 'unseen' ? 'social.hint.storyUnseen' : 'social.hint.storySeen')}
        </span>
      )}
    </span>
  );
}

/** The blue tick, with a name a screen reader can read. */
export function Verified({ person }: { person: Person }) {
  const t = useT();
  if (!person.verified) return null;
  return (
    <md-tooltip text={t('social.verified')}>
      <span className="verified material-symbols-outlined" role="img" aria-label={t('social.verified')}>
        verified
      </span>
    </md-tooltip>
  );
}

/**
 * A person's name, verified tick and optional handle — WITH NO ANCHOR.
 *
 * This exists because two callers are already links themselves. A post card's
 * header wraps the avatar AND the name in one target, and putting `PersonLink`
 * inside it produced an `<a>` inside an `<a>`: invalid HTML, and the DOM API
 * builds it happily rather than unnesting it the way a parser would, so nothing
 * complains and a screen reader gets two overlapping links for one name.
 *
 * So the presentation is here and the link is `PersonLink` below, which is just
 * this in an anchor. A caller uses whichever it is not already inside.
 */
export function PersonName({
  person,
  showHandle = false,
}: {
  person: Person;
  showHandle?: boolean;
}) {
  return (
    <>
      <span className="person-link__name">{person.displayName}</span>
      <Verified person={person} />
      {showHandle ? <span className="person-link__handle">@{person.handle}</span> : null}
    </>
  );
}

/**
 * A person's name and handle, linking to their profile.
 *
 * THE VIEWER'S OWN NAME LINKS TO `/profile/`, not to `/people/<their handle>/`.
 * Both would render, and the second would be a second URL for the same page —
 * which is the kind of thing that makes a "you" state appear on a screen that
 * has already decided it is looking at someone else.
 */
export function PersonLink({
  person,
  showHandle = false,
  children,
}: {
  person: Person;
  showHandle?: boolean;
  children?: ReactNode;
}) {
  const self = person.relationship === 'self';
  return (
    <Link
      className="person-link"
      href={self ? route.profile() : route.person(person.handle)}
    >
      {children ?? <PersonName person={person} showHandle={showHandle} />}
    </Link>
  );
}

/** The account-type chip. `personal` earns none — see the kit's tone map. */
export function AccountKindChip({ person }: { person: Person }) {
  const tone = accountKindTone[person.kind];
  if (!tone) return null;
  return <StateChip labelKey={person.kindKey} color={tone} />;
}

/**
 * The follow button, in whichever of its four states applies.
 *
 * `onToggle` receives the state the caller should move TO. The button holds no
 * state of its own: the screen owns the override, exactly as the banking cards
 * screen owns a card's freeze, so a reload is a reset.
 */
export function FollowButton({
  person,
  following,
  onToggle,
  size = 'sm',
}: {
  person: Person;
  following: boolean;
  onToggle: (next: boolean) => void;
  size?: 'sm' | 'md';
}) {
  const t = useT();
  /* The kit's table answers for the FIXTURE's relationship; a viewer who has
     since pressed the button is either following or not, and the two remaining
     states are the only ones that can be shown after an override. */
  const action = following
    ? followAction[person.relationship === 'follower' || person.relationship === 'mutual' ? 'mutual' : 'following']
    : followAction[person.relationship === 'follower' || person.relationship === 'mutual' ? 'follower' : 'none'];
  if (!action) return null;

  return (
    <md-button
      variant={action.variant}
      size={size}
      icon={action.icon ?? undefined}
      onClick={() => onToggle(!following)}
    >
      {t(action.labelKey)}
    </md-button>
  );
}

/* ------------------------------------------------------------------ media */

/**
 * One picture, in a box whose height is reserved before it decodes.
 *
 * THIS IS THE WHOLE REASON THIS COMPONENT EXISTS. A feed that lets images size
 * themselves reflows every post below the one that just arrived — the single
 * most recognisable failure of a photo feed. The aspect ratio is known at build
 * time, travels on the record, and is applied from a CLASS (`data-aspect`)
 * rather than an inline style, because `style-src-attr 'none'` refuses the
 * latter outright.
 *
 * `loading` and `decoding` are set for the same reason: a grid of forty images
 * that all decode synchronously blocks the main thread on first paint.
 */
export function Media({
  media,
  className,
  eager = false,
}: {
  media: MediaRecord;
  className?: string;
  eager?: boolean;
}) {
  const t = useT();
  return (
    <img
      className={className ? `media ${className}` : 'media'}
      data-aspect={media.aspect}
      src={media.src}
      alt={t(media.altKey)}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}

/**
 * A post's pictures: one image, or a pager over several.
 *
 * THE PAGER IS BUTTONS AND DOTS, not a swipe handler. A swipe is not reachable
 * from a keyboard and this app is measured for that; the buttons are real
 * controls with real names, and the dots are a live region announcing which of
 * how many. On a touch screen the buttons are 48px under `pointer: coarse`.
 *
 * The index resets when the post changes because the component is keyed by post
 * id at every call site — a pager left on picture 4 of a post that has since
 * been replaced by one with two pictures is the bug this avoids.
 */
export function PostMedia({
  post,
  eager = false,
  href,
}: {
  post: Post;
  eager?: boolean;
  /**
   * Where the PICTURE goes when pressed. The pager buttons deliberately do not.
   *
   * THE LINK HAS TO BE IN HERE RATHER THAN AROUND THE WHOLE THING, and that is
   * the entire reason this prop exists. The feed card wrapped `<PostMedia>` in
   * an anchor, which put the two pager buttons inside it — so paging to the
   * next picture navigated to the post instead. A control inside a link is
   * broken twice over: the click bubbles, and a keyboard press fires both.
   *
   * With the anchor around only the image, the arrows and the dots are its
   * siblings and the two targets do not overlap.
   */
  href?: string;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const total = post.media.length;
  const media = post.media[Math.min(index, total - 1)];

  return (
    <div className="post-media">
      {href ? (
        <Link className="post-media__link" href={href}>
          <Media media={media} eager={eager} />
        </Link>
      ) : (
        <Media media={media} eager={eager} />
      )}

      {/* `on-media` carries the contrast pair — see the note on that class:
          anything sitting on a photograph needs a colour that does not depend on
          the theme behind it. The comment is OUT here rather than inside the
          ternary: a branch has to be one expression, and `{/* … *​/}` beside the
          element is a second one. */}
      {post.kind === 'video' && media.durationSec !== null ? (
        <span className="post-media__duration on-media">
          <span className="material-symbols-outlined" aria-hidden="true">
            {postKindIcon.video}
          </span>
          {t('social.hint.videoDuration', { seconds: t.formatNumber(media.durationSec) })}
        </span>
      ) : null}

      {total > 1 ? (
        <>
          <md-icon-button
            class="post-media__nav post-media__nav--prev"
            icon="chevron_left"
            aria-label={t('social.action.previous')}
            soft-disabled={index === 0 || undefined}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          />
          <md-icon-button
            class="post-media__nav post-media__nav--next"
            icon="chevron_right"
            aria-label={t('social.action.next')}
            soft-disabled={index === total - 1 || undefined}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          />
          <div className="post-media__dots" role="status">
            <span className="visually-hidden">
              {t('social.postKind.carouselCount', { index: index + 1, total })}
            </span>
            {post.media.map((item, i) => (
              <span key={item.id} className="post-media__dot" data-on={i === index ? '' : undefined} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
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
 */
export function PostActions({
  liked,
  saved,
  onLike,
  onSave,
  onComment,
  onShare,
}: {
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onSave: () => void;
  onComment: () => void;
  onShare: () => void;
}) {
  const t = useT();
  return (
    <div className="post-actions">
      <md-icon-button
        class="post-actions__like"
        icon={liked ? 'favorite' : 'favorite_border'}
        color={liked ? 'error' : undefined}
        data-on={liked ? '' : undefined}
        aria-label={t(liked ? 'social.action.unlike' : 'social.action.like')}
        onClick={onLike}
      />
      <md-icon-button icon="mode_comment" aria-label={t('social.action.comment')} onClick={onComment} />
      <md-icon-button icon="send" aria-label={t('social.action.share')} onClick={onShare} />
      <span className="post-actions__spacer" />
      <md-icon-button
        icon={saved ? 'bookmark' : 'bookmark_border'}
        data-on={saved ? '' : undefined}
        aria-label={t(saved ? 'social.action.unsave' : 'social.action.save')}
        onClick={onSave}
      />
    </div>
  );
}

/* --------------------------------------------------------------- activity */

/** The leading glyph on an activity row, in the kind's own tone. */
export function ActivityIcon({ kind }: { kind: keyof typeof activityIcon }) {
  return (
    <span className="activity-icon" data-tone={activityTone[kind]} aria-hidden="true">
      <span className="material-symbols-outlined">{activityIcon[kind]}</span>
    </span>
  );
}
