/**
 * The small, repeated pieces: a count, a relative timestamp, the person line,
 * the media frames, the reaction control and the state chips.
 *
 * Each takes a domain value and resolves BOTH halves of it through the kit: the
 * COLOUR and the ICON through `status.ts`, the LABEL through the dictionary key
 * that travels beside the value. Nothing here contains English, so nothing here
 * can render English into a translated page.
 *
 * THE CONTRACT FOR SCREENS:
 *
 *   - Never call `Intl` and never call `toFixed`. Counts go through `<Count>`,
 *     timestamps through `<When>`, dates through `<DateText>`. All three are
 *     pinned to the page's locale, and the first two to the fixture's reporting
 *     instant rather than the clock.
 *   - Never render an `<img>` by hand. `<Media>` is the only place a picture is
 *     drawn and the only place that can guarantee the alt text.
 *   - Never write `role === 'admin' ? 'primary' : …`. Use the tone maps.
 *   - A `…Key` field is a dictionary key, not a label. Pass it to `t()`.
 */

import { useState, type ReactNode } from 'react';
import {
  REACTIONS,
  REPORTING_INSTANT,
  audienceIcon,
  friendAction,
  privacyIcon,
  privacyTone,
  reactionIcon,
  reactionTone,
  roleIcon,
  roleTone,
  rsvpIcon,
  rsvpTone,
  type Group,
  type Media as MediaRecord,
  type Person,
  type ReactionKind,
  type ReactionSummary,
  type Rsvp,
} from '@awc-ui/showcase-kit/community';
import { Link } from '@/lib/router';
import { useT } from '@/lib/showcase';
import { route } from '@/lib/routes';

/* ------------------------------------------------------------- formatting */

/**
 * A count.
 *
 * COMPACT ABOVE TEN THOUSAND, EXACT BELOW IT. Higher than Lyra's threshold, and
 * deliberately: the numbers here are members, friends and reactions, all of
 * which a reader compares between rows — "1.2K members" against "1.4K members"
 * is a comparison the rounding has already thrown away. Lyra's like counts are
 * not compared to anything.
 */
export function Count({ value, compact = false }: { value: number; compact?: boolean }) {
  const t = useT();
  return (
    <span className="num">
      {t.formatNumber(
        value,
        compact && value >= 10_000
          ? { notation: 'compact', maximumFractionDigits: 1 }
          : { maximumFractionDigits: 0 },
      )}
    </span>
  );
}

/**
 * How long ago, in words, inside a `<time>` that still carries the instant.
 *
 * Measured against `REPORTING_INSTANT`, never `Date.now()`. Every screenshot,
 * every parity comparison and every test would otherwise disagree with itself a
 * minute later.
 */
export function When({ at }: { at: string }) {
  const t = useT();
  return (
    <time dateTime={at} title={t.formatDate(at.slice(0, 10), 'long')} className="when">
      {t.formatRelativeTime(at, REPORTING_INSTANT, { style: 'narrow' })}
    </time>
  );
}

/**
 * A calendar date, for the one thing in this app that genuinely has one.
 *
 * AN EVENT IS NOT "IN 3 DAYS", IT IS ON A DATE. Relative time is right for a
 * post — the reader wants to know how fresh it is — and wrong for an event,
 * which the reader is planning around and has to put in a diary. This is the
 * exception convention 4 in the kit calls out.
 */
export function DateText({ at, style = 'medium' }: { at: string; style?: 'medium' | 'long' }) {
  const t = useT();
  return <time dateTime={at}>{t.formatDate(at.slice(0, 10), style)}</time>;
}

/** The time of day, for an event's start. */
export function TimeText({ at }: { at: string }) {
  const t = useT();
  const date = new Date(at);
  return (
    <time dateTime={at}>
      {new Intl.DateTimeFormat(t.locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(date)}
    </time>
  );
}

/* ------------------------------------------------------------------ chips */

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

/** A group's privacy. Always shown — it changes what a non-member can see. */
export function PrivacyChip({ group }: { group: Group }) {
  return (
    <StateChip labelKey={group.privacyKey} color={privacyTone[group.privacy]} icon={privacyIcon[group.privacy]} />
  );
}

/** The viewer's role in a group. `none` earns no chip — see the tone map. */
export function RoleChip({ group }: { group: Group }) {
  const tone = roleTone[group.role];
  if (!tone) return null;
  return <StateChip labelKey={group.roleKey} color={tone} icon={roleIcon[group.role] ?? undefined} />;
}

/** An RSVP state. `none` and `declined` earn no chip. */
export function RsvpChip({ rsvp, labelKey }: { rsvp: Rsvp; labelKey: string }) {
  const tone = rsvpTone[rsvp];
  if (!tone) return null;
  return <StateChip labelKey={labelKey} color={tone} icon={rsvpIcon[rsvp]} />;
}

/* ----------------------------------------------------------------- people */

export function Avatar({
  person,
  size = 'small',
  className,
}: {
  person: Person;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}) {
  const t = useT();
  return (
    <md-avatar
      class={className}
      src={person.avatar}
      name={person.displayName}
      initials={person.initials}
      size={size}
      /* `label` is the accessible name and `alt` the image's own. Both are set:
         the avatar is usually inside a link whose text already names the
         person, but the picture is generated artwork and naming it is
         convention 5. */
      label={person.displayName}
      alt={t('community.alt.arcs')}
    />
  );
}

export function Verified({ person }: { person: Person }) {
  const t = useT();
  if (!person.verified) return null;
  return (
    <md-tooltip text={t('community.verified')}>
      <span className="verified material-symbols-outlined" role="img" aria-label={t('community.verified')}>
        verified
      </span>
    </md-tooltip>
  );
}

/**
 * A person's name — WITH NO ANCHOR.
 *
 * Two callers are already links themselves. Putting `PersonLink` inside one
 * produced an `<a>` inside an `<a>`: invalid HTML that the DOM API builds
 * happily rather than unnesting the way a parser would, so nothing complains
 * and a screen reader gets two overlapping links for one name.
 */
export function PersonName({ person }: { person: Person }) {
  return (
    <>
      <span className="person-row__name">{person.displayName}</span>
      <Verified person={person} />
    </>
  );
}

/**
 * A person's name, linking to their profile.
 *
 * THE VIEWER'S OWN NAME LINKS TO `/profile/`, not to `/people/<handle>/`. Both
 * resolve, and the second would be a second URL for the same page — which is
 * how a "you" state ends up on a screen that has decided it is looking at
 * someone else.
 */
export function PersonLink({
  person,
  className = 'person-row__name',
  children,
}: {
  person: Person;
  className?: string;
  children?: ReactNode;
}) {
  const self = person.friendship === 'self';
  return (
    <Link className={className} href={self ? route.profile() : route.person(person.handle)}>
      {children ?? person.displayName}
    </Link>
  );
}

/**
 * The friendship button, in whichever of its five states applies.
 *
 * `onAct` receives the state the caller should move TO. The button holds no
 * state of its own: the screen owns the override, so a reload is a reset.
 *
 * THE TWO PENDING STATES ARE THE REASON THIS IS NOT A TOGGLE. Somebody who
 * asked you and somebody you asked are the same relationship from opposite
 * ends, and they need opposite verbs — which is why `friendAction` in the kit
 * is a table rather than a ternary, and why `incoming` routes to a pair of
 * Accept/Decline buttons rather than to this one.
 */
export function FriendButton({
  person,
  state,
  onAct,
  size = 'sm',
}: {
  person: Person;
  state: Person['friendship'];
  onAct: (next: Person['friendship']) => void;
  size?: 'sm' | 'md';
}) {
  const t = useT();
  const action = friendAction[state];
  if (!action) return null;

  /* Where each press goes. `incoming` is handled by the screen's own two
     buttons, so pressing this one only ever opens that choice — it never
     silently accepts. */
  const next: Person['friendship'] =
    state === 'none' ? 'outgoing' : state === 'outgoing' ? 'none' : state === 'friend' ? 'none' : 'incoming';

  return (
    <md-button
      variant={action.variant}
      size={size}
      icon={action.icon ?? undefined}
      data-person={person.id}
      onClick={() => onAct(next)}
    >
      {t(action.labelKey)}
    </md-button>
  );
}

/* ------------------------------------------------------------------ media */

/**
 * One picture, in a box whose height is reserved before it decodes.
 *
 * A feed that lets images size themselves reflows every post below the one that
 * just arrived. The ratio is known at build time, travels on the record, and is
 * applied from a CLASS rather than an inline style, because the deployed policy
 * is `style-src-attr 'none'` and would refuse the latter outright.
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
      className={className}
      data-aspect={media.aspect}
      src={media.src}
      alt={t(media.altKey)}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  );
}

/* -------------------------------------------------------------- reactions */

/**
 * The aggregate: up to three overlapping glyphs and a total.
 *
 * IT RENDERS NOTHING AT ZERO rather than "0 reactions". A post nobody has
 * reacted to should look like a post nobody has reacted to, not like a post
 * with a counter stuck at zero.
 */
export function ReactionSummaryRow({
  summary,
  commentCount,
  shareCount,
  onOpenComments,
}: {
  summary: ReactionSummary;
  commentCount: number;
  shareCount: number;
  onOpenComments?: () => void;
}) {
  const t = useT();
  if (summary.total === 0 && commentCount === 0 && shareCount === 0) return null;

  return (
    <div className="reactions">
      {summary.total > 0 ? (
        <>
          <span className="reactions__glyphs" aria-hidden="true">
            {summary.top.map((kind) => (
              <span key={kind} className="reactions__glyph">
                <span className="material-symbols-outlined">{reactionIcon[kind]}</span>
              </span>
            ))}
          </span>
          {/* The number is announced with its unit; the glyphs above are
              decoration and are hidden from the accessibility tree. */}
          <span className="reactions__count">
            {t('community.reaction.summary', { count: t.formatNumber(summary.total) })}
          </span>
        </>
      ) : null}
      <span className="reactions__spacer" />
      {commentCount > 0 ? (
        <button type="button" className="reactions__count comment__act" onClick={onOpenComments}>
          {t('community.action.viewComments', { count: t.formatNumber(commentCount) })}
        </button>
      ) : null}
      {shareCount > 0 ? (
        <span className="reactions__count">
          {t.formatNumber(shareCount)} {t('community.count.shares').toLocaleLowerCase(t.locale)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The react button and its six-option picker.
 *
 * OPENS ON HOVER WITH A POINTER, ON PRESS EVERYWHERE. The CSS handles the hover
 * and the focus case; this component only holds the pressed state, which is
 * what a touch reader and a keyboard reader both get. Both paths reach the same
 * six buttons, each with a real accessible name from the dictionary.
 *
 * PRESSING THE MAIN BUTTON TOGGLES `like` rather than opening the picker, which
 * is what every product of this shape does: the common case is one press for
 * the default reaction, and making that press open a menu instead would put a
 * second decision in front of the thing people actually want.
 */
export function ReactButton({
  mine,
  onPick,
}: {
  mine: ReactionKind | null;
  onPick: (next: ReactionKind | null) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = mine ?? 'like';

  return (
    <span className="react">
      <md-button
        class="react__main"
        variant="text"
        icon={reactionIcon[current]}
        color={mine ? reactionTone[mine] : undefined}
        data-on={mine ? '' : undefined}
        aria-label={t(mine ? `community.reaction.${mine}` : 'community.reaction.none')}
        onClick={() => onPick(mine ? null : 'like')}
      >
        {t(`community.reaction.${current}`)}
      </md-button>

      <span className="react__picker" data-open={open ? '' : undefined} role="group" aria-label={t('community.reaction.pick')}>
        {REACTIONS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="react__option"
            data-tone={reactionTone[kind]}
            data-reaction={kind}
            data-on={mine === kind ? '' : undefined}
            aria-pressed={mine === kind}
            aria-label={t(`community.reaction.${kind}`)}
            onClick={() => {
              onPick(mine === kind ? null : kind);
              setOpen(false);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {reactionIcon[kind]}
            </span>
          </button>
        ))}
      </span>

      {/* The touch path. `pointer: coarse` hides the hover affordance, so this
          is the only way in on a phone — and it is a real button with a name
          rather than a long-press nobody can discover. */}
      <md-icon-button
        class="react__toggle"
        icon="add_reaction"
        aria-label={t('community.reaction.pick')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
    </span>
  );
}

/* --------------------------------------------------------------- audience */

/** The little glyph beside a timestamp saying who can see a post. */
export function AudienceMark({ audience, labelKey }: { audience: Parameters<typeof audienceIcon.public extends never ? never : (a: keyof typeof audienceIcon) => void>[0]; labelKey: string }) {
  const t = useT();
  return (
    <md-tooltip text={t(labelKey)}>
      <span className="material-symbols-outlined" role="img" aria-label={t(labelKey)}>
        {audienceIcon[audience]}
      </span>
    </md-tooltip>
  );
}
