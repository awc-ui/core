/**
 * Pure reads over the frozen fixture.
 *
 * Every screen in every build asks its questions here, so "the feed" means the
 * same list of posts in React and in the plain-HTML export, and a filter rule
 * corrected once is corrected everywhere. Nothing in this file computes a
 * derived figure — that is `derive.ts`. This is lookup, filter and sort.
 *
 * NOTHING HERE MUTATES. Every array returned is a fresh one, so a caller that
 * sorts what it gets back cannot reorder the fixture for the next caller. That
 * has bitten this repo before: `.sort()` is in-place, and a screen that sorted
 * the array it was handed changed what every later screen saw.
 */
import { ACTIVITY, COMMENTS, PEOPLE, POSTS, TOPICS, TOTALS } from './generated';
import type { Activity, Comment, Person, Post, SocialTotals, Topic } from './types';

/* ------------------------------------------------------------------ people */

export function getPeople(): Person[] {
  return [...PEOPLE] as Person[];
}

/** The account whose session this is. Never `undefined` — the fixture asserts it. */
export function getViewer(): Person {
  return (PEOPLE as Person[]).find((p) => p.relationship === 'self')!;
}

export function getPersonById(id: string): Person | undefined {
  return (PEOPLE as Person[]).find((p) => p.id === id);
}

/**
 * By handle, which is how the router addresses a person.
 *
 * Case-insensitive, because a handle in a URL is typed by people. The fixture's
 * handles are all lower-case, so this only ever widens what resolves.
 */
export function getPersonByHandle(handle: string): Person | undefined {
  const wanted = handle.toLowerCase();
  return (PEOPLE as Person[]).find((p) => p.handle.toLowerCase() === wanted);
}

/** Everyone but the viewer, in fixture order. */
export function getOthers(): Person[] {
  const viewer = getViewer();
  return (PEOPLE as Person[]).filter((p) => p.id !== viewer.id);
}

/* ------------------------------------------------------------------- posts */

export interface PostQuery {
  /** Only this person's posts. */
  authorId?: string;
  /** Only posts carrying this topic. */
  topic?: string;
  /** Only posts of this kind. */
  kind?: Post['kind'];
  /** Only posts the viewer has saved. */
  savedOnly?: boolean;
  /**
   * Match against the caption KEY, the author's display name and their handle.
   *
   * NOT against the caption's translated text, and the omission is deliberate:
   * a selector cannot see the dictionary, and a search that worked in English
   * and silently returned nothing in Arabic would be worse than one that
   * plainly matches names. The explore screen searches PEOPLE and TOPICS, which
   * is what its search field says it does.
   */
  search?: string;
  limit?: number;
}

export function getPosts(query: PostQuery = {}): Post[] {
  const { authorId, topic, kind, savedOnly, search, limit } = query;
  const needle = search?.trim().toLowerCase() ?? '';

  let rows = (POSTS as Post[]).filter((post) => {
    if (authorId && post.authorId !== authorId) return false;
    if (topic && !post.topics.includes(topic)) return false;
    if (kind && post.kind !== kind) return false;
    if (savedOnly && !post.saved) return false;
    if (needle) {
      const author = getPersonById(post.authorId);
      const haystack = `${author?.displayName ?? ''} ${author?.handle ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  if (limit !== undefined) rows = rows.slice(0, limit);
  return rows;
}

export function getPostById(id: string): Post | undefined {
  return (POSTS as Post[]).find((p) => p.id === id);
}

/**
 * The feed: posts by people the viewer follows, plus their own, newest first.
 *
 * `none` and `follower` are excluded — someone who follows you does not thereby
 * appear in your feed, and that asymmetry is the whole reason `Relationship`
 * has four values instead of a boolean.
 */
export function getFeed(limit?: number): Post[] {
  const following = new Set(
    (PEOPLE as Person[])
      .filter((p) => p.relationship === 'following' || p.relationship === 'mutual' || p.relationship === 'self')
      .map((p) => p.id),
  );
  const rows = (POSTS as Post[]).filter((p) => following.has(p.authorId));
  return limit === undefined ? rows : rows.slice(0, limit);
}

/**
 * A person's grid: pinned first, then newest.
 *
 * The pin is why this is not just `getPosts({ authorId })` with a sort. A grid
 * that ordered purely by date would bury the two posts its owner chose to put
 * at the top, which is the one thing a pin means.
 */
export function getPersonPosts(authorId: string): Post[] {
  const rows = getPosts({ authorId });
  const pinned = rows.filter((p) => p.pinned);
  const rest = rows.filter((p) => !p.pinned);
  return [...pinned, ...rest];
}

/* ---------------------------------------------------------------- comments */

/**
 * Every comment on a post, in a reading order rather than a flat date order.
 *
 * Each top-level comment is followed immediately by its replies, oldest first
 * within the thread. A flat newest-first list would scatter a reply away from
 * the thing it replies to, which is the one arrangement a comment section must
 * not have.
 */
export function getComments(postId: string): Comment[] {
  const all = (COMMENTS as Comment[]).filter((c) => c.postId === postId);
  const top = all.filter((c) => c.replyToId === null);
  const out: Comment[] = [];
  for (const parent of top) {
    out.push(parent);
    for (const reply of all.filter((c) => c.replyToId === parent.id)) out.push(reply);
  }
  return out;
}

export function getCommentById(id: string): Comment | undefined {
  return (COMMENTS as Comment[]).find((c) => c.id === id);
}

/* ---------------------------------------------------------------- activity */

export interface ActivityQuery {
  unreadOnly?: boolean;
  kind?: Activity['kind'];
  limit?: number;
}

export function getActivity(query: ActivityQuery = {}): Activity[] {
  const { unreadOnly, kind, limit } = query;
  let rows = (ACTIVITY as Activity[]).filter((row) => {
    if (unreadOnly && row.read) return false;
    if (kind && row.kind !== kind) return false;
    return true;
  });
  if (limit !== undefined) rows = rows.slice(0, limit);
  return rows;
}

/* ------------------------------------------------------------------ topics */

export function getTopics(): Topic[] {
  return [...TOPICS] as Topic[];
}

export function getTopicById(id: string): Topic | undefined {
  return (TOPICS as Topic[]).find((t) => t.id === id);
}

/* ------------------------------------------------------------------ totals */

export function getTotals(): SocialTotals {
  return TOTALS;
}
