/**
 * Reading the fixture. Every screen goes through here and none of them touches
 * `FIXTURE` directly.
 *
 * WHY THAT MATTERS MORE IN THIS REPOSITORY THAN IN AN APPLICATION. Five
 * framework builds render these screens, and `verify-showcase-parity` holds
 * them to an identical DOM. Any question answered in a component — "which posts
 * are in the feed", "who is a suggestion" — is a question five components have
 * to answer the same way, and they will not. Answered here it is answered once.
 *
 * Everything returns a NEW array and never mutates the fixture. A screen that
 * sorted a returned array in place would reorder it for every other screen.
 */

import { FIXTURE } from './generated';
import { REPORTING_INSTANT } from './types';
import type { Comment, CommunityEvent, Group, Person, Post } from './types';

const MS_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse(REPORTING_INSTANT);

/* ------------------------------------------------------------------ people */

export const getPeople = (): Person[] => [...FIXTURE.people];

export const getPersonById = (id: string): Person | undefined =>
  FIXTURE.people.find((p) => p.id === id);

export const getPersonByHandle = (handle: string): Person | undefined =>
  FIXTURE.people.find((p) => p.handle === handle);

export const getViewer = (): Person => {
  const viewer = FIXTURE.people.find((p) => p.id === FIXTURE.viewerId);
  /* The generator asserts this exists. Throwing rather than returning
     `undefined` keeps every caller free of a null check for a case that cannot
     happen unless the fixture is corrupt. */
  if (!viewer) throw new Error('community fixture has no viewer');
  return viewer;
};

/** Everyone but the viewer. */
export const getOthers = (): Person[] => FIXTURE.people.filter((p) => p.id !== FIXTURE.viewerId);

/** The viewer's friends, by display name — the order the friends list uses. */
export const getFriends = (): Person[] =>
  FIXTURE.people
    .filter((p) => p.friendship === 'friend')
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'en'));

/**
 * People who have asked the viewer, newest request first.
 *
 * NEWEST FIRST, unlike the friends list. A request queue is worked through in
 * arrival order and the freshest is the one the reader came for; sorting these
 * alphabetically would bury a request from an hour ago under one from March.
 */
export const getRequests = (): Person[] =>
  FIXTURE.people
    .filter((p) => p.friendship === 'incoming')
    .sort((a, b) => Date.parse(b.requestedAt ?? '') - Date.parse(a.requestedAt ?? ''));

/** People the viewer has asked and who have not answered. */
export const getOutgoing = (): Person[] =>
  FIXTURE.people
    .filter((p) => p.friendship === 'outgoing')
    .sort((a, b) => Date.parse(b.requestedAt ?? '') - Date.parse(a.requestedAt ?? ''));

/**
 * People to suggest, most mutuals first.
 *
 * MUTUALS ARE THE WHOLE RANKING, because they are the only signal this fixture
 * has that one stranger is a better suggestion than another — and they are the
 * signal a real product leads with too. Ordering by friend count would suggest
 * the most popular people rather than the most likely ones.
 */
export const getSuggestions = (limit = 6): Person[] =>
  FIXTURE.people
    .filter((p) => p.friendship === 'none')
    .sort((a, b) => b.mutualCount - a.mutualCount || a.displayName.localeCompare(b.displayName, 'en'))
    .slice(0, limit);

/**
 * Friends whose birthday is today.
 *
 * Compared as `--MM-DD` against the REPORTING DATE, never against the clock. A
 * birthday block computed from `new Date()` would be empty on all but two days
 * of the year and would make every screenshot of the right rail different.
 */
export const getBirthdays = (): Person[] => {
  const today = `--${FIXTURE.reportingDate.slice(5, 7)}-${FIXTURE.reportingDate.slice(8, 10)}`;
  return FIXTURE.people.filter((p) => p.friendship === 'friend' && p.birthday === today);
};

/* ------------------------------------------------------------------- posts */

export const getPosts = (): Post[] => [...FIXTURE.posts];

export const getPostById = (id: string): Post | undefined =>
  FIXTURE.posts.find((p) => p.id === id);

/**
 * The feed: posts by friends, by the viewer, and into groups the viewer is in.
 *
 * THE RULE IS THE GRAPH, and stating it here rather than in a screen is what
 * stops the five builds disagreeing. A post by a stranger never appears, even
 * if it is in a group the viewer belongs to — that is a real product decision
 * either way, and this one keeps the feed explicable: everything in it is by
 * somebody you know.
 */
export const getFeed = (): Post[] => {
  const known = new Set(
    FIXTURE.people
      .filter((p) => p.friendship === 'friend' || p.friendship === 'self')
      .map((p) => p.id),
  );
  return FIXTURE.posts.filter((p) => known.has(p.authorId));
};

/**
 * One person's own timeline, pinned first and then newest.
 *
 * A pinned post leads regardless of date, which is why this cannot be a plain
 * date sort — and why the screens must not re-sort what comes back.
 */
export const getPersonPosts = (personId: string): Post[] =>
  FIXTURE.posts
    .filter((p) => p.authorId === personId)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || Date.parse(b.postedAt) - Date.parse(a.postedAt),
    );

/** One group's own feed, newest first. */
export const getGroupPosts = (groupId: string): Post[] =>
  FIXTURE.posts
    .filter((p) => p.groupId === groupId)
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));

/* ---------------------------------------------------------------- comments */

export const getCommentById = (id: string): Comment | undefined =>
  FIXTURE.comments.find((c) => c.id === id);

/**
 * A post's comments in READING ORDER — each comment followed immediately by its
 * replies, and each of those by theirs.
 *
 * NOT DATE ORDER, and that is the one thing a comment section must not be. A
 * flat newest-first list scatters a reply away from the thing it answers, which
 * is unreadable at any depth and actively misleading at two.
 *
 * The walk is depth-first over `replyToId`. It is written here rather than in
 * the five screens because it is the kind of small recursion that five people
 * write five slightly different ways — and because the fixture guarantees the
 * tree is at most two deep, so this cannot run away.
 */
export const getComments = (postId: string): Comment[] => {
  const all = FIXTURE.comments.filter((c) => c.postId === postId);
  const byParent = new Map<string | null, Comment[]>();
  for (const comment of all) {
    const list = byParent.get(comment.replyToId) ?? [];
    list.push(comment);
    byParent.set(comment.replyToId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt));
  }

  const out: Comment[] = [];
  const walk = (parentId: string | null) => {
    for (const comment of byParent.get(parentId) ?? []) {
      out.push(comment);
      walk(comment.id);
    }
  };
  walk(null);
  return out;
};

/** Just the top-level ones, for a count that should not include replies. */
export const getTopLevelComments = (postId: string): Comment[] =>
  FIXTURE.comments
    .filter((c) => c.postId === postId && c.replyToId === null)
    .sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt));

/** The direct replies to one comment, oldest first. */
export const getReplies = (commentId: string): Comment[] =>
  FIXTURE.comments
    .filter((c) => c.replyToId === commentId)
    .sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt));

/* ------------------------------------------------------------------ groups */

export const getGroups = (): Group[] => [...FIXTURE.groups];

export const getGroupById = (id: string): Group | undefined =>
  FIXTURE.groups.find((g) => g.id === id);

export const getGroupBySlug = (slug: string): Group | undefined =>
  FIXTURE.groups.find((g) => g.slug === slug);

/** Groups the viewer is actually in — admin, moderator or member. */
export const getJoinedGroups = (): Group[] =>
  FIXTURE.groups
    .filter((g) => g.joinedAt !== null)
    .sort((a, b) => b.weeklyPostCount - a.weeklyPostCount || a.name.localeCompare(b.name, 'en'));

/**
 * Groups to discover — the ones the viewer is not in, busiest first.
 *
 * `pending` counts as discoverable: the viewer has asked but is not in, so the
 * group still belongs in the section that offers to join it — showing its
 * waiting state there is more honest than hiding it in the joined list where
 * its posts would not appear.
 */
export const getDiscoverGroups = (): Group[] =>
  FIXTURE.groups
    .filter((g) => g.joinedAt === null)
    .sort((a, b) => b.memberCount - a.memberCount);

/* ------------------------------------------------------------------ events */

export const getEvents = (): CommunityEvent[] => [...FIXTURE.events];

export const getEventById = (id: string): CommunityEvent | undefined =>
  FIXTURE.events.find((e) => e.id === id);

export const getEventBySlug = (slug: string): CommunityEvent | undefined =>
  FIXTURE.events.find((e) => e.slug === slug);

/** Everything still to come, soonest first. */
export const getUpcomingEvents = (): CommunityEvent[] =>
  FIXTURE.events
    .filter((e) => Date.parse(e.startsAt) >= NOW)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

/** And everything behind us, most recent first. */
export const getPastEvents = (): CommunityEvent[] =>
  FIXTURE.events
    .filter((e) => Date.parse(e.startsAt) < NOW)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));

/** Events starting within seven days — the right rail's block. */
export const getEventsThisWeek = (): CommunityEvent[] =>
  getUpcomingEvents().filter((e) => Date.parse(e.startsAt) - NOW < 7 * MS_DAY);

/** Events belonging to one group, soonest first. */
export const getGroupEvents = (groupId: string): CommunityEvent[] =>
  FIXTURE.events
    .filter((e) => e.groupId === groupId)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

/* ------------------------------------------------------------------ totals */

export const getTotals = () => FIXTURE.totals;
