/**
 * Deterministic fixture generator for the photo-sharing showcase.
 *
 * Run: pnpm --filter @awc-ui/showcase-kit generate:social
 *
 * Output: src/social/generated.ts — a baked, literal fixture. Same contract as
 * the three generators next door: a seeded mulberry32 PRNG and a frozen
 * reporting instant, so re-running it produces a byte-identical file. Nothing
 * at runtime ever calls Math.random or Date.now, and every timestamp is built
 * from a fixed epoch — the ambient time zone of the machine that runs this
 * never reaches the output.
 *
 * WHAT MAKES THIS ONE DIFFERENT: it draws the pictures.
 *
 * The other three fixtures are numbers. This one has to produce sixty-odd
 * images with no photographs and no network, so a third of this file is a tiny
 * deterministic SVG art generator: ten shape families, each seeded from its
 * own media id, each emitted as a `data:image/svg+xml` URI of a few hundred
 * bytes. The alt text names the family, so what a screen reader is told and
 * what is on screen are the same thing rather than two guesses.
 *
 * NO PROSE IS WRITTEN HERE. Captions, comments, bios, locations and alt text
 * are dictionary KEYS — `social.caption.07`, `social.bio.03` — and the three
 * dictionaries hold the sentences. That is what keeps a caption translatable,
 * and it is why the counts below are constants: the generator may only pick a
 * key it knows exists, and `pnpm --filter @awc-ui/showcase-kit lint` fails if
 * the dictionaries and these numbers disagree.
 *
 * Every invariant is asserted at the bottom rather than hoped for. A generator
 * that silently emits a feed with no comments on any post is worse than one
 * that throws.
 */
import { writeFileSync } from 'node:fs';
import { createArtwork } from './lib/artwork.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'social', 'generated.ts');

const SEED = 0x1b7a5eed;
const REPORTING_INSTANT = '2026-09-30T18:20:00Z';
const REPORTING_DATE = '2026-09-30';
const REPORTING_MS = Date.parse(REPORTING_INSTANT);
const VIEWER_HANDLE = 'mara.ilves';

/**
 * How many of each prose key the dictionaries carry.
 *
 * The generator may only reference a key inside these ranges. Raising one means
 * adding the string to all three dictionaries in the same change; the assertion
 * at the bottom cannot check that (it cannot see them from here), but
 * `tsc --noEmit` on the kit can, because every key lands in a typed field.
 */
const CAPTIONS = 30;
const COMMENT_BODIES = 26;
const BIOS = 24;
const LOCATIONS = 14;

/* ------------------------------------------------------------------- prng */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const uf = (min, max) => min + rnd() * (max - min);
const ui = (min, max) => Math.floor(uf(min, max + 1));
const pick = (arr) => arr[ui(0, arr.length - 1)];
const chance = (p) => rnd() < p;

/* ---------------------------------------------------------------- helpers */

const pad2 = (n) => String(n).padStart(2, '0');
const j = (v) => JSON.stringify(v);
const rows = (list) => list.map((row) => `  ${JSON.stringify(row)},`).join('\n');

/** An instant `minutes` before the reporting instant, as an ISO string. */
const ago = (minutes) => new Date(REPORTING_MS - minutes * 60_000).toISOString();

/** A key from a numbered pool: `key('caption', 7)` -> `social.caption.07`. */
const key = (pool, n) => `social.${pool}.${pad2(n)}`;

/**
 * A count that reads like a real one.
 *
 * Engagement is heavy-tailed: most posts get tens of likes and a few get
 * thousands. A uniform draw produces a feed where every post has about the same
 * number, which is the one thing real engagement never looks like — and the
 * compact-notation formatting (1.2K, 14K) would never be exercised.
 */
const heavyTail = (base, spread) => Math.round(base * Math.pow(1 + rnd() * spread, 2.6));

/* ============================================================ the artwork */

/*
 * THE ENGINE MOVED TO `scripts/lib/artwork.mjs` when a second vertical wanted
 * pictures. It takes this file's own `rnd` rather than owning one, so the
 * artwork still comes out of the same single seeded stream as everything else
 * here — which is what makes the fixture reproducible, and what let the
 * extraction be verified by re-running this script and finding `generated.ts`
 * byte-identical.
 */
const { FAMILIES, artwork } = createArtwork(rnd);


/* ============================================================== the people */

/**
 * Twenty-four people, the viewer among them.
 *
 * The names are invented and deliberately span the three locales the app ships
 * plus the rest of Europe — a feed of nothing but English names would make the
 * Arabic build look like a translation layer over an English product, which is
 * exactly the impression this showcase exists to avoid. Handles are ASCII
 * because a handle is an identifier.
 */
const NAMES = [
  ['Mara Ilves', 'mara.ilves', 'MI'],
  ['Yusuf Rahal', 'yusuf.rahal', 'YR'],
  ['Ada Lindqvist', 'ada.lind', 'AL'],
  ['Petru Marinescu', 'petru.m', 'PM'],
  ['Noor Al-Amin', 'noor.alamin', 'NA'],
  ['Iolanda Costa', 'io.costa', 'IC'],
  ['Tobias Krause', 'tobias.k', 'TK'],
  ['Ruxandra Pop', 'ruxi.pop', 'RP'],
  ['Kenji Aalto', 'kenji.aalto', 'KA'],
  ['Salma Bekkari', 'salma.bek', 'SB'],
  ['Emil Novak', 'emil.novak', 'EN'],
  ['Freya Lund', 'freya.lund', 'FL'],
  ['Andrei Vlaicu', 'andrei.v', 'AV'],
  ['Layla Haddad', 'layla.haddad', 'LH'],
  ['Bruno Ferreira', 'bruno.f', 'BF'],
  ['Sanne de Vries', 'sanne.dv', 'SV'],
  ['Omar Kassab', 'omar.kassab', 'OK'],
  ['Clara Iliescu', 'clara.i', 'CI'],
  ['Nikos Pavlidis', 'nikos.p', 'NP'],
  ['Hana Farouk', 'hana.farouk', 'HF'],
  ['Viktor Brandt', 'viktor.b', 'VB'],
  ['Ileana Radu', 'ileana.radu', 'IR'],
  ['Mateo Rossi', 'mateo.rossi', 'MR'],
  ['Zara Mansour', 'zara.m', 'ZM'],
];

const people = NAMES.map(([displayName, handle, initials], index) => {
  const self = handle === VIEWER_HANDLE;
  const hue = (index * 37 + 15) % 360;

  /*
   * The relationship spread is chosen, not drawn, because three of the five
   * values have to exist for the follow button to be worth building: a `none`
   * for "Follow", a `following` for "Following", a `follower` for "Follow
   * back", and a `mutual` for the case people forget. Leaving it to the PRNG
   * risks a fixture with no `follower` in it and a branch nobody ever sees.
   */
  const relationship = self
    ? 'self'
    : index % 7 === 3
      ? 'follower'
      : index % 5 === 2
        ? 'none'
        : index % 3 === 0
          ? 'mutual'
          : 'following';

  const kind = self ? 'personal' : index % 6 === 1 ? 'creator' : index % 9 === 4 ? 'business' : 'personal';
  const followerCount = self ? 1284 : heavyTail(180, 2.4);
  const hasStory = !self && chance(0.55);

  return {
    id: `per-${pad2(index + 1)}`,
    handle,
    displayName,
    initials,
    avatar: artwork('square', hue, FAMILIES[index % FAMILIES.length]),
    bioKey: key('bio', (index % BIOS) + 1),
    kind,
    kindKey: `social.accountKind.${kind}`,
    /* Verified is rare and follows reach, which is the only honest rule for it. */
    verified: !self && (kind === 'creator' || followerCount > 4000),
    relationship,
    relationshipKey: `social.relationship.${relationship}`,
    followerCount,
    followingCount: self ? 342 : heavyTail(120, 1.6),
    postCount: 0,
    lastPostAt: null,
    hasStory,
    storyUnseen: hasStory && chance(0.65),
    locationKey: chance(0.7) ? key('place', ui(1, LOCATIONS)) : null,
  };
});

const viewer = people.find((p) => p.handle === VIEWER_HANDLE);
const others = people.filter((p) => p.id !== viewer.id);

/* ============================================================== the topics */

const TOPICS = [
  ['architecture', 'apartment'],
  ['film', 'movie'],
  ['nature', 'forest'],
  ['design', 'draw'],
  ['food', 'restaurant'],
  ['travel', 'flight'],
  ['music', 'music_note'],
  ['sport', 'directions_run'],
  ['craft', 'handyman'],
  ['city', 'location_city'],
];

const topics = TOPICS.map(([id, icon]) => ({
  id,
  labelKey: `social.topic.${id}`,
  icon,
  postCount: 0,
}));

/* =============================================================== the posts */

/**
 * Forty-two posts across the twenty-four people, newest first.
 *
 * THE FEED IS THE SOURCE OF TRUTH, the way the statement is next door. Every
 * per-person count — postCount, lastPostAt — and every roll-up in TOTALS is
 * counted back off this array rather than chosen and then described, so a
 * profile saying "18 posts" has eighteen tiles under it.
 *
 * The age curve is deliberate and non-uniform: a handful of posts in the last
 * few hours, a cluster over the past week, then a long tail back through the
 * year. A feed with evenly spaced timestamps has no "new since you last
 * looked", which is the thing a feed is for — and every relative-time unit from
 * minutes to years gets exercised, which is the thing the formatter is for.
 */
const POST_AGES = [
  6, 24, 47, 95, 160, 240, 380, 520, 690, 900, 1_180, 1_500,
  1_900, 2_400, 3_000, 3_800, 4_700, 5_800, 7_100, 8_600, 10_300,
  12_400, 15_000, 18_000, 21_600, 26_000, 31_000, 37_000, 44_000, 52_000,
  62_000, 74_000, 88_000, 105_000, 125_000, 150_000, 180_000, 215_000,
  260_000, 320_000, 400_000, 500_000,
];

const posts = POST_AGES.map((minutes, index) => {
  const id = `post-${pad2(index + 1)}`;
  /*
   * The viewer owns roughly one post in five, spread through the timeline
   * rather than bunched, so their profile grid has something at every age and
   * the feed still belongs to other people.
   */
  const author = index % 5 === 2 ? viewer : others[(index * 7 + 3) % others.length];

  const kind = index % 9 === 4 ? 'video' : index % 4 === 1 ? 'carousel' : 'photo';
  const count = kind === 'carousel' ? ui(2, 5) : 1;
  const hue = (index * 53 + 200) % 360;

  const media = Array.from({ length: count }, (_, slot) => {
    const aspect = kind === 'video' ? 'landscape' : slot === 0 ? pick(['square', 'portrait', 'square']) : pick(['square', 'portrait']);
    const family = FAMILIES[(index * 3 + slot) % FAMILIES.length];
    return {
      id: `${id}-m${slot + 1}`,
      aspect,
      src: artwork(aspect, (hue + slot * 24) % 360, family),
      altKey: `social.alt.${family}`,
      durationSec: kind === 'video' && slot === 0 ? ui(8, 95) : null,
    };
  });

  const likeCount = heavyTail(40, 2.2);

  return {
    id,
    authorId: author.id,
    kind,
    kindKey: `social.postKind.${kind}`,
    media,
    captionKey: key('caption', (index % CAPTIONS) + 1),
    postedAt: ago(minutes),
    likeCount,
    commentCount: 0,
    shareCount: Math.round(likeCount * uf(0.02, 0.09)),
    saveCount: Math.round(likeCount * uf(0.05, 0.22)),
    liked: chance(0.3),
    saved: chance(0.16),
    locationKey: chance(0.55) ? key('place', ui(1, LOCATIONS)) : null,
    topics: [topics[(index * 3) % topics.length].id, topics[(index * 7 + 4) % topics.length].id]
      .filter((v, i, a) => a.indexOf(v) === i),
    pinned: false,
    commentsDisabled: index % 13 === 6,
  };
});

/* Two pinned posts on the viewer's profile — the case a grid must order around. */
for (const post of posts.filter((p) => p.authorId === viewer.id).slice(2, 4)) {
  post.pinned = true;
}

/* ============================================================ the comments */

/**
 * Comments, including replies.
 *
 * A post with comments disabled gets none, which is the invariant a screen
 * would otherwise have to defend against. Every reply points at a top-level
 * comment on the SAME post — a thread that crosses posts is not a thing, and
 * generating one would make the comment screen's grouping quietly wrong.
 */
const comments = [];
let commentSeq = 0;

for (const post of posts) {
  if (post.commentsDisabled) continue;
  const top = ui(0, 5);
  const topLevel = [];

  for (let i = 0; i < top; i += 1) {
    commentSeq += 1;
    const author = others[(commentSeq * 5 + 1) % others.length];
    /* A comment is always younger than the post it is on. */
    const postedMinutes = Math.max(
      1,
      Math.round(((REPORTING_MS - Date.parse(post.postedAt)) / 60_000) * uf(0.05, 0.85)),
    );
    const comment = {
      id: `cmt-${pad2(commentSeq)}`,
      postId: post.id,
      authorId: author.id,
      bodyKey: key('comment', (commentSeq % COMMENT_BODIES) + 1),
      postedAt: ago(postedMinutes),
      likeCount: heavyTail(2, 1.4),
      liked: chance(0.12),
      replyToId: null,
    };
    comments.push(comment);
    topLevel.push(comment);
  }

  for (const parent of topLevel) {
    if (!chance(0.35)) continue;
    commentSeq += 1;
    /* A reply is younger than its parent, and often from the post's author. */
    const parentMinutes = (REPORTING_MS - Date.parse(parent.postedAt)) / 60_000;
    comments.push({
      id: `cmt-${pad2(commentSeq)}`,
      postId: post.id,
      authorId: chance(0.5) ? post.authorId : others[(commentSeq * 3) % others.length].id,
      bodyKey: key('comment', (commentSeq % COMMENT_BODIES) + 1),
      postedAt: ago(Math.max(1, Math.round(parentMinutes * uf(0.1, 0.8)))),
      likeCount: heavyTail(1, 1.1),
      liked: false,
      replyToId: parent.id,
    });
  }
}

/* The count on a post is the number of comments on it — counted, not chosen. */
for (const post of posts) {
  post.commentCount = comments.filter((c) => c.postId === post.id).length;
}

/* ============================================================ the activity */

/**
 * What happened to the viewer, newest first.
 *
 * Only events ABOUT the viewer belong here: a like on someone else's post is
 * not the viewer's notification. So every `like`, `comment` and `mention`
 * points at a post the viewer owns, and that constraint is asserted below —
 * getting it wrong produces a plausible-looking screen that tells the reader
 * about strangers liking strangers.
 */
const viewerPosts = posts.filter((p) => p.authorId === viewer.id);
const viewerComments = comments.filter((c) => viewerPosts.some((p) => p.id === c.postId));

const ACTIVITY_AGES = [3, 18, 40, 75, 130, 210, 340, 500, 760, 1_100, 1_700, 2_600, 3_900, 5_600, 8_200, 12_000, 17_000, 25_000, 36_000, 52_000];

const activity = ACTIVITY_AGES.map((minutes, index) => {
  const kind = index % 8 === 5 ? 'follow' : index % 7 === 3 ? 'comment' : index % 11 === 9 ? 'mention' : index % 6 === 4 ? 'tag' : 'like';
  const actor = others[(index * 5 + 2) % others.length];
  const post = kind === 'follow' ? null : viewerPosts[(index * 3) % viewerPosts.length];
  const comment =
    kind === 'comment' || kind === 'mention'
      ? (viewerComments.find((c) => c.postId === post?.id) ?? null)
      : null;

  return {
    id: `act-${pad2(index + 1)}`,
    kind,
    kindKey: `social.activityKind.${kind}`,
    actorId: actor.id,
    postId: post ? post.id : null,
    commentId: comment ? comment.id : null,
    at: ago(minutes),
    /* Everything in the last day is unread; older is read. That is what makes
       the badge a number a reader can verify against the list. */
    read: minutes > 1_440,
  };
});

/* ============================================================== roll-ups */

for (const person of people) {
  const own = posts.filter((p) => p.authorId === person.id);
  person.postCount = own.length;
  person.lastPostAt = own.length ? own[0].postedAt : null;
}

for (const topic of topics) {
  topic.postCount = posts.filter((p) => p.topics.includes(topic.id)).length;
}

const sum = (list, f) => list.reduce((total, item) => total + f(item), 0);

const TOTALS = {
  postCount: viewer.postCount,
  followerCount: viewer.followerCount,
  followingCount: viewer.followingCount,
  peopleCount: people.length,
  topicCount: topics.length,
  activityCount: activity.length,
  unreadActivityCount: activity.filter((a) => !a.read).length,
  likesReceived: sum(viewerPosts, (p) => p.likeCount),
  commentsReceived: sum(viewerPosts, (p) => p.commentCount),
  feedCount: posts.length,
  savedCount: posts.filter((p) => p.saved).length,
  storyCount: people.filter((p) => p.storyUnseen).length,
};

/* ============================================================ invariants */

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

check(people.length === NAMES.length, 'people lost or gained a row');
check(new Set(people.map((p) => p.id)).size === people.length, 'duplicate person id');
check(new Set(people.map((p) => p.handle)).size === people.length, 'duplicate handle');
check(!!viewer, 'the viewer is not in the people list');
check(people.filter((p) => p.relationship === 'self').length === 1, 'there must be exactly one self');
for (const rel of ['following', 'follower', 'mutual', 'none']) {
  check(people.some((p) => p.relationship === rel), `no person is "${rel}" — the follow button's ${rel} branch would never render`);
}
check(people.some((p) => p.verified), 'nobody is verified — the badge would never render');
check(people.some((p) => p.storyUnseen), 'no unseen story — the avatar ring would never render');

check(new Set(posts.map((p) => p.id)).size === posts.length, 'duplicate post id');
check(posts.every((p) => p.media.length >= 1), 'a post has no media');
check(posts.every((p) => p.media.every((m) => m.src.startsWith('data:image/svg+xml,'))), 'a media item is not a data URI');
check(posts.every((p) => p.media.every((m) => !m.src.includes('#'))), 'a data URI carries a raw # and will truncate at the fragment');
check(posts.every((p) => p.media.every((m) => m.altKey.startsWith('social.alt.'))), 'a media item has no alt key — convention 5');
check(posts.every((p) => (p.kind === 'carousel') === (p.media.length > 1)), 'carousel and media count disagree');
check(posts.every((p) => (p.kind === 'video') === (p.media[0].durationSec !== null)), 'video and duration disagree');
check(posts.every((p) => p.topics.length >= 1), 'a post has no topic — the explore facets would drop it');
check(posts.every((p) => p.topics.every((t) => topics.some((topic) => topic.id === t))), 'a post references an unknown topic');
for (const kind of ['photo', 'carousel', 'video']) {
  check(posts.some((p) => p.kind === kind), `no ${kind} post — that branch would never render`);
}
for (const aspect of ['square', 'portrait', 'landscape']) {
  check(posts.some((p) => p.media.some((m) => m.aspect === aspect)), `no ${aspect} media — the feed would never exercise that ratio`);
}
check(
  posts.every((p, i) => i === 0 || Date.parse(p.postedAt) <= Date.parse(posts[i - 1].postedAt)),
  'posts are not newest-first',
);
check(posts.every((p) => Date.parse(p.postedAt) <= REPORTING_MS), 'a post is dated after the reporting instant');
check(posts.some((p) => p.liked) && posts.some((p) => !p.liked), 'every post is liked, or none is');
check(posts.some((p) => p.saved), 'nothing is saved — the saved tab would be empty');
check(posts.some((p) => p.commentsDisabled), 'no post has comments off — that branch would never render');
check(posts.some((p) => p.locationKey !== null) && posts.some((p) => p.locationKey === null), 'the location row is always present, or never');
check(posts.filter((p) => p.pinned).length === 2, 'the profile grid needs exactly two pinned posts');
check(posts.filter((p) => p.pinned).every((p) => p.authorId === viewer.id), 'a pinned post is not the viewer\'s');

check(new Set(comments.map((c) => c.id)).size === comments.length, 'duplicate comment id');
check(comments.every((c) => posts.some((p) => p.id === c.postId)), 'a comment is on no post');
check(comments.every((c) => !posts.find((p) => p.id === c.postId).commentsDisabled), 'a comment sits on a post with comments off');
check(comments.every((c) => c.replyToId === null || comments.some((p) => p.id === c.replyToId && p.postId === c.postId)), 'a reply points outside its own post');
check(
  comments.every(
    (c) => Date.parse(c.postedAt) >= Date.parse(posts.find((p) => p.id === c.postId).postedAt),
  ),
  'a comment is older than the post it is on',
);
check(comments.some((c) => c.replyToId !== null), 'no replies — the nested branch would never render');
check(posts.some((p) => p.commentCount === 0 && !p.commentsDisabled), 'every open post has comments — the empty case would never render');
check(posts.every((p) => p.commentCount === comments.filter((c) => c.postId === p.id).length), 'a post commentCount disagrees with the comments');

check(activity.every((a) => a.kind === 'follow' || a.postId !== null), 'a non-follow activity points at no post');
check(activity.every((a) => a.postId === null || viewerPosts.some((p) => p.id === a.postId)), 'an activity is about a post the viewer does not own');
check(activity.some((a) => !a.read) && activity.some((a) => a.read), 'activity is all read, or all unread');
for (const kind of ['like', 'comment', 'follow', 'mention', 'tag']) {
  check(activity.some((a) => a.kind === kind), `no ${kind} activity — that row would never render`);
}
/* Two digits on purpose: a single-digit badge is the easy case, and a badge
   that has to hold "10" is the one that gets clipped by its host's corner. */
check(
  TOTALS.unreadActivityCount >= 10 && TOTALS.unreadActivityCount <= 12,
  `the unread badge should be a plausible two-digit count, got ${TOTALS.unreadActivityCount}`,
);

check(topics.every((t) => t.postCount > 0), 'a topic has no posts and would render an empty facet');
check(TOTALS.postCount >= 6, 'the viewer has too few posts for a profile grid');
check(TOTALS.feedCount === posts.length, 'feedCount disagrees with the post list');
check(people.every((p) => p.postCount === posts.filter((q) => q.authorId === p.id).length), 'a person postCount disagrees with the posts');

if (failures.length) {
  console.error(`[social] ${failures.length} invariant(s) violated:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

/* ================================================================= output */

const file = `/**
 * GENERATED FILE — do not edit.
 *
 * Produced by \`scripts/generate-social-fixture.mjs\` from seed 0x${SEED.toString(16)}.
 * Re-run with: pnpm --filter @awc-ui/showcase-kit generate:social
 *
 * Every value here is frozen at authoring time. The generator asserts every
 * invariant the screens rely on before it writes, so a fixture that reaches
 * this file is one the app can render.
 */
import type {
  Activity,
  Comment,
  Person,
  Post,
  SocialFixture,
  SocialTotals,
  Topic,
} from './types';

export const PEOPLE = [
${rows(people)}
];

export const TOPICS = [
${rows(topics)}
];

export const POSTS = [
${rows(posts)}
];

export const COMMENTS = [
${rows(comments)}
];

export const ACTIVITY = [
${rows(activity)}
];

export const TOTALS: SocialTotals = ${JSON.stringify(TOTALS, null, 2)};

export const FIXTURE: SocialFixture = {
  reportingInstant: ${j(REPORTING_INSTANT)},
  reportingDate: ${j(REPORTING_DATE)},
  viewerId: ${j(viewer.id)},
  totals: TOTALS,
  people: PEOPLE as Person[],
  posts: POSTS as Post[],
  comments: COMMENTS as Comment[],
  activity: ACTIVITY as Activity[],
  topics: TOPICS as Topic[],
};
`;

writeFileSync(OUT, file, 'utf8');

const bytes = Buffer.byteLength(file);
const artBytes = posts.reduce((t, p) => t + p.media.reduce((s, m) => s + m.src.length, 0), 0);

console.log(`wrote ${OUT}`);
console.log(
  `  people=${people.length} posts=${posts.length} media=${posts.reduce((t, p) => t + p.media.length, 0)} ` +
    `comments=${comments.length} activity=${activity.length} topics=${topics.length}`,
);
console.log(
  `  viewer=${viewer.handle} posts=${TOTALS.postCount} followers=${TOTALS.followerCount} ` +
    `unread=${TOTALS.unreadActivityCount} stories=${TOTALS.storyCount}`,
);
console.log(
  `  ${(bytes / 1024).toFixed(0)} kB total, of which ${(artBytes / 1024).toFixed(0)} kB is artwork ` +
    `(${(artBytes / posts.reduce((t, p) => t + p.media.length, 0)).toFixed(0)} B per image)`,
);
