/**
 * Every mapping from a domain value to a colour, an icon or a piece of button
 * wording — in ONE place, so that a friendship state is the same blue in the
 * request row, the suggestion card and the profile header.
 *
 * A screen names the domain value. It never picks a colour. If you find
 * yourself writing `role === 'admin' ? 'primary' : …` in a component, the
 * mapping belongs here instead — that is the rule the other four verticals
 * follow and the reason their five builds agree.
 */

import type {
  Audience,
  Friendship,
  GroupPrivacy,
  GroupRole,
  PostKind,
  ReactionKind,
  Rsvp,
} from './types';

/** The tones `md-*` components accept for `color`. */
export type Tone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'error'
  | 'success'
  | 'warning'
  | 'info';

/* --------------------------------------------------------------- reactions */

/**
 * The six reactions, in picker order.
 *
 * ORDER IS DATA, not a sort. It is the order every product with this control
 * uses, so a reader's hand already knows where "love" is; sorting by count
 * would move the targets around under them, and sorting alphabetically would
 * differ per locale.
 */
export const REACTIONS: readonly ReactionKind[] = Object.freeze([
  'like',
  'love',
  'care',
  'haha',
  'wow',
  'sad',
]);

/**
 * The glyph for each reaction.
 *
 * MATERIAL SYMBOLS LIGATURES, not emoji, and that is a deliberate trade. Emoji
 * would look more like the product being evoked, but they render from whatever
 * font the reader's OS supplies — different art on every platform, colour that
 * ignores the theme, and a baseline that fights the text beside it. These are
 * the same self-hosted face as every other icon in the app, so they take the
 * theme's colour and sit on the text baseline.
 *
 * Only `.material-symbols-outlined` is self-hosted in this repository. Naming
 * any other family here renders the ligature as literal text — which is a
 * mistake this repository has made and shipped once already.
 */
export const reactionIcon: Record<ReactionKind, string> = {
  like: 'thumb_up',
  love: 'favorite',
  care: 'volunteer_activism',
  haha: 'mood',
  wow: 'sentiment_very_satisfied',
  sad: 'sentiment_dissatisfied',
};

/**
 * The colour each reaction is drawn in WHEN IT IS THE VIEWER'S OWN.
 *
 * An unselected reaction is never coloured — six coloured glyphs in a row is
 * six things shouting, which is the same argument Lyra's action row makes about
 * its single heart. The aggregate at the top of a post is also uncoloured for
 * that reason: it is a count, not a state.
 */
export const reactionTone: Record<ReactionKind, Tone> = {
  like: 'primary',
  love: 'error',
  care: 'warning',
  haha: 'warning',
  wow: 'warning',
  sad: 'info',
};

/* -------------------------------------------------------------- friendship */

/**
 * What the friendship button says and looks like, per state.
 *
 * FIVE STATES, AND `self` IS NULL — the same shape as Lyra's `followAction`,
 * for the same reason: a screen that has to render "add yourself as a friend"
 * has already gone wrong somewhere upstream, and returning `null` makes that a
 * missing button rather than an absurd one.
 *
 * The two pending states are the reason this table exists. They are the SAME
 * pending relationship seen from opposite ends, and they need opposite verbs:
 * somebody who asked you gets "Respond", somebody you asked gets "Cancel
 * request". A boolean cannot tell them apart, and an app built on one lets you
 * accept your own request.
 */
export interface FriendAction {
  labelKey: string;
  icon: string | null;
  variant: 'filled' | 'tonal' | 'outlined' | 'text';
}

export const friendAction: Record<Friendship, FriendAction | null> = {
  self: null,
  none: { labelKey: 'community.action.addFriend', icon: 'person_add', variant: 'filled' },
  outgoing: { labelKey: 'community.action.cancelRequest', icon: 'schedule', variant: 'outlined' },
  incoming: { labelKey: 'community.action.respond', icon: 'how_to_reg', variant: 'tonal' },
  friend: { labelKey: 'community.action.friends', icon: 'check', variant: 'outlined' },
};

/** The tone of the chip that names a relationship on a profile header. */
export const friendshipTone: Record<Friendship, Tone | null> = {
  self: null,
  none: null,
  outgoing: 'warning',
  incoming: 'info',
  friend: 'success',
};

/* ------------------------------------------------------------------ groups */

export const privacyIcon: Record<GroupPrivacy, string> = {
  public: 'public',
  private: 'lock',
};

export const privacyTone: Record<GroupPrivacy, Tone> = {
  public: 'info',
  private: 'secondary',
};

/**
 * The role chip. `none` earns no chip at all — a group the viewer is not in
 * should not carry a badge saying so, because the join button already does.
 */
export const roleTone: Record<GroupRole, Tone | null> = {
  admin: 'primary',
  moderator: 'tertiary',
  member: 'success',
  pending: 'warning',
  none: null,
};

export const roleIcon: Record<GroupRole, string | null> = {
  admin: 'shield_person',
  moderator: 'gavel',
  member: 'group',
  pending: 'hourglass_top',
  none: null,
};

/** What the join button offers, given where the viewer stands. */
export interface JoinAction {
  labelKey: string;
  icon: string;
  variant: 'filled' | 'tonal' | 'outlined' | 'text';
}

export const joinAction: Record<GroupRole, JoinAction | null> = {
  /* An admin cannot leave their own group in this app — there is no
     ownership-transfer flow behind it, so the control would be a dead end. */
  admin: null,
  moderator: { labelKey: 'community.action.leaveGroup', icon: 'logout', variant: 'text' },
  member: { labelKey: 'community.action.leaveGroup', icon: 'logout', variant: 'outlined' },
  pending: { labelKey: 'community.action.cancelRequest', icon: 'schedule', variant: 'outlined' },
  none: { labelKey: 'community.action.joinGroup', icon: 'group_add', variant: 'filled' },
};

/* ------------------------------------------------------------------ events */

export const rsvpIcon: Record<Rsvp, string> = {
  going: 'event_available',
  interested: 'star',
  invited: 'mail',
  declined: 'event_busy',
  none: 'event',
};

export const rsvpTone: Record<Rsvp, Tone | null> = {
  going: 'success',
  interested: 'warning',
  invited: 'info',
  declined: null,
  none: null,
};

/**
 * The three answers an event offers, in this order.
 *
 * `declined` is reachable but is not offered as a primary control: an event you
 * are not going to should take one press to dismiss and no space thereafter,
 * which is what the overflow does. Putting all four side by side gives equal
 * weight to the answer nobody is looking for.
 */
export const RSVP_CHOICES: readonly Rsvp[] = Object.freeze(['going', 'interested', 'declined']);

/* ------------------------------------------------------------------- posts */

/** The glyph beside a post's byline that says what kind of thing it is. */
export const postKindIcon: Record<PostKind, string | null> = {
  /* A plain text post earns no icon: it is the default, and a glyph on the
     commonest kind is a glyph on every row. */
  text: null,
  photo: 'image',
  link: 'link',
  share: 'repeat',
};

/* ---------------------------------------------------------------- audience */

/**
 * The audience glyph, shown next to the timestamp on every post.
 *
 * It is genuinely informative here in a way Lyra's was not: a network with
 * friends-only posts in it has to say which ones they are, or the reader cannot
 * tell what they are about to reply in front of.
 */
export const audienceIcon: Record<Audience, string> = {
  public: 'public',
  friends: 'group',
  'friends-of-friends': 'diversity_3',
  'only-me': 'lock',
};

export const AUDIENCES: readonly { value: Audience; labelKey: string; hintKey: string }[] =
  Object.freeze([
    {
      value: 'public',
      labelKey: 'community.audience.public',
      hintKey: 'community.audience.publicHint',
    },
    {
      value: 'friends',
      labelKey: 'community.audience.friends',
      hintKey: 'community.audience.friendsHint',
    },
    {
      value: 'friends-of-friends',
      labelKey: 'community.audience.fof',
      hintKey: 'community.audience.fofHint',
    },
    {
      value: 'only-me',
      labelKey: 'community.audience.onlyMe',
      hintKey: 'community.audience.onlyMeHint',
    },
  ]);
