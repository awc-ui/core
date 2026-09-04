/**
 * Everything computed from the fixture: the groupings, the roll-ups and the
 * shapes the screens actually render.
 *
 * The rule the whole showcase runs on — NO ARITHMETIC IN A COMPONENT. If a
 * screen needs a number that is not already in the fixture, it belongs here, so
 * the five framework builds cannot each derive it slightly differently.
 *
 * Everything is pure and deterministic. Where a function needs "now" it takes
 * `REPORTING_INSTANT`, never the clock.
 */
import { REPORTING_INSTANT } from './types';
import {
  getActivity,
  getComments,
  getFeed,
  getOthers,
  getPeople,
  getPersonById,
  getPersonPosts,
  getPosts,
  getTopics,
  getViewer,
} from './selectors';
import type { Activity, Comment, Person, Post, Topic } from './types';

const REPORTING_MS = Date.parse(REPORTING_INSTANT);

/** Milliseconds between an instant and the reporting instant. Never negative. */
function agoMs(at: string): number {
  return Math.max(0, REPORTING_MS - Date.parse(at));
}

/* ------------------------------------------------------------- the stories */

export interface StoryRing {
  person: Person;
  unseen: boolean;
  /** `true` for the viewer's own ring, which leads the row and adds rather than opens. */
  self: boolean;
}

/**
 * The story rail above the feed.
 *
 * UNSEEN FIRST, then seen, and the viewer's own always leading. That order is
 * the entire information design of a story rail: the row scrolls horizontally
 * and only three or four fit, so anything not sorted to the front is
 * effectively hidden. Sorting by recency instead — which is the obvious thing —
 * buries an unseen story behind three you have already watched.
 */
export function storyRail(): StoryRing[] {
  const viewer = getViewer();
  const rest = getOthers()
    .filter((p) => p.hasStory)
    .sort((a, b) => {
      if (a.storyUnseen !== b.storyUnseen) return a.storyUnseen ? -1 : 1;
      return agoMs(a.lastPostAt ?? REPORTING_INSTANT) - agoMs(b.lastPostAt ?? REPORTING_INSTANT);
    });

  return [
    { person: viewer, unseen: false, self: true },
    ...rest.map((person) => ({ person, unseen: person.storyUnseen, self: false })),
  ];
}

/* ---------------------------------------------------------------- the feed */

export interface FeedItem {
  post: Post;
  author: Person;
  /** The two comments shown inline under a post, oldest first. */
  preview: Comment[];
  /** How many more there are behind "view all N comments". */
  hiddenComments: number;
}

/**
 * The feed, with each post's author and comment preview resolved.
 *
 * THE PREVIEW IS TWO COMMENTS AND IT IS THE OLDEST TWO, not the newest. A feed
 * that showed the two most recent replies would show the tail of an argument
 * with no beginning; showing the first two shows how the conversation opened,
 * which is what someone deciding whether to expand it needs.
 */
export function feedItems(limit?: number): FeedItem[] {
  return getFeed(limit).map((post) => {
    const all = getComments(post.id);
    return {
      post,
      author: getPersonById(post.authorId)!,
      preview: all.slice(0, 2),
      hiddenComments: Math.max(0, all.length - 2),
    };
  });
}

/* ------------------------------------------------------------- the explore */

export interface ExploreTile {
  post: Post;
  author: Person;
  /**
   * How many grid cells wide and tall this tile is.
   *
   * ONE IN SEVEN IS A TWO-BY-TWO, which is the trick that stops a uniform grid
   * reading as a contact sheet. It is chosen from the post's INDEX rather than
   * at random so every build lays out identically — and the interval is 7
   * rather than 6 or 8 because those divide the common column counts (2, 3, 4,
   * 6) and would stack every large tile into the same column.
   */
  span: 1 | 2;
}

export function exploreTiles(topic?: string, search?: string): ExploreTile[] {
  const rows = getPosts({ topic, search });
  return rows.map((post, index) => ({
    post,
    author: getPersonById(post.authorId)!,
    span: index % 7 === 3 ? 2 : 1,
  }));
}

/**
 * The topic facets, with the currently-empty ones dropped.
 *
 * A facet that returns nothing is a control that looks live and does nothing —
 * the fixture asserts every topic has posts, so this only ever prunes when a
 * search is also active.
 */
export function topicFacets(search?: string): Topic[] {
  if (!search) return getTopics();
  return getTopics().filter((topic) => getPosts({ topic: topic.id, search }).length > 0);
}

/* ------------------------------------------------------------ the activity */

export type ActivityBucket = 'today' | 'week' | 'month' | 'earlier';

export interface ActivityGroup {
  bucket: ActivityBucket;
  labelKey: string;
  rows: ActivityRow[];
}

export interface ActivityRow {
  activity: Activity;
  actor: Person;
  post: Post | null;
  comment: Comment | null;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Activity grouped into four age buckets, newest bucket first.
 *
 * FOUR BUCKETS, AND EMPTY ONES ARE DROPPED. A notification list is read by
 * recency and nothing else, so the only structure worth imposing is "how long
 * ago" — and a heading over nothing is a heading that makes the reader look for
 * something that is not there.
 */
export function activityGroups(): ActivityGroup[] {
  const buckets: { bucket: ActivityBucket; labelKey: string; within: number }[] = [
    { bucket: 'today', labelKey: 'social.when.today', within: DAY },
    { bucket: 'week', labelKey: 'social.when.thisWeek', within: 7 * DAY },
    { bucket: 'month', labelKey: 'social.when.thisMonth', within: 30 * DAY },
    { bucket: 'earlier', labelKey: 'social.when.earlier', within: Infinity },
  ];

  const rows: ActivityRow[] = getActivity().map((activity) => ({
    activity,
    actor: getPersonById(activity.actorId)!,
    post: activity.postId ? (getPosts().find((p) => p.id === activity.postId) ?? null) : null,
    comment: activity.commentId
      ? (getComments(activity.postId ?? '').find((c) => c.id === activity.commentId) ?? null)
      : null,
  }));

  const out: ActivityGroup[] = [];
  let remaining = rows;
  for (const spec of buckets) {
    const mine = remaining.filter((row) => agoMs(row.activity.at) < spec.within);
    remaining = remaining.filter((row) => agoMs(row.activity.at) >= spec.within);
    if (mine.length) out.push({ bucket: spec.bucket, labelKey: spec.labelKey, rows: mine });
  }
  return out;
}

/* ------------------------------------------------------------- the profile */

export interface ProfileSummary {
  person: Person;
  posts: Post[];
  /** Total likes across their posts, for the header. */
  likes: number;
  /** Total comments across their posts. */
  comments: number;
  /**
   * Mean likes per post, which is the one figure here that is genuinely
   * derived rather than counted. `0` for someone who has posted nothing —
   * NOT `NaN`, which is what dividing by zero would put on screen.
   */
  averageLikes: number;
  /** The topics they post about most, at most three, commonest first. */
  topTopics: Topic[];
}

export function profileSummary(personId: string): ProfileSummary {
  const person = getPersonById(personId)!;
  const posts = getPersonPosts(personId);
  const likes = posts.reduce((total, post) => total + post.likeCount, 0);
  const comments = posts.reduce((total, post) => total + post.commentCount, 0);

  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const topic of post.topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  const topTopics = getTopics()
    .filter((topic) => counts.has(topic.id))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.id.localeCompare(b.id, 'en'))
    .slice(0, 3);

  return {
    person,
    posts,
    likes,
    comments,
    averageLikes: posts.length === 0 ? 0 : Math.round(likes / posts.length),
    topTopics,
  };
}

/* ------------------------------------------------------------ suggestions */

/**
 * People to follow, best first.
 *
 * Scored rather than picked: someone who already follows the viewer ranks above
 * a stranger, and reach breaks the tie. Both halves matter — reach alone
 * suggests the same four celebrities to everyone, and relationship alone has
 * nothing to say once the followers run out.
 *
 * `log` on the follower count so a 40,000-follower account does not swamp the
 * relationship term entirely, which is the whole reason the two are added
 * rather than one being a filter on the other.
 */
export function suggestedPeople(limit = 5): Person[] {
  return getOthers()
    .filter((p) => p.relationship === 'none' || p.relationship === 'follower')
    .map((person) => ({
      person,
      score: (person.relationship === 'follower' ? 6 : 0) + Math.log10(Math.max(10, person.followerCount)),
    }))
    .sort((a, b) => b.score - a.score || a.person.handle.localeCompare(b.person.handle, 'en'))
    .slice(0, limit)
    .map((row) => row.person);
}

/* ----------------------------------------------------------- the composer */

/**
 * What the composer can post to, in the order the picker offers them.
 *
 * Not a fixture value — it is the same four for everyone — but it lives here so
 * the five builds render the same picker rather than each hard-coding a list.
 */
export const AUDIENCES = [
  { value: 'public', labelKey: 'social.audience.public', hintKey: 'social.audience.publicHint' },
  { value: 'followers', labelKey: 'social.audience.followers', hintKey: 'social.audience.followersHint' },
  { value: 'close', labelKey: 'social.audience.close', hintKey: 'social.audience.closeHint' },
  { value: 'private', labelKey: 'social.audience.private', hintKey: 'social.audience.privateHint' },
] as const;

/**
 * The artwork the composer offers instead of a file picker.
 *
 * There is no upload in a static showcase and pretending otherwise would be the
 * one dishonest screen in the app — a file input that accepts a photograph and
 * then shows something else. So the composer PICKS from the fixture's own
 * artwork, and says so. Twelve tiles, drawn from posts the viewer does not
 * already own so the grid is not their own feed back at them.
 */
export function composerLibrary(count = 12) {
  const viewer = getViewer();
  return getPosts()
    .filter((post) => post.authorId !== viewer.id)
    .map((post) => post.media[0])
    .slice(0, count);
}

/* ----------------------------------------------------------------- counts */

/**
 * The engagement figures for one post, as the action row shows them.
 *
 * `liked` is passed in rather than read off the post, because by the time a
 * screen renders this the reader may have tapped the heart — the fixture's own
 * value is the STARTING state and the screen holds the override. Returning the
 * adjusted count here is what stops five builds each writing
 * `post.likeCount + (liked && !post.liked ? 1 : 0)` slightly differently.
 */
export function engagement(post: Post, liked: boolean, saved: boolean) {
  const delta = liked === post.liked ? 0 : liked ? 1 : -1;
  return {
    likeCount: Math.max(0, post.likeCount + delta),
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    saveCount: Math.max(0, post.saveCount + (saved === post.saved ? 0 : saved ? 1 : -1)),
    liked,
    saved,
  };
}

/* ------------------------------------------------------------------ people */

/** Everyone, with the viewer first — the order the composer's tag picker wants. */
export function taggablePeople(): Person[] {
  const viewer = getViewer();
  return [viewer, ...getPeople().filter((p) => p.id !== viewer.id)];
}
