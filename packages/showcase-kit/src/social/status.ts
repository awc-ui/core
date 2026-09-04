/**
 * Domain value → component vocabulary. The ONLY place a colour or an icon is
 * chosen for this vertical.
 *
 * A screen names a domain value — `activity.kind`, `person.relationship` — and
 * looks the presentation up here. It never writes `kind === 'like' ? 'error' :
 * …` inline, because the same value appears on four screens and the fourth one
 * is where the ternaries stop agreeing.
 *
 * WHAT THIS VERTICAL HAS LESS OF, and it is worth saying out loud: the other
 * three map STATUS — a covenant breach, a budget over its cap, a card frozen —
 * onto a semantic colour that means "this is fine" or "this needs you". Almost
 * nothing here is a status. A photo is not in breach. So the mappings below are
 * mostly IDENTITY (which icon is a comment) rather than SEVERITY, and the two
 * places that do carry weight — an unread notification, a like the viewer has
 * given — are deliberately the only two that get a filled treatment.
 */
import type { AccountKind, ActivityKind, Aspect, Audience, PostKind, Relationship } from './types';

/** The library's semantic colour names, as the components accept them. */
export type Tone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'error'
  | 'success'
  | 'warning'
  | 'info';

/* --------------------------------------------------------------- activity */

/**
 * Material Symbols ligature per activity kind.
 *
 * `favorite` and `mode_comment` are the same glyphs the post's own action row
 * uses, so a notification and the button that produced it are visibly the same
 * verb. That correspondence is the reason these are not decorative choices.
 */
export const activityIcon: Record<ActivityKind, string> = {
  like: 'favorite',
  comment: 'mode_comment',
  follow: 'person_add',
  mention: 'alternate_email',
  tag: 'sell',
};

/**
 * A like is the one notification with a colour, and it is the heart's colour
 * rather than an alarm. Everything else is neutral on purpose: a wall of
 * coloured icons is a wall of noise, and none of these events needs a reader to
 * act.
 */
export const activityTone: Record<ActivityKind, Tone> = {
  like: 'error',
  comment: 'primary',
  follow: 'success',
  mention: 'tertiary',
  tag: 'secondary',
};

/* ------------------------------------------------------------------ posts */

/**
 * The badge a post carries in a grid, or `null` for a plain photo.
 *
 * `null` is load-bearing: a badge on every tile is a badge on none of them. A
 * single photo is the default and says nothing; a carousel and a video are the
 * exceptions worth marking, because both promise something a still does not.
 */
export const postKindIcon: Record<PostKind, string | null> = {
  photo: null,
  carousel: 'filter_none',
  video: 'play_arrow',
};

/** CSS `aspect-ratio` per ratio. Applied from a class, never an inline style. */
export const aspectRatio: Record<Aspect, string> = {
  square: '1 / 1',
  portrait: '4 / 5',
  landscape: '16 / 9',
};

/* ------------------------------------------------------------- the people */

/**
 * The follow button has FOUR states, and this is the table that keeps them
 * straight.
 *
 * Most implementations ship two — Follow and Following — and then have nothing
 * to say when the other person already follows you. "Follow back" is a
 * different offer from "Follow": it tells the reader something they did not
 * know. `self` is here so the button can be absent rather than inert.
 *
 * `variant` is the component's own prop. A relationship you have (`following`,
 * `mutual`) is `outlined`, because the action it offers is UNfollowing and a
 * filled button inviting you to undo something is the wrong emphasis.
 */
export interface FollowAction {
  labelKey: string;
  variant: 'filled' | 'tonal' | 'outlined';
  icon: string | null;
}

export const followAction: Record<Relationship, FollowAction | null> = {
  self: null,
  none: { labelKey: 'social.action.follow', variant: 'filled', icon: 'person_add' },
  follower: { labelKey: 'social.action.followBack', variant: 'filled', icon: 'person_add' },
  following: { labelKey: 'social.action.following', variant: 'outlined', icon: 'check' },
  mutual: { labelKey: 'social.action.friends', variant: 'outlined', icon: 'group' },
};

/** The chip beside a name on a profile. `personal` earns none. */
export const accountKindTone: Record<AccountKind, Tone | null> = {
  personal: null,
  creator: 'tertiary',
  business: 'info',
};

/* --------------------------------------------------------------- composer */

export const audienceIcon: Record<Audience, string> = {
  public: 'public',
  followers: 'group',
  close: 'star',
  private: 'lock',
};

/* ------------------------------------------------------------- engagement */

/**
 * How a count is written.
 *
 * COMPACT ABOVE A THOUSAND, EXACT BELOW IT, and the threshold is the whole
 * point. "1.2K likes" is how a feed reads and nobody minds the rounding; "1.2K
 * followers" on the profile of someone with 1,180 is a number they would
 * dispute. So the profile header asks for `exact` and the feed does not, and
 * this returns the `Intl` options rather than a formatted string so both go
 * through the locale's own formatter.
 */
export function countOptions(value: number, style: 'compact' | 'exact' = 'compact') {
  if (style === 'exact' || value < 1000) return { maximumFractionDigits: 0 } as const;
  return {
    notation: 'compact',
    maximumFractionDigits: value < 10_000 ? 1 : 0,
  } as const;
}
