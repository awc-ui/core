#!/usr/bin/env node
/**
 * Generate `src/community/generated.ts` — the whole Corvus fixture, from one
 * seed, once, at authoring time.
 *
 * WHY A GENERATOR AND NOT A HAND-WRITTEN FILE. The fixture holds twenty-six
 * people, ten groups, twelve events, forty-eight posts and a hundred and forty
 * comments, and every one of them has to reconcile with the others: a group's
 * `memberCount` has to be at least the number of its posts' distinct authors, a
 * reply's timestamp has to be after the comment it answers, an event's
 * `friendsGoingCount` cannot exceed its `goingCount`, and the viewer's
 * `friendCount` has to equal the people actually marked as friends. Written by
 * hand those agree until the first edit. Generated with the invariants asserted
 * at the bottom of this file, they cannot drift.
 *
 * WHY IT IS COMMITTED RATHER THAN RUN AT BUILD TIME. Five framework builds have
 * to render byte-identical output for `verify-showcase-parity` to mean
 * anything, and the fixture is the input to all five. A generator in the build
 * path would make that a property of everyone running the same Node version.
 *
 * ONE SEEDED STREAM, and every draw in this file advances it — including the
 * artwork, which takes this file's `rnd` rather than owning one. Adding a draw
 * anywhere shifts everything after it, which is why the invariants are asserted
 * rather than eyeballed.
 *
 *   pnpm --filter @awc-ui/showcase-kit generate:community
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArtwork } from './lib/artwork.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'community', 'generated.ts');

/* A different seed from Lyra's, or the two fixtures would draw the same
   artwork in the same order and the two apps would look like one app. */
const SEED = 0x63f21a07;
const REPORTING_INSTANT = '2026-10-14T17:40:00Z';
const REPORTING_DATE = '2026-10-14';
const REPORTING_MS = Date.parse(REPORTING_INSTANT);
const VIEWER_HANDLE = 'petra.novak';

/* How many of each prose pool the dictionary holds. Every `…Key` this file
   emits indexes into one of these, and `scripts/verify.mjs` fails if a key is
   missing from any locale — so these numbers and `src/i18n/*.ts` move
   together. */
const BODIES = 36;
const COMMENT_BODIES = 30;
const BIOS = 26;
const GROUP_ABOUT = 10;
const EVENT_ABOUT = 12;
const LINK_TITLES = 12;
const PLACES = 16;
const WORK = 12;

/* ------------------------------------------------------------------- prng */

function mulberry32(a) {
  return function next() {
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

const { FAMILIES, artwork } = createArtwork(rnd);

/* ---------------------------------------------------------------- helpers */

const pad2 = (n) => String(n).padStart(2, '0');
const rows = (list) => list.map((row) => `  ${JSON.stringify(row)},`).join('\n');

/** An instant N minutes before the reporting instant. */
const ago = (minutes) => new Date(REPORTING_MS - minutes * 60_000).toISOString();
/** And N minutes after it, for events that have not happened yet. */
const ahead = (minutes) => new Date(REPORTING_MS + minutes * 60_000).toISOString();

const key = (pool, n) => `community.${pool}.${pad2(n)}`;

/**
 * A long-tailed count.
 *
 * Reactions on a social post are not uniformly distributed: most posts get a
 * handful, a few get hundreds, and one gets thousands. A uniform draw produces
 * a feed where every post has roughly the same number — the one thing real
 * engagement never looks like — and the compact-notation formatting (1.2K)
 * would never be exercised.
 */
const heavyTail = (base, spread) => Math.round(base * Math.pow(1 + rnd() * spread, 2.6));

let mediaSeq = 0;
function media(aspect) {
  mediaSeq += 1;
  const family = pick(FAMILIES);
  return {
    id: `med-${pad2(mediaSeq)}`,
    aspect,
    src: artwork(aspect, ui(0, 359), family),
    altKey: `community.alt.${family}`,
  };
}

/* ============================================================== the people */

/**
 * Twenty-six people, the viewer among them.
 *
 * The names are invented and deliberately span the three locales the app ships
 * plus the rest of Europe — a network of nothing but English names would make
 * the Arabic build look like a translation layer over an English product, which
 * is exactly the impression this showcase exists to avoid. Handles are ASCII
 * because a handle is an identifier.
 *
 * They do NOT overlap with Lyra's cast. The two apps are separate fictions and
 * a reader switching between them should not meet the same person twice under
 * a different relationship model.
 */
const NAMES = [
  ['Petra Novák', 'petra.novak', 'PN'],
  ['Aleks Rinne', 'aleks.rinne', 'AR'],
  ['Camille Farrow', 'camille.farrow', 'CF'],
  ['Dmitri Solano', 'dmitri.solano', 'DS'],
  ['Esra Yalçın', 'esra.yalcin', 'EY'],
  ['Finn Oduya', 'finn.oduya', 'FO'],
  ['Greta Lindholm', 'greta.lindholm', 'GL'],
  ['Hassan Beydoun', 'hassan.beydoun', 'HB'],
  ['Ines Marchetti', 'ines.marchetti', 'IM'],
  ['Jonas Weiler', 'jonas.weiler', 'JW'],
  ['Kaia Thorsen', 'kaia.thorsen', 'KT'],
  ['Liviu Pîrvu', 'liviu.pirvu', 'LP'],
  ['Maja Kowalczyk', 'maja.kowalczyk', 'MK'],
  ['Nadia Cherif', 'nadia.cherif', 'NC'],
  ['Oskar Blomqvist', 'oskar.blomqvist', 'OB'],
  ['Pilar Estévez', 'pilar.estevez', 'PE'],
  ['Quentin Aubert', 'quentin.aubert', 'QA'],
  ['Rania Haddad', 'rania.haddad', 'RH'],
  ['Sorin Dobre', 'sorin.dobre', 'SD'],
  ['Tanja Vukovic', 'tanja.vukovic', 'TV'],
  ['Ugo Ferrante', 'ugo.ferrante', 'UF'],
  ['Vera Lindqvist', 'vera.lindqvist', 'VL'],
  ['Wojtek Zieliński', 'wojtek.zielinski', 'WZ'],
  ['Yara Nasser', 'yara.nasser', 'YN'],
  ['Zoltán Bíró', 'zoltan.biro', 'ZB'],
  ['Elif Demirci', 'elif.demirci', 'ED'],
];

/**
 * The friendship spread, by index.
 *
 * WRITTEN OUT RATHER THAN DRAWN, because the five states are not equally
 * useful and a random draw would give three of one and none of another. The
 * screens need: a viewer, a solid majority of friends (the feed and the friends
 * list have to be populated), several people who have asked the viewer
 * (`incoming` — the Friends screen's request queue is the thing that screen
 * exists for), a couple the viewer has asked (`outgoing`, the state whose
 * button says "Cancel request"), and a handful of strangers to suggest.
 */
const FRIENDSHIPS = [
  'self',
  'friend', 'friend', 'friend', 'friend', 'friend', 'friend', 'friend',
  'friend', 'friend', 'friend', 'friend', 'friend', 'friend',
  'incoming', 'incoming', 'incoming', 'incoming',
  'outgoing', 'outgoing',
  'none', 'none', 'none', 'none', 'none', 'none',
];

const people = NAMES.map(([displayName, handle, initials], index) => {
  const friendship = FRIENDSHIPS[index];
  const isSelf = friendship === 'self';
  return {
    id: `per-${pad2(index + 1)}`,
    handle,
    displayName,
    initials,
    avatar: artwork('square', ui(0, 359), pick(FAMILIES)),
    cover: media('wide'),
    bioKey: key('bio', (index % BIOS) + 1),
    friendship,
    friendshipKey: `community.friendship.${friendship}`,
    /* Mutuals only mean something for someone who is not already a friend and
       is not you — it is the number that persuades, and on a friend's row it
       would just be noise beside "Friends". */
    mutualCount: isSelf ? 0 : friendship === 'friend' ? ui(2, 14) : ui(1, 9),
    friendCount: isSelf ? 0 : ui(48, 620),
    locationKey: chance(0.75) ? key('place', ui(1, PLACES)) : null,
    workKey: chance(0.6) ? key('work', ui(1, WORK)) : null,
    joinedAt: ago(ui(400_000, 1_400_000)),
    birthday: `--${pad2(ui(1, 12))}-${pad2(ui(1, 28))}`,
    verified: chance(0.12),
    requestedAt:
      friendship === 'incoming' || friendship === 'outgoing' ? ago(ui(60, 20_000)) : null,
  };
});

const viewer = people.find((p) => p.handle === VIEWER_HANDLE);
const friends = people.filter((p) => p.friendship === 'friend');
const others = people.filter((p) => p.id !== viewer.id);

/*
 * THE VIEWER'S OWN FIGURES ARE BACK-SOLVED, not drawn.
 *
 * `friendCount` is exactly how many people are marked `friend`, because the
 * Friends screen lists them and a header that disagreed with the list under it
 * is the first thing anyone would notice. Two birthdays are forced onto today
 * for the same reason: the right rail has a birthdays block, and a fixture
 * where it is usually empty would leave that block undemonstrated.
 */
viewer.friendCount = friends.length;
const todayMonthDay = `--${REPORTING_DATE.slice(5, 7)}-${REPORTING_DATE.slice(8, 10)}`;
friends[2].birthday = todayMonthDay;
friends[7].birthday = todayMonthDay;

/* ============================================================== the groups */

/** Ten groups. The names are proper nouns; everything else is a key. */
const GROUP_NAMES = [
  ['Nordic Film Club', 'nordic-film-club', 'film'],
  ['Tuesday Trail Runners', 'tuesday-trail-runners', 'sport'],
  ['Analog Photography', 'analog-photography', 'photography'],
  ['Kitchen Garden Swap', 'kitchen-garden-swap', 'food'],
  ['Baltic Sailing', 'baltic-sailing', 'travel'],
  ['Type & Lettering', 'type-and-lettering', 'design'],
  ['Riverside Allotments', 'riverside-allotments', 'nature'],
  ['Late Night Jazz', 'late-night-jazz', 'music'],
  ['Old Town Restorers', 'old-town-restorers', 'craft'],
  ['Winter Sea Swimmers', 'winter-sea-swimmers', 'sport'],
];

/*
 * The viewer's standing in each, written out for the same reason the
 * friendships are: the Groups screen has a "your groups" section and a
 * "discover" section, and both have to be populated. One admin and one
 * moderator exist so the role chip has something to show; one `pending` exists
 * because a private group the viewer has asked to join is the state whose
 * button says "Cancel request" and whose feed is hidden.
 */
const GROUP_ROLES = [
  'admin',
  'member', 'member', 'member', 'member',
  'moderator',
  'pending',
  'none', 'none', 'none',
];

const groups = GROUP_NAMES.map(([name, slug, topic], index) => {
  const role = GROUP_ROLES[index];
  const joined = role === 'admin' || role === 'moderator' || role === 'member';
  /*
   * WHICH GROUPS ARE PRIVATE, and index 8 is here because of a state that was
   * otherwise unreachable.
   *
   * 2 is private and the viewer is a member (so a private group's feed IS
   * shown to someone in it) and 6 is private with a request already pending.
   * Neither lets you press Join on a private group and watch it become
   * `pending` rather than `member` — which is the whole reason `GroupPrivacy`
   * is data and not a chip. 8 is a private group the viewer is NOT in, so that
   * transition exists; the invariant at the bottom of this file keeps it.
   */
  const privacy = index === 2 || index === 6 || index === 8 ? 'private' : 'public';
  const memberCount = heavyTail(140, 2.2);
  return {
    id: `grp-${pad2(index + 1)}`,
    slug,
    name,
    descriptionKey: key('groupAbout', (index % GROUP_ABOUT) + 1),
    cover: media('wide'),
    privacy,
    privacyKey: `community.privacy.${privacy}`,
    role,
    roleKey: `community.role.${role}`,
    memberCount,
    postCount: 0,
    weeklyPostCount: 0,
    joinedAt: joined ? ago(ui(20_000, 900_000)) : null,
    topicKey: `community.topic.${topic}`,
  };
});

const joinedGroups = groups.filter((g) => g.joinedAt !== null);

/* =============================================================== the posts */

/**
 * How old each post is, in minutes, newest first.
 *
 * WRITTEN OUT RATHER THAN DRAWN, so the feed's density is a decision instead of
 * an accident: a cluster in the last few hours, then thinning through the day,
 * the week and the month. A uniform draw over a month puts nothing in the last
 * hour half the time, and a feed whose newest item is nine hours old reads as a
 * dead network.
 */
const POST_AGES = [
  7, 19, 34, 52, 81, 115, 160, 220, 290, 380,
  470, 620, 780, 960, 1_180, 1_450, 1_760, 2_150, 2_600, 3_150,
  3_800, 4_600, 5_500, 6_600, 7_900, 9_400, 11_200, 13_300, 15_800, 18_700,
  22_000, 26_000, 31_000, 37_000, 44_000, 52_000, 62_000, 74_000, 88_000, 105_000,
  125_000, 149_000, 178_000, 212_000, 253_000, 302_000, 360_000, 430_000,
];

/** Link-preview domains. Proper nouns, and none of them resolves — see the
    note on `LinkPreview` in types.ts for why that is deliberate. */
const DOMAINS = [
  'northlight.press',
  'the-quiet-atlas.org',
  'fieldnotes.studio',
  'harbourreview.eu',
  'slowmaps.co',
  'papercut.gallery',
];

const posts = POST_AGES.map((minutes, index) => {
  const id = `pst-${pad2(index + 1)}`;
  /*
   * WHO WROTE IT. Mostly friends — the feed is built from the graph, so a post
   * by a stranger could not appear in it — with the viewer's own posts salted
   * through so their profile timeline has something on it.
   */
  const author = chance(0.18) ? viewer : pick(friends);

  /*
   * WHICH KIND, and the weighting is the whole argument of this vertical: text
   * leads. Half the feed is prose with no image at all, which is the case Lyra
   * cannot represent and the case a card built around an image gets wrong.
   */
  const roll = rnd();
  const kind = roll < 0.5 ? 'text' : roll < 0.75 ? 'photo' : roll < 0.9 ? 'link' : 'share';

  /* A quarter of posts go into a group the author and viewer share, which is
     what gives the feed its second byline shape. */
  const group = chance(0.26) && joinedGroups.length > 0 ? pick(joinedGroups) : null;

  const photos =
    kind === 'photo'
      ? Array.from({ length: ui(1, 4) }, () => media(pick(['square', 'landscape', 'portrait'])))
      : [];

  const link =
    kind === 'link'
      ? {
          domain: pick(DOMAINS),
          titleKey: key('linkTitle', ui(1, LINK_TITLES)),
          descriptionKey: key('linkAbout', ui(1, LINK_TITLES)),
          image: media('wide'),
        }
      : null;

  /*
   * THE SIX REACTION COUNTS.
   *
   * `like` always leads and the rest fall away sharply, which is what the real
   * distribution looks like and is what makes the aggregate's "top three"
   * meaningful — six roughly-equal counts would make the top three arbitrary
   * and the display change on every re-generation. Kinds that draw zero are
   * OMITTED rather than written as 0: absent means none, and sixteen zeroes per
   * post is 8 kB of nothing.
   */
  const base = heavyTail(6, 3.4);
  const reactions = {};
  const spread = [1, 0.42, 0.16, 0.22, 0.11, 0.05];
  ['like', 'love', 'care', 'haha', 'wow', 'sad'].forEach((r, i) => {
    const n = Math.round(base * spread[i] * uf(0.5, 1.5));
    if (n > 0) reactions[r] = n;
  });
  if (!reactions.like) reactions.like = 1;

  const audience = group ? 'friends' : pick(['public', 'public', 'friends', 'friends-of-friends']);

  return {
    id,
    authorId: author.id,
    groupId: group ? group.id : null,
    kind,
    kindKey: `community.postKind.${kind}`,
    bodyKey: key('body', ((index * 7) % BODIES) + 1),
    media: photos,
    link,
    sharedPostId: null,
    postedAt: ago(minutes),
    reactions,
    viewerReaction: chance(0.22) ? pick(['like', 'like', 'love', 'haha', 'wow']) : null,
    commentCount: 0,
    shareCount: Math.round(base * uf(0.02, 0.16)),
    audience,
    audienceKey: `community.audience.${audience === 'friends-of-friends' ? 'fof' : audience === 'only-me' ? 'onlyMe' : audience}`,
    pinned: false,
    commentsDisabled: chance(0.06),
  };
});

/*
 * RESOLVE THE SHARES, in a second pass.
 *
 * A share points at an OLDER post — it cannot share something that has not been
 * written yet, and a fixture that let it would produce a card whose inner post
 * is newer than its outer one. It also may not share another share: two levels
 * of nesting is a card inside a card inside a card, which no layout here
 * handles and no real product allows either.
 */
const shareable = (index) =>
  posts.slice(index + 1).filter((p) => p.kind !== 'share' && !p.commentsDisabled);

posts.forEach((post, index) => {
  if (post.kind !== 'share') return;
  const candidates = shareable(index);
  if (candidates.length === 0) {
    /* Nothing older to share — demote it to a plain text post rather than
       leaving a `share` with a null target for a screen to trip over. */
    post.kind = 'text';
    post.kindKey = 'community.postKind.text';
    return;
  }
  const target = pick(candidates);
  post.sharedPostId = target.id;
  target.shareCount += 1;
});

/* Two of the viewer's own posts are pinned, so the profile timeline has the
   case where order is not date order and has to say why. */
const viewerPosts = posts.filter((p) => p.authorId === viewer.id);
if (viewerPosts.length >= 2) {
  viewerPosts[1].pinned = true;
  viewerPosts[3 % viewerPosts.length].pinned = true;
}

/* ============================================================ the comments */

/**
 * The thread, built to a depth of two and no further.
 *
 * DEPTH IS BOUNDED AND THE INVARIANT BELOW ENFORCES IT. An unbounded tree needs
 * an unbounded indent, and at three levels a comment on a phone is a column
 * four words wide. Every product that allows deep nesting ends up collapsing it
 * anyway; bounding it in the DATA means the screens can indent with a constant
 * and the accessibility tree stays two lists deep at worst.
 *
 * A reply is always LATER than what it answers, which sounds obvious and is
 * exactly the sort of thing a random draw gets wrong a third of the time.
 */
const comments = [];
let commentSeq = 0;

for (const post of posts) {
  if (post.commentsDisabled) continue;
  const topLevel = ui(0, 5);
  const postedMs = Date.parse(post.postedAt);
  /* The window between the post and now, so a comment on a ten-minute-old post
     is minutes old rather than mysteriously from last week. */
  const window = Math.max(4, (REPORTING_MS - postedMs) / 60_000);

  for (let t = 0; t < topLevel; t += 1) {
    commentSeq += 1;
    const at = postedMs + uf(0.02, 0.55) * window * 60_000;
    const parentId = `cmt-${pad2(commentSeq)}`;
    const parentAuthor = pick(others);
    comments.push({
      id: parentId,
      postId: post.id,
      authorId: parentAuthor.id,
      bodyKey: key('comment', ui(1, COMMENT_BODIES)),
      postedAt: new Date(at).toISOString(),
      reactions: chance(0.55) ? { like: ui(1, 24) } : {},
      viewerReaction: chance(0.1) ? 'like' : null,
      replyToId: null,
      depth: 0,
    });

    /* Replies to that comment, and replies to those. Fewer at each level, and
       the deepest is capped at one so the tree stays legible. */
    const replies = chance(0.45) ? ui(1, 3) : 0;
    for (let r = 0; r < replies; r += 1) {
      commentSeq += 1;
      const replyId = `cmt-${pad2(commentSeq)}`;
      const replyAt = at + uf(0.05, 0.35) * window * 60_000;
      comments.push({
        id: replyId,
        postId: post.id,
        authorId: pick(others).id,
        bodyKey: key('comment', ui(1, COMMENT_BODIES)),
        postedAt: new Date(Math.min(replyAt, REPORTING_MS)).toISOString(),
        reactions: chance(0.3) ? { like: ui(1, 9) } : {},
        viewerReaction: null,
        replyToId: parentId,
        depth: 1,
      });

      if (chance(0.3)) {
        commentSeq += 1;
        const deepAt = replyAt + uf(0.02, 0.2) * window * 60_000;
        comments.push({
          id: `cmt-${pad2(commentSeq)}`,
          postId: post.id,
          authorId: pick(others).id,
          bodyKey: key('comment', ui(1, COMMENT_BODIES)),
          postedAt: new Date(Math.min(deepAt, REPORTING_MS)).toISOString(),
          reactions: {},
          viewerReaction: null,
          replyToId: replyId,
          depth: 2,
        });
      }
    }
  }
}

/* Back-solve each post's comment count from the comments that exist. */
for (const post of posts) {
  post.commentCount = comments.filter((c) => c.postId === post.id).length;
}

/* And each group's post counts, likewise. */
for (const group of groups) {
  const own = posts.filter((p) => p.groupId === group.id);
  group.postCount = own.length;
  group.weeklyPostCount = own.filter(
    (p) => REPORTING_MS - Date.parse(p.postedAt) < 7 * 24 * 60 * 60_000,
  ).length;
  /* A group cannot have fewer members than it has distinct posting authors. */
  const authors = new Set(own.map((p) => p.authorId)).size;
  group.memberCount = Math.max(group.memberCount, authors + 3);
}

/* ============================================================== the events */

const EVENT_NAMES = [
  ['Harbour Night Screening', 'harbour-night-screening'],
  ['Sunday Long Run', 'sunday-long-run'],
  ['Darkroom Open Day', 'darkroom-open-day'],
  ['Seed Swap & Coffee', 'seed-swap-and-coffee'],
  ['Autumn Crossing', 'autumn-crossing'],
  ['Letterpress Workshop', 'letterpress-workshop'],
  ['Allotment Work Party', 'allotment-work-party'],
  ['Late Set: Trio Nord', 'late-set-trio-nord'],
  ['Facade Survey Walk', 'facade-survey-walk'],
  ['First Frost Swim', 'first-frost-swim'],
  ['Winter Programme Launch', 'winter-programme-launch'],
  ['Archive Film Marathon', 'archive-film-marathon'],
];

/**
 * When each event is, in minutes from the reporting instant.
 *
 * NEGATIVE IS THE PAST, and two of them are, on purpose: an events screen has a
 * past section and it has to have something in it. The rest spread from this
 * evening out to seven weeks, so "this week", "this month" and "later" all
 * group non-empty.
 */
const EVENT_OFFSETS = [
  -14 * 24 * 60,
  -3 * 24 * 60,
  4 * 60,
  22 * 60,
  2 * 24 * 60,
  4 * 24 * 60,
  6 * 24 * 60,
  11 * 24 * 60,
  18 * 24 * 60,
  26 * 24 * 60,
  38 * 24 * 60,
  49 * 24 * 60,
];

/* Written out so every RSVP state exists — including `invited`, which is the
   one an events screen is actually for. */
const RSVPS = [
  'going', 'declined',
  'going', 'interested', 'going', 'invited', 'interested',
  'invited', 'none', 'going', 'none', 'interested',
];

/*
 * WHICH EVENTS ARE ONLINE, written out rather than drawn — and this is the
 * invariant at the bottom of this file earning its keep. It was `chance(0.2)`
 * over twelve events, which on this seed produced none at all: an app with a
 * "Online" state that no fixture row exercises, and nothing would have said so.
 * Rerolling the seed until it came out right would have been the wrong fix —
 * the next edit anywhere above here reshuffles the stream and it breaks again.
 * A state the screens must demonstrate is a decision, not a dice roll.
 */
const ONLINE = new Set([3, 8]);

const events = EVENT_NAMES.map(([name, slug], index) => {
  const offset = EVENT_OFFSETS[index];
  const startsAt = offset < 0 ? ago(-offset) : ahead(offset);
  const durationMin = ui(90, 300);
  const rsvp = RSVPS[index];
  const online = ONLINE.has(index);
  const group = chance(0.65) ? groups[index % groups.length] : null;
  const goingCount = heavyTail(9, 2.1);
  return {
    id: `evt-${pad2(index + 1)}`,
    slug,
    name,
    descriptionKey: key('eventAbout', (index % EVENT_ABOUT) + 1),
    cover: media('wide'),
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + durationMin * 60_000).toISOString(),
    placeKey: online ? null : key('place', ui(1, PLACES)),
    online,
    hostId: pick(friends).id,
    groupId: group ? group.id : null,
    rsvp,
    rsvpKey: `community.rsvp.${rsvp}`,
    goingCount,
    interestedCount: Math.round(goingCount * uf(0.4, 1.8)),
    /* Cannot exceed the going count, and cannot exceed the viewer's friends —
       both are asserted below. */
    friendsGoingCount: Math.min(goingCount, ui(0, Math.min(6, friends.length))),
  };
});

/* ============================================================== roll-ups */

const sum = (list, f) => list.reduce((total, item) => total + f(item), 0);
const withinWeek = (iso) => {
  const delta = Date.parse(iso) - REPORTING_MS;
  return delta >= 0 && delta < 7 * 24 * 60 * 60_000;
};

const TOTALS = {
  friendCount: friends.length,
  postCount: viewerPosts.length,
  requestCount: people.filter((p) => p.friendship === 'incoming').length,
  groupCount: joinedGroups.length,
  goingCount: events.filter((e) => e.rsvp === 'going').length,
  peopleCount: people.length,
  allGroupCount: groups.length,
  allEventCount: events.length,
  feedCount: posts.length,
  upcomingEventCount: events.filter((e) => withinWeek(e.startsAt)).length,
  birthdayCount: friends.filter((p) => p.birthday === todayMonthDay).length,
};

/* ============================================================ invariants */

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const personIds = new Set(people.map((p) => p.id));
const postIds = new Set(posts.map((p) => p.id));
const groupIds = new Set(groups.map((g) => g.id));
const commentIds = new Set(comments.map((c) => c.id));

check(people.length === NAMES.length, 'every name became a person');
check(new Set(people.map((p) => p.handle)).size === people.length, 'handles are unique');
check(new Set(people.map((p) => p.id)).size === people.length, 'person ids are unique');
check(viewer !== undefined, 'the viewer exists');
check(viewer.friendship === 'self', 'the viewer is their own self');
check(
  people.filter((p) => p.friendship === 'self').length === 1,
  'exactly one person is the viewer',
);
check(TOTALS.requestCount > 0, 'somebody has asked to be friends');
check(
  people.filter((p) => p.friendship === 'outgoing').length > 0,
  'the viewer has asked somebody',
);
check(TOTALS.birthdayCount >= 2, 'at least two friends have a birthday today');
check(
  people.every((p) => p.friendship === 'self' || /^--\d\d-\d\d$/.test(p.birthday)),
  'every birthday is a month and a day, with no year',
);
check(
  people.every((p) => (p.requestedAt === null) === !['incoming', 'outgoing'].includes(p.friendship)),
  'requestedAt is set exactly on the two pending states',
);

check(posts.every((p) => personIds.has(p.authorId)), 'every post has a real author');
check(
  posts.every((p) => p.groupId === null || groupIds.has(p.groupId)),
  'every group post names a real group',
);
check(posts.filter((p) => p.kind === 'text').length > posts.length * 0.35, 'text posts lead');
check(posts.some((p) => p.kind === 'photo'), 'some posts carry photos');
check(posts.some((p) => p.kind === 'link'), 'some posts carry a link preview');
check(posts.some((p) => p.kind === 'share'), 'some posts share another post');
check(
  posts.every((p) => (p.kind === 'link') === (p.link !== null)),
  'a link preview exists exactly on link posts',
);
check(
  posts.every((p) => (p.kind === 'photo') === (p.media.length > 0)),
  'photos exist exactly on photo posts',
);
check(posts.every((p) => p.media.length <= 4), 'no post carries more than four photos');
check(
  posts.every((p) => (p.kind === 'share') === (p.sharedPostId !== null)),
  'a shared target exists exactly on share posts',
);
check(
  posts.every((p) => p.sharedPostId === null || postIds.has(p.sharedPostId)),
  'every share points at a real post',
);
check(
  posts.every((p) => {
    if (p.sharedPostId === null) return true;
    const target = posts.find((q) => q.id === p.sharedPostId);
    return target.kind !== 'share';
  }),
  'a share never shares another share',
);
check(
  posts.every((p) => {
    if (p.sharedPostId === null) return true;
    const target = posts.find((q) => q.id === p.sharedPostId);
    return Date.parse(target.postedAt) < Date.parse(p.postedAt);
  }),
  'a share is newer than the post it shares',
);
check(
  posts.every((p) => Object.values(p.reactions).every((n) => n > 0)),
  'no reaction is written as zero',
);
check(posts.every((p) => (p.reactions.like ?? 0) > 0), 'every post has at least one reaction');
check(
  posts.some((p) => Object.keys(p.reactions).length >= 5),
  'some post carries five or more distinct reactions',
);
check(posts.some((p) => p.viewerReaction !== null), 'the viewer has reacted to something');
check(
  posts.every((p) => p.commentsDisabled === false || p.commentCount === 0),
  'a post with comments off has no comments',
);
check(posts.filter((p) => p.pinned).length === 2, 'exactly two posts are pinned');
check(
  posts.every((p, i) => i === 0 || Date.parse(p.postedAt) < Date.parse(posts[i - 1].postedAt)),
  'posts are newest first',
);

check(comments.every((c) => postIds.has(c.postId)), 'every comment is on a real post');
check(comments.every((c) => personIds.has(c.authorId)), 'every comment has a real author');
check(comments.every((c) => c.depth >= 0 && c.depth <= 2), 'the thread is at most two deep');
check(
  comments.every((c) => (c.replyToId === null) === (c.depth === 0)),
  'depth 0 is exactly the top level',
);
check(
  comments.every((c) => c.replyToId === null || commentIds.has(c.replyToId)),
  'every reply answers a real comment',
);
check(
  comments.every((c) => {
    if (c.replyToId === null) return true;
    const parent = comments.find((x) => x.id === c.replyToId);
    return parent.depth === c.depth - 1 && parent.postId === c.postId;
  }),
  'a reply is one level under its parent and on the same post',
);
check(
  comments.every((c) => {
    if (c.replyToId === null) return true;
    const parent = comments.find((x) => x.id === c.replyToId);
    return Date.parse(c.postedAt) >= Date.parse(parent.postedAt);
  }),
  'a reply is never older than what it answers',
);
check(comments.some((c) => c.depth === 2), 'the deepest level is actually used');
check(
  comments.every((c) => Date.parse(c.postedAt) <= REPORTING_MS),
  'no comment is from the future',
);
check(
  posts.every((p) => p.commentCount === comments.filter((c) => c.postId === p.id).length),
  'every commentCount matches the comments that exist',
);

check(new Set(groups.map((g) => g.slug)).size === groups.length, 'group slugs are unique');
check(groups.filter((g) => g.role === 'admin').length >= 1, 'the viewer administers a group');
check(groups.filter((g) => g.role === 'moderator').length >= 1, 'and moderates one');
check(groups.filter((g) => g.role === 'pending').length >= 1, 'and is waiting on one');
check(groups.filter((g) => g.role === 'none').length >= 2, 'and there are groups to discover');
check(groups.some((g) => g.privacy === 'private'), 'some group is private');
check(
  groups.some((g) => g.privacy === 'private' && g.role === 'none'),
  'a private group the viewer is NOT in exists, so join-becomes-pending is reachable',
);
check(
  groups.some((g) => g.privacy === 'private' && ['admin', 'moderator', 'member'].includes(g.role)),
  'and one they ARE in, so a private feed can be shown to a member',
);
check(
  groups.every((g) => (g.joinedAt !== null) === ['admin', 'moderator', 'member'].includes(g.role)),
  'joinedAt is set exactly on the roles that are memberships',
);
check(
  groups.every((g) => g.memberCount >= new Set(posts.filter((p) => p.groupId === g.id).map((p) => p.authorId)).size),
  'a group has at least as many members as it has posting authors',
);
check(
  groups.every((g) => g.weeklyPostCount <= g.postCount),
  'a week of posts is not more than all of them',
);

check(new Set(events.map((e) => e.slug)).size === events.length, 'event slugs are unique');
check(events.every((e) => personIds.has(e.hostId)), 'every event has a real host');
check(
  events.every((e) => e.groupId === null || groupIds.has(e.groupId)),
  'every group event names a real group',
);
check(
  events.every((e) => Date.parse(e.endsAt) > Date.parse(e.startsAt)),
  'every event ends after it starts',
);
check(
  events.filter((e) => Date.parse(e.startsAt) < REPORTING_MS).length >= 2,
  'at least two events are in the past',
);
check(TOTALS.upcomingEventCount >= 2, 'at least two events are within the week');
check(
  events.every((e) => e.friendsGoingCount <= e.goingCount),
  'friends going never exceeds everyone going',
);
check(
  events.every((e) => e.friendsGoingCount <= friends.length),
  'friends going never exceeds the number of friends',
);
check(
  events.every((e) => (e.placeKey === null) === e.online),
  'an event has a place unless it is online',
);
check(events.some((e) => e.rsvp === 'invited'), 'the viewer has an unanswered invitation');
check(events.some((e) => e.online), 'some event is online');
check(
  new Set(events.map((e) => e.rsvp)).size >= 4,
  'at least four of the five RSVP states are used',
);

check(
  [...people, ...groups, ...events].every((x) => (x.cover ? x.cover.altKey.length > 0 : true)),
  'every cover is described',
);
check(
  posts.every((p) => p.media.every((m) => m.altKey.length > 0)),
  'every photo is described (convention 5)',
);
check(
  posts.every((p) => p.link === null || p.link.image.altKey.length > 0),
  'every link banner is described',
);
check(
  posts.every((p) => p.link === null || p.link.image.aspect === 'wide'),
  'a link banner is always wide',
);

if (failures.length) {
  console.error(`\n[generate:community] ${failures.length} invariant(s) failed:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

/* ================================================================= output */

const file = `/**
 * GENERATED FILE — do not edit.
 *
 * Written by \`scripts/generate-community-fixture.mjs\` from seed
 * ${`0x${SEED.toString(16)}`}. Re-run it with:
 *
 *   pnpm --filter @awc-ui/showcase-kit generate:community
 *
 * Every invariant that file asserts held when this was written. Editing a value
 * here breaks that guarantee silently — change the generator instead.
 */

import type { CommunityFixture } from './types';

export const FIXTURE: CommunityFixture = {
  reportingInstant: ${JSON.stringify(REPORTING_INSTANT)},
  reportingDate: ${JSON.stringify(REPORTING_DATE)},
  viewerId: ${JSON.stringify(viewer.id)},
  totals: ${JSON.stringify(TOTALS)},
  people: [
${rows(people)}
  ],
  groups: [
${rows(groups)}
  ],
  events: [
${rows(events)}
  ],
  posts: [
${rows(posts)}
  ],
  comments: [
${rows(comments)}
  ],
};
`;

writeFileSync(OUT, file);

const bytes = Buffer.byteLength(file);
const art = [
  ...people.map((p) => p.avatar.length),
  ...[...people, ...groups, ...events].map((x) => x.cover.src.length),
  ...posts.flatMap((p) => p.media.map((m) => m.src.length)),
  ...posts.filter((p) => p.link).map((p) => p.link.image.src.length),
];
const artBytes = art.reduce((a, b) => a + b, 0);

console.log(`[generate:community] ${OUT.split('/').slice(-3).join('/')}`);
console.log(
  `  people=${people.length} groups=${groups.length} events=${events.length} ` +
    `posts=${posts.length} comments=${comments.length}`,
);
console.log(
  `  viewer=${viewer.handle} friends=${TOTALS.friendCount} requests=${TOTALS.requestCount} ` +
    `groups=${TOTALS.groupCount} going=${TOTALS.goingCount} birthdays=${TOTALS.birthdayCount}`,
);
console.log(
  `  text=${posts.filter((p) => p.kind === 'text').length} ` +
    `photo=${posts.filter((p) => p.kind === 'photo').length} ` +
    `link=${posts.filter((p) => p.kind === 'link').length} ` +
    `share=${posts.filter((p) => p.kind === 'share').length}  ` +
    `depth2 comments=${comments.filter((c) => c.depth === 2).length}`,
);
console.log(
  `  ${Math.round(bytes / 1024)} kB total, of which ${Math.round(artBytes / 1024)} kB is ` +
    `artwork (${Math.round(artBytes / art.length)} B per image)`,
);
