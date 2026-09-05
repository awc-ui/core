/**
 * Screen-shaped values: the arithmetic and the joins each screen needs, worked
 * out once so five framework builds cannot each get them slightly different.
 *
 * The line between this and `selectors.ts` is that a selector answers "which
 * records", and this answers "what does the screen show" — a post plus its
 * author plus the group it went into plus the post it shares, or six reaction
 * counts turned into the three glyphs and the sentence beside them.
 *
 * NOTHING HERE IS TRANSLATED and nothing here picks a colour. Both come from
 * the caller's translator and from `status.ts` respectively.
 */

import {
  getComments,
  getEventById,
  getGroupById,
  getGroupEvents,
  getGroupPosts,
  getPersonById,
  getPersonPosts,
  getPostById,
  getTopLevelComments,
  getViewer,
  getBirthdays,
  getEventsThisWeek,
  getFeed,
  getFriends,
} from './selectors';
import { REACTIONS } from './status';
import { COMMENT_PAGE, REPORTING_INSTANT } from './types';
import type {
  Comment,
  CommunityEvent,
  Group,
  Person,
  Post,
  ReactionCounts,
  ReactionKind,
} from './types';

const NOW = Date.parse(REPORTING_INSTANT);
const MS_DAY = 24 * 60 * 60 * 1000;

/* --------------------------------------------------------------- reactions */

/** Every reaction on a post, added up. Absent keys are zero. */
export function reactionTotal(counts: ReactionCounts): number {
  return REACTIONS.reduce((total, kind) => total + (counts[kind] ?? 0), 0);
}

export interface ReactionSummary {
  /** Every count, including the viewer's own override, in picker order. */
  counts: ReactionCounts;
  total: number;
  /**
   * The three kinds to draw as overlapping glyphs, most-used first.
   *
   * THREE, and only the ones that actually have a count. A row of six glyphs
   * where three are at zero says "these exist" rather than "these happened",
   * which is the opposite of what an aggregate is for.
   */
  top: ReactionKind[];
  /** What the viewer picked, after any override. */
  mine: ReactionKind | null;
}

/**
 * A post's reactions AS THE READER WILL SEE THEM, given what they have pressed.
 *
 * THE OVERRIDE ARITHMETIC LIVES HERE, and this is the single most-copied
 * calculation in an app of this shape: the fixture ships a count and a
 * viewer-reaction, the reader presses something else, and the displayed count
 * has to drop one from the old kind and add one to the new. Five builds writing
 * `counts[kind] + (mine === kind ? 1 : 0)` by hand is five chances to get the
 * SWITCH case wrong — the one where a reader moves from `like` to `love` and
 * both counts have to move.
 *
 * @param shipped  the post's own counts, untouched
 * @param original what the fixture said the viewer had picked
 * @param mine     what they have picked since, or `null` for none
 */
export function reactionSummary(
  shipped: ReactionCounts,
  original: ReactionKind | null,
  mine: ReactionKind | null,
): ReactionSummary {
  const counts: ReactionCounts = {};
  for (const kind of REACTIONS) {
    let n = shipped[kind] ?? 0;
    if (original === kind) n -= 1;
    if (mine === kind) n += 1;
    if (n > 0) counts[kind] = n;
  }

  const top = REACTIONS.filter((k) => (counts[k] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || REACTIONS.indexOf(a) - REACTIONS.indexOf(b))
    .slice(0, 3);

  return { counts, total: reactionTotal(counts), top, mine };
}

/* -------------------------------------------------------------- the feed */

export interface FeedItem {
  post: Post;
  author: Person;
  /** The group it went into, or `null` for a timeline post. */
  group: Group | null;
  /** For a `share`: the post being shared and who wrote it. */
  shared: { post: Post; author: Person; group: Group | null } | null;
  /** The first few top-level comments, for the card's preview. */
  preview: Comment[];
  /** How many comments the card is NOT showing. */
  hiddenComments: number;
}

/**
 * The feed, resolved.
 *
 * EVERY JOIN A CARD NEEDS, DONE HERE. The card renders an author, possibly a
 * group byline, possibly a whole second post with its own author and group, and
 * two or three comments. Left to the component that is five lookups per card
 * per build, and the shared-post branch is exactly where one of the five
 * forgets that the inner post has a group too.
 */
export function feedItems(): FeedItem[] {
  return getFeed().map((post) => resolve(post));
}

/** One post, resolved the same way a feed item is. Used by the drills. */
export function resolve(post: Post): FeedItem {
  const author = getPersonById(post.authorId);
  if (!author) throw new Error(`post ${post.id} has no author`);

  const shared = (() => {
    if (post.sharedPostId === null) return null;
    const inner = getPostById(post.sharedPostId);
    if (!inner) return null;
    const innerAuthor = getPersonById(inner.authorId);
    if (!innerAuthor) return null;
    return {
      post: inner,
      author: innerAuthor,
      group: inner.groupId ? (getGroupById(inner.groupId) ?? null) : null,
    };
  })();

  const top = getTopLevelComments(post.id);
  return {
    post,
    author,
    group: post.groupId ? (getGroupById(post.groupId) ?? null) : null,
    shared,
    /* The LAST few, not the first: a card shows the freshest end of a
       conversation, and opening the post is how you read it from the top. */
    preview: top.slice(Math.max(0, top.length - COMMENT_PAGE)),
    hiddenComments: Math.max(0, post.commentCount - Math.min(top.length, COMMENT_PAGE)),
  };
}

/* ------------------------------------------------------------ the thread */

export interface ThreadNode {
  comment: Comment;
  author: Person;
  /** Who they are answering, for the "replying to" line. `null` at depth 0. */
  replyingTo: Person | null;
  /** Direct replies, already resolved. */
  children: ThreadNode[];
}

/**
 * A post's comments as a real tree.
 *
 * THE SCREENS GET A TREE, NOT A FLAT LIST WITH A DEPTH FIELD. Lyra's thread is
 * one level deep so a flat list with an `indent` flag was enough; at two levels
 * a flat list forces every screen to work out where a run of replies ends,
 * which is where a collapse control has to go. A tree puts that boundary in the
 * data.
 */
export function commentTree(postId: string): ThreadNode[] {
  const flat = getComments(postId);
  const nodes = new Map<string, ThreadNode>();
  const roots: ThreadNode[] = [];

  for (const comment of flat) {
    const author = getPersonById(comment.authorId);
    if (!author) continue;
    const parent = comment.replyToId ? nodes.get(comment.replyToId) : undefined;
    const node: ThreadNode = {
      comment,
      author,
      replyingTo: parent ? parent.author : null,
      children: [],
    };
    nodes.set(comment.id, node);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Every comment under a node, however deep. For "N more replies". */
export function subtreeSize(node: ThreadNode): number {
  return node.children.reduce((total, child) => total + 1 + subtreeSize(child), 0);
}

/* ----------------------------------------------------------- the friends */

export interface FriendSections {
  requests: Person[];
  outgoing: Person[];
  suggestions: Person[];
  friends: Person[];
}

/* --------------------------------------------------------- group sections */

export interface GroupSections {
  joined: Group[];
  discover: Group[];
}

/* ------------------------------------------------------------ event buckets */

export type EventBucket = 'today' | 'thisWeek' | 'thisMonth' | 'later' | 'past';

export interface EventGroup {
  bucket: EventBucket;
  labelKey: string;
  events: CommunityEvent[];
}

const BUCKET_ORDER: readonly EventBucket[] = ['today', 'thisWeek', 'thisMonth', 'later', 'past'];

/**
 * Which bucket an event falls in, measured from the reporting instant.
 *
 * FIVE BUCKETS AND `past` IS LAST, not first. A list read top to bottom should
 * begin with what is about to happen; putting last month's events above this
 * evening's would be sorting by date rather than by usefulness.
 */
export function eventBucket(event: CommunityEvent): EventBucket {
  const delta = Date.parse(event.startsAt) - NOW;
  if (delta < 0) return 'past';
  if (delta < MS_DAY) return 'today';
  if (delta < 7 * MS_DAY) return 'thisWeek';
  if (delta < 31 * MS_DAY) return 'thisMonth';
  return 'later';
}

/**
 * Events grouped by age, EMPTY BUCKETS DROPPED.
 *
 * A heading over nothing is worse than no heading: it tells the reader there is
 * a category and then shows them it is empty, which is a fact they did not ask
 * for. The same rule Lyra's activity screen follows.
 */
export function eventGroups(events: CommunityEvent[]): EventGroup[] {
  return BUCKET_ORDER.map((bucket) => ({
    bucket,
    labelKey: `community.when.${bucket}`,
    events: events
      .filter((e) => eventBucket(e) === bucket)
      .sort((a, b) =>
        bucket === 'past'
          ? Date.parse(b.startsAt) - Date.parse(a.startsAt)
          : Date.parse(a.startsAt) - Date.parse(b.startsAt),
      ),
  })).filter((group) => group.events.length > 0);
}

/* ---------------------------------------------------------- profile header */

export interface ProfileSummary {
  person: Person;
  posts: Post[];
  /** Every reaction their posts have received. */
  reactionsReceived: number;
  /** Groups they are in that the viewer is also in. */
  sharedGroups: Group[];
  /** Photos lifted out of their posts, for the profile's photo strip. */
  photos: { postId: string; media: Post['media'][number] }[];
}

export function profileSummary(personId: string): ProfileSummary {
  const person = getPersonById(personId);
  if (!person) throw new Error(`no person ${personId}`);
  const posts = getPersonPosts(personId);

  /*
   * SHARED GROUPS ARE ONLY SHOWN FOR SOMEBODY ELSE, and are computed from the
   * posts rather than from a membership table the fixture does not have: a
   * group both of you have posted in is a group you are both in, which is the
   * strongest claim the data actually supports. Inventing a per-person
   * membership list to make this row richer would be data added to serve a
   * layout.
   */
  const mine = new Set(
    getPersonPosts(getViewer().id)
      .map((p) => p.groupId)
      .filter((id): id is string => id !== null),
  );
  const sharedGroups = [
    ...new Set(posts.map((p) => p.groupId).filter((id): id is string => id !== null && mine.has(id))),
  ]
    .map((id) => getGroupById(id))
    .filter((g): g is Group => g !== undefined);

  return {
    person,
    posts,
    reactionsReceived: posts.reduce((total, p) => total + reactionTotal(p.reactions), 0),
    sharedGroups,
    photos: posts.flatMap((p) => p.media.map((media) => ({ postId: p.id, media }))).slice(0, 9),
  };
}

/* ------------------------------------------------------------- group page */

export interface GroupSummary {
  group: Group;
  posts: Post[];
  events: CommunityEvent[];
  /** Distinct people who have posted in it — the "active members" strip. */
  contributors: Person[];
}

export function groupSummary(groupId: string): GroupSummary {
  const group = getGroupById(groupId);
  if (!group) throw new Error(`no group ${groupId}`);
  const posts = getGroupPosts(groupId);
  const contributors = [...new Set(posts.map((p) => p.authorId))]
    .map((id) => getPersonById(id))
    .filter((p): p is Person => p !== undefined);
  return {
    group,
    posts,
    events: getGroupEvents(groupId),
    contributors,
  };
}

/* -------------------------------------------------------------- event page */

export interface EventSummary {
  event: CommunityEvent;
  host: Person;
  group: Group | null;
  /** Friends of the viewer who are going. The persuasive row. */
  friendsGoing: Person[];
}

export function eventSummary(eventId: string): EventSummary {
  const event = getEventById(eventId);
  if (!event) throw new Error(`no event ${eventId}`);
  const host = getPersonById(event.hostId);
  if (!host) throw new Error(`event ${eventId} has no host`);
  /*
   * WHICH friends are going is not in the fixture — only HOW MANY. Rather than
   * invent an attendee list, the first N friends by name stand in for it, which
   * is deterministic and agrees with the count. The alternative was a
   * per-event attendee array whose only consumer is a row of four avatars.
   */
  return {
    event,
    host,
    group: event.groupId ? (getGroupById(event.groupId) ?? null) : null,
    friendsGoing: getFriends().slice(0, event.friendsGoingCount),
  };
}

/* --------------------------------------------------------- the right rail */

export interface RightRail {
  birthdays: Person[];
  events: CommunityEvent[];
  /** Friends to show as "contacts". Not a presence list — nobody is online. */
  contacts: Person[];
}

/**
 * The three blocks beside the feed on a wide screen.
 *
 * THERE IS NO PRESENCE AND NO "ACTIVE NOW" DOT. Every other app of this shape
 * has one, and it would be the single dishonest thing in this showcase: nobody
 * is online, there is no socket, and a green dot that is always on says
 * something false about a person. The block is a contact list and is labelled
 * as one.
 */
export function rightRail(contactLimit = 8): RightRail {
  return {
    birthdays: getBirthdays(),
    events: getEventsThisWeek().slice(0, 3),
    contacts: getFriends().slice(0, contactLimit),
  };
}
