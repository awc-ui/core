/**
 * Domain model for the "Lyra — Photos & People" showcase vertical.
 *
 * A photo-sharing app: a feed of posts from people you follow, an explore grid,
 * a composer, an activity list and a profile. Where the three verticals next
 * door model money — an institution looking at its clients, an advisor looking
 * at a book, a person looking at their own accounts — this one models a person
 * looking at other people. Almost nothing here is a number a reader checks;
 * almost everything is a picture, a name and a time.
 *
 * Everything is a plain, serialisable value. There is no runtime clock and no
 * randomness: the fixture is generated once at authoring time from a seeded
 * PRNG (`scripts/generate-social-fixture.mjs`) and baked into `generated.ts`,
 * so every framework build renders byte-identical output.
 *
 * THE SAME THREE CONVENTIONS the other three fixtures use:
 *
 *   1. Every ratio is a FRACTION. `0.0135` means 1.35%. Pass them straight to
 *      `t.formatPercent()`, which multiplies by 100 itself.
 *   2. Every enum-ish value carries a `…Key` twin (`kind` / `kindKey`) that
 *      resolves through the shared dictionary. Render the key, never the raw
 *      value — the raw value is for logic and for `status.ts`.
 *   3. Proper nouns live here untranslated; prose lives in the dictionary. A
 *      person's display name is fixture data. Their bio, every caption and
 *      every comment is a `…Key`, because those are sentences and this app
 *      ships in three languages.
 *
 * TWO CONVENTIONS THIS VERTICAL ADDS, and the screens depend on both:
 *
 *   4. TIME IS AN INSTANT, NOT A DATE. The other three verticals measure in
 *      calendar days because a statement line and a valuation belong to a day.
 *      A feed does not: two posts an hour apart are ordered, and the reader is
 *      told "3h ago". So every timestamp here is a full UTC instant, and it is
 *      rendered against `REPORTING_INSTANT` through
 *      `t.formatRelativeTime(at, REPORTING_INSTANT)` — never against the clock,
 *      or the screenshots would age.
 *
 *   5. EVERY IMAGE IS SELF-DESCRIBING. Every `Media` carries an `altKey`, and
 *      no screen may render an `<img>` without resolving it. This is not the
 *      usual "decorative images get empty alt" rule reversed for its own sake:
 *      in a photo app the image IS the post, so an unlabelled one is a post
 *      with no content. The alt text describes the generated artwork, which is
 *      what is actually on screen.
 *
 * WHERE THE PICTURES COME FROM. There are no photographs in this repository and
 * there is no CDN. Every `Media.src` is a `data:image/svg+xml` URI holding a
 * few hundred bytes of deterministic generated artwork — a seeded gradient and
 * two or three shapes, in a palette derived from the post's own id. Three
 * reasons, in order of how much they constrain the choice:
 *
 *   - The deployed policy is `img-src 'self' data:` (see
 *     `scripts/verify-showcase-csp.mjs`). A remote image is refused outright,
 *     so a photo service was never available.
 *   - `verify-showcase-parity.mjs` compares the five builds pixel-adjacent —
 *     document height, the gaps between blocks. Anything that could load at a
 *     different size, or fail to load in one build's network conditions, would
 *     make that comparison meaningless.
 *   - Real photographs are 10–20 MB of binaries in a repository that everyone
 *     clones, plus a licence audit on every file, in exchange for looking nicer
 *     in a screenshot.
 *
 * The aspect ratios are real, though, and that is the part that matters: the
 * layout problems a photo app has — a feed that must not reflow as images
 * arrive, a grid of mixed ratios that must stay a grid — are properties of the
 * ratio, not of the photograph.
 */

/* --------------------------------------------------------------- constants */

/**
 * The frozen instant everything is measured from.
 *
 * An INSTANT, not a date, and that is convention 4 above in one constant. It is
 * mid-evening UTC on purpose: a feed whose newest post is "0 seconds ago" reads
 * as broken, and one whose newest post is "2 days ago" reads as abandoned. With
 * this reference the freshest post is minutes old and the oldest is last year.
 */
export const REPORTING_INSTANT = '2026-09-30T18:20:00Z';

/** The calendar day `REPORTING_INSTANT` falls on, for the few date-only fields. */
export const REPORTING_DATE = '2026-09-30';

/** The handle of the person whose session this is. */
export const VIEWER_HANDLE = 'mara.ilves';

/** How many posts the feed shows before its "you're all caught up" marker. */
export const FEED_PAGE = 12;

/** Media aspect ratios, as CSS `aspect-ratio` values. Keyed by `Aspect`. */
export const ASPECT_RATIO: Record<Aspect, string> = {
  square: '1 / 1',
  portrait: '4 / 5',
  landscape: '16 / 9',
};

/* ------------------------------------------------------------------ unions */

/**
 * The three ratios a post may use.
 *
 * Instagram's own three, and they are here because they are the layout
 * problem. A feed column has to reserve the right height BEFORE the image
 * decodes or every post below it jumps when it arrives; a grid has to crop
 * three different ratios into one square without letting the crop eat the
 * subject. Both are solved with CSS from `aspect`, never by measuring.
 */
export type Aspect = 'square' | 'portrait' | 'landscape';

/**
 * What a post is.
 *
 * `video` is a still frame plus a duration, not a playing video: this is a
 * component showcase and there is no video file. It exists because the badge,
 * the duration and the muted-autoplay affordance are real layout, and because a
 * grid of mixed kinds is the case that gets forgotten.
 */
export type PostKind = 'photo' | 'carousel' | 'video';

/** What happened, on the activity screen. */
export type ActivityKind = 'like' | 'comment' | 'follow' | 'mention' | 'tag';

/**
 * Who someone is to the viewer.
 *
 * Not a follower count bucket — a relationship. It drives the follow button's
 * wording, which is the one control on this app that has four states and is
 * routinely built with two.
 */
export type Relationship = 'self' | 'following' | 'follower' | 'mutual' | 'none';

/** The composer's audience picker. */
export type Audience = 'public' | 'followers' | 'close' | 'private';

/** A person's account type. Drives one badge and the profile's extra row. */
export type AccountKind = 'personal' | 'creator' | 'business';

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
  /** Dictionary key — a bio is a sentence. */
  bioKey: string;
  kind: AccountKind;
  kindKey: string;
  verified: boolean;
  relationship: Relationship;
  relationshipKey: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  /** `null` when they have posted nothing this year. */
  lastPostAt: string | null;
  /** An unseen story puts a ring on the avatar. */
  hasStory: boolean;
  storyUnseen: boolean;
  /** Dictionary key, or `null` when they say where they are nowhere. */
  locationKey: string | null;
}

/* ------------------------------------------------------------------- media */

export interface Media {
  id: string;
  aspect: Aspect;
  /** `data:image/svg+xml,…` — see the note at the top of this file. */
  src: string;
  /** Dictionary key describing the artwork. Convention 5: never omit it. */
  altKey: string;
  /** Seconds, on a `video` post's first item. `null` everywhere else. */
  durationSec: number | null;
}

/* ------------------------------------------------------------------- posts */

export interface Post {
  id: string;
  authorId: string;
  kind: PostKind;
  kindKey: string;
  /** One item for `photo` and `video`; two to five for `carousel`. */
  media: Media[];
  /** Dictionary key — a caption is prose. */
  captionKey: string;
  /** Full UTC instant. Convention 4. */
  postedAt: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  /**
   * The viewer's own state AS THE FIXTURE SHIPS IT.
   *
   * A screen that lets someone like a post holds an override on top of this and
   * never edits the fixture — the same arrangement the banking cards screen
   * uses for freeze, and for the same reason: a reload is a reset, and the
   * showcase stays reproducible.
   */
  liked: boolean;
  saved: boolean;
  /** Dictionary key, or `null` for a post with no place attached. */
  locationKey: string | null;
  /** Topic ids, for the explore facets. Never empty. */
  topics: string[];
  /** Pinned posts lead the profile grid regardless of date. */
  pinned: boolean;
  /** Comments are closed on a few posts — the case a composer must handle. */
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
  likeCount: number;
  liked: boolean;
  /** The comment this replies to, or `null` for a top-level one. */
  replyToId: string | null;
}

/* ---------------------------------------------------------------- activity */

export interface Activity {
  id: string;
  kind: ActivityKind;
  kindKey: string;
  actorId: string;
  /** The post it happened to, or `null` for a follow. */
  postId: string | null;
  /** The comment it happened to, for `comment` and `mention`. */
  commentId: string | null;
  at: string;
  read: boolean;
}

/* ------------------------------------------------------------------ topics */

export interface Topic {
  id: string;
  labelKey: string;
  /** Material Symbols ligature. */
  icon: string;
  postCount: number;
}

/* ------------------------------------------------------------------ totals */

export interface SocialTotals {
  /** The viewer's own figures, as shown on their profile. */
  postCount: number;
  followerCount: number;
  followingCount: number;
  /** Across the whole fixture, for the explore screen's header. */
  peopleCount: number;
  topicCount: number;
  /** Activity. `unread` is the app bar's badge. */
  activityCount: number;
  unreadActivityCount: number;
  /** Engagement on the viewer's own posts, for the profile header. */
  likesReceived: number;
  commentsReceived: number;
  /** Feed state. */
  feedCount: number;
  savedCount: number;
  /** How many of the people the viewer follows have an unseen story. */
  storyCount: number;
}

/* ----------------------------------------------------------------- fixture */

export interface SocialFixture {
  reportingInstant: string;
  reportingDate: string;
  viewerId: string;
  totals: SocialTotals;
  people: Person[];
  posts: Post[];
  comments: Comment[];
  activity: Activity[];
  topics: Topic[];
}
