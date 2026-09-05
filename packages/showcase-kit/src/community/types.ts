/**
 * Domain model for the "Corvus — Friends & Groups" showcase vertical.
 *
 * A social network in the older sense: a feed of what the people and groups you
 * belong to have written, a bidirectional friends graph with requests in it,
 * groups with roles, and events with an RSVP. It is the FIFTH vertical and the
 * SECOND social one, so the first thing this file has to justify is why it is
 * not Lyra with different nouns.
 *
 * WHAT MAKES IT A DIFFERENT APPLICATION FROM LYRA, in the order the difference
 * costs component work:
 *
 *   - THE POST IS PROSE, NOT A PICTURE. Lyra's post is an image with a caption
 *     under it; take the image away and there is nothing left. Here the body is
 *     the post, an image is optional, and two of the four kinds have no image
 *     at all. That inverts the card: the text leads, it has to truncate at a
 *     line count with a "see more", and the card's height is a function of
 *     prose rather than of a known aspect ratio.
 *   - A POST CAN CONTAIN A POST. A share renders the original inside itself,
 *     with its own author line and its own media — a card nested in a card, two
 *     levels of surface, and a link target that must not swallow the outer
 *     card's controls. Lyra has no equivalent.
 *   - REACTIONS ARE A SET, NOT A BOOLEAN. Six of them, aggregated per post,
 *     with the top three shown as overlapping glyphs and the rest as a count.
 *     Lyra's heart is on or off; this needs a picker, a current selection, and
 *     an aggregate that changes shape as the counts move.
 *   - COMMENTS NEST TWICE. Lyra's thread is one level deep and the fixture
 *     asserts it. Here a reply can itself be replied to, which means a real
 *     tree, a collapse control, and an indent that cannot simply be a constant.
 *   - THE GRAPH IS BIDIRECTIONAL AND HAS A WAITING ROOM. Following is a
 *     one-sided verb; friendship is two-sided and therefore has REQUESTS, which
 *     are a state neither party has agreed to yet. `Friendship` has five values
 *     and two of them are pending in opposite directions.
 *   - GROUPS AND EVENTS ARE FIRST-CLASS OBJECTS with their own membership state
 *     machines — a role in a group, an RSVP to an event — and a post can be
 *     authored INTO a group, which gives the feed a second kind of byline.
 *
 * Everything is a plain, serialisable value. There is no runtime clock and no
 * randomness: the fixture is generated once at authoring time from a seeded
 * PRNG (`scripts/generate-community-fixture.mjs`) and baked into
 * `generated.ts`, so every framework build renders byte-identical output.
 *
 * THE THREE CONVENTIONS every fixture in this repository follows:
 *
 *   1. Every ratio is a FRACTION. `0.0135` means 1.35%. Pass them straight to
 *      `t.formatPercent()`, which multiplies by 100 itself.
 *   2. Every enum-ish value carries a `…Key` twin (`role` / `roleKey`) that
 *      resolves through the shared dictionary. Render the key, never the raw
 *      value — the raw value is for logic and for `status.ts`.
 *   3. Proper nouns live here untranslated; prose lives in the dictionary. A
 *      person's display name, a group's name and a link's domain are fixture
 *      data. Every body, description and comment is a `…Key`, because those are
 *      sentences and this app ships in three languages.
 *
 * AND THE TWO LYRA ADDED, which apply here unchanged and for the same reasons:
 *
 *   4. TIME IS AN INSTANT, NOT A DATE. Every timestamp is a full UTC instant
 *      rendered against `REPORTING_INSTANT` through
 *      `t.formatRelativeTime(at, REPORTING_INSTANT)` — never against the clock,
 *      or the screenshots would age. The one exception is an EVENT, which
 *      genuinely has a calendar date a reader plans around; those are still
 *      instants in the data and are formatted as dates on screen.
 *   5. EVERY IMAGE IS SELF-DESCRIBING. Every `Media` carries an `altKey` and no
 *      screen may render an `<img>` without resolving it.
 *
 * WHERE THE PICTURES COME FROM. There are no photographs here and no CDN, for
 * the three reasons Lyra's `types.ts` sets out at length: the deployed policy
 * is `img-src 'self' data:` so a remote image is refused outright; the parity
 * check compares document heights across five builds and anything that could
 * load at a different size would make that meaningless; and real photographs
 * are megabytes of binaries plus a licence audit per file. Every `src` is a
 * `data:image/svg+xml` URI holding a few hundred bytes of deterministic
 * generated artwork.
 */

/* --------------------------------------------------------------- constants */

/**
 * The frozen instant everything is measured from.
 *
 * A WEDNESDAY EVENING, and the day of the week is load-bearing here in a way it
 * was not for Lyra: this app has an events screen, and an events screen with
 * nothing this week reads as a dead app while one where everything is today
 * reads as a fixture. Mid-week leaves two events behind the reader and four in
 * front of them, which is the shape a real calendar has.
 */
export const REPORTING_INSTANT = '2026-10-14T17:40:00Z';

/** The calendar day `REPORTING_INSTANT` falls on, for the date-only fields. */
export const REPORTING_DATE = '2026-10-14';

/** The handle of the person whose session this is. */
export const VIEWER_HANDLE = 'petra.novak';

/** How many posts the feed shows before its "you're all caught up" marker. */
export const FEED_PAGE = 10;

/** How many comments a post shows before "view more". */
export const COMMENT_PAGE = 3;

/**
 * How many replies a comment shows before collapsing the rest.
 *
 * TWO, not three, and lower than the top-level page on purpose: a reply is
 * already indented and a run of them at the same indent is the thing that makes
 * a comment section unreadable. The collapse control is where the depth is
 * actually managed.
 */
export const REPLY_PAGE = 2;

/**
 * Media aspect ratios, as CSS `aspect-ratio` values.
 *
 * The same three Lyra uses and for the same reason — a card must reserve its
 * image's height before the image decodes — with one addition. `wide` is the
 * link-preview and cover-image ratio: those are not photographs the reader is
 * looking AT, they are a band of colour behind a headline, and 2:1 is the
 * proportion that reads as a banner rather than as a picture.
 */
export const ASPECT_RATIO: Record<Aspect, string> = {
  square: '1 / 1',
  portrait: '4 / 5',
  landscape: '16 / 9',
  wide: '2 / 1',
};

/* ------------------------------------------------------------------ unions */

export type Aspect = 'square' | 'portrait' | 'landscape' | 'wide';

/**
 * What a post IS, which here is a question about its body rather than its
 * picture.
 *
 *   `text`   prose and nothing else. The most common kind, and the one Lyra
 *            cannot represent at all.
 *   `photo`  prose plus one to four images.
 *   `link`   prose plus a link-preview card — a domain, a headline, a line of
 *            description and a banner image.
 *   `share`  prose plus another post, rendered whole inside this one.
 *
 * There is deliberately no `poll` and no `life-event`. Both are real Facebook
 * post types and both would be a second interactive widget inside a card that
 * is already the most complex component in the app; the four above cover every
 * LAYOUT problem this vertical exists to demonstrate.
 */
export type PostKind = 'text' | 'photo' | 'link' | 'share';

/**
 * The six reactions.
 *
 * Six, not one, and that is the point of them: an aggregate of six values has a
 * shape — which three lead, by how much, and how the tail is summarised — that
 * a boolean does not. The order here is the order they appear in the picker and
 * in the aggregate, and it is not alphabetical or by count: it is the order
 * every product with this control uses, which readers already know.
 */
export type ReactionKind = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad';

/**
 * Who someone is to the viewer.
 *
 * FIVE VALUES, AND TWO OF THEM ARE THE SAME PENDING STATE SEEN FROM OPPOSITE
 * ENDS. That is the whole difference from Lyra's `Relationship`: following is
 * one-sided, so it is a boolean with decoration, and a request cannot exist.
 * Friendship is an agreement, so there is a gap between asking and being
 * answered, and the button says something different depending on which side of
 * that gap you are on — "Respond" to someone who asked you, "Cancel request" to
 * someone you asked. Building this with a boolean produces an app where you can
 * accept your own request.
 */
export type Friendship = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

/** What a group lets non-members see. Drives one chip and the join button. */
export type GroupPrivacy = 'public' | 'private';

/**
 * The viewer's standing in a group.
 *
 * `none` and `pending` are both "not a member", and they are separate because
 * the button differs and because a private group shows a pending request its
 * own way. `admin` and `moderator` differ only in what the drill screen says
 * about them — this app has no moderation tools, and inventing some would be
 * four controls that do nothing.
 */
export type GroupRole = 'admin' | 'moderator' | 'member' | 'pending' | 'none';

/** The viewer's answer to an event. `invited` is an unanswered invitation. */
export type Rsvp = 'going' | 'interested' | 'invited' | 'declined' | 'none';

/** The composer's audience picker. */
export type Audience = 'public' | 'friends' | 'friends-of-friends' | 'only-me';

/* ------------------------------------------------------------------ people */

export interface Person {
  id: string;
  /** Without the `@`. Screens add the sigil; it is punctuation, not data. */
  handle: string;
  /** A proper noun. Never translated. */
  displayName: string;
  /** Two letters for `md-avatar`, for the moment before the image decodes. */
  initials: string;
  /** Generated portrait artwork, as a data URI. */
  avatar: string;
  /** The banner behind the profile header. Generated, `wide`. */
  cover: Media;
  /** Dictionary key — a bio is a sentence. */
  bioKey: string;
  friendship: Friendship;
  friendshipKey: string;
  /**
   * Friends in common. The single most persuasive thing on a suggestion row,
   * and meaningless in a follower graph — which is why Lyra has no such field.
   */
  mutualCount: number;
  friendCount: number;
  /** Dictionary keys, or `null` where they say nothing. */
  locationKey: string | null;
  workKey: string | null;
  /** When they joined Corvus. Rendered as a month and year, never relative. */
  joinedAt: string;
  /**
   * Month and day only, as `--MM-DD`. No year, deliberately: the right rail
   * says whose birthday it is, and a fixture that also stated everyone's age
   * would be inventing a fact it has no reason to hold.
   */
  birthday: string;
  verified: boolean;
  /** Set when the request in `friendship` is waiting on somebody. */
  requestedAt: string | null;
}

/* ------------------------------------------------------------------- media */

export interface Media {
  id: string;
  aspect: Aspect;
  /** `data:image/svg+xml,…` — see the note at the top of this file. */
  src: string;
  /** Dictionary key describing the artwork. Convention 5: never omit it. */
  altKey: string;
}

/* -------------------------------------------------------------- link cards */

export interface LinkPreview {
  /**
   * The domain, as a proper noun and NOT a working URL.
   *
   * Nothing in this app navigates off it: a link card is a layout — a banner, a
   * domain in small caps, a headline that truncates at two lines — and giving
   * it a live `href` would put a real outbound request behind a fictional
   * article. The card renders as a non-anchor for that reason, which is also
   * why it can sit inside the post's own link target without nesting anchors.
   */
  domain: string;
  titleKey: string;
  descriptionKey: string;
  image: Media;
}

/* ------------------------------------------------------------------- posts */

/**
 * A count per reaction kind. Absent keys are zero — the fixture omits them
 * rather than writing sixteen zeroes per post, and `reactionTotal()` in
 * `derive.ts` is the only thing that should be summing it.
 */
export type ReactionCounts = Partial<Record<ReactionKind, number>>;

export interface Post {
  id: string;
  /** Always a person: a group post still has a human author. */
  authorId: string;
  /**
   * The group it was posted INTO, or `null` for a post on the author's own
   * timeline. Drives the feed's second byline shape — "Ada Lindqvist posted in
   * Nordic Film Club" — which is a different line from "Ada Lindqvist".
   */
  groupId: string | null;
  kind: PostKind;
  kindKey: string;
  /** Dictionary key — a body is prose, and here it is the post itself. */
  bodyKey: string;
  /** Empty for `text`, `link` and `share`; one to four items for `photo`. */
  media: Media[];
  /** Set on `link` posts only. */
  link: LinkPreview | null;
  /** Set on `share` posts only — the id of the post being shared. */
  sharedPostId: string | null;
  postedAt: string;
  reactions: ReactionCounts;
  /** The viewer's own reaction as the fixture ships it, or `null`. */
  viewerReaction: ReactionKind | null;
  commentCount: number;
  shareCount: number;
  audience: Audience;
  audienceKey: string;
  /** Pinned posts lead a profile's or a group's timeline regardless of date. */
  pinned: boolean;
  commentsDisabled: boolean;
}

/* ---------------------------------------------------------------- comments */

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  /** Dictionary key — a comment is prose. */
  bodyKey: string;
  postedAt: string;
  reactions: ReactionCounts;
  viewerReaction: ReactionKind | null;
  /** The comment this replies to, or `null` at the top level. */
  replyToId: string | null;
  /**
   * 0, 1 or 2. Stored rather than walked, because every screen that renders a
   * thread needs it and the alternative is each of five builds writing the same
   * recursion slightly differently. The generator asserts it never exceeds 2 —
   * see convention: the tree is bounded, so the indent can be too.
   */
  depth: number;
}

/* ------------------------------------------------------------------ groups */

export interface Group {
  id: string;
  /** URL-safe, and what `route.group()` addresses. */
  slug: string;
  /** A proper noun. Never translated. */
  name: string;
  descriptionKey: string;
  cover: Media;
  privacy: GroupPrivacy;
  privacyKey: string;
  role: GroupRole;
  roleKey: string;
  memberCount: number;
  postCount: number;
  /** Posts in the last week — the "very active" line on a discover card. */
  weeklyPostCount: number;
  /** When the viewer joined, or `null` if they have not. */
  joinedAt: string | null;
  topicKey: string;
}

/* ------------------------------------------------------------------ events */

export interface CommunityEvent {
  id: string;
  slug: string;
  /** A proper noun. Never translated. */
  name: string;
  descriptionKey: string;
  cover: Media;
  /** Full instants. Rendered as dates and times, never relative. */
  startsAt: string;
  endsAt: string;
  /** Dictionary key for the venue, or `null` when the event is online. */
  placeKey: string | null;
  online: boolean;
  /** The person hosting it. */
  hostId: string;
  /** The group it belongs to, or `null` for one a person is holding. */
  groupId: string | null;
  rsvp: Rsvp;
  rsvpKey: string;
  goingCount: number;
  interestedCount: number;
  /** How many of the viewer's friends are going. The persuasive number. */
  friendsGoingCount: number;
}

/* ------------------------------------------------------------------ totals */

export interface CommunityTotals {
  /** The viewer's own figures, as shown on their profile. */
  friendCount: number;
  postCount: number;
  /** Waiting on the viewer to answer. The Friends destination's badge. */
  requestCount: number;
  /** Groups the viewer is in, and events they have answered yes to. */
  groupCount: number;
  goingCount: number;
  /** Across the whole fixture. */
  peopleCount: number;
  allGroupCount: number;
  allEventCount: number;
  /** Feed state. */
  feedCount: number;
  /** Events starting within seven days of the reporting instant. */
  upcomingEventCount: number;
  /** Friends whose birthday is today. The right rail's first block. */
  birthdayCount: number;
}

/* ----------------------------------------------------------------- fixture */

export interface CommunityFixture {
  reportingInstant: string;
  reportingDate: string;
  viewerId: string;
  totals: CommunityTotals;
  people: Person[];
  posts: Post[];
  comments: Comment[];
  groups: Group[];
  events: CommunityEvent[];
}
