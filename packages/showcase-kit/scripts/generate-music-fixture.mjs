#!/usr/bin/env node
/**
 * Generate `src/music/generated.ts` — the whole Cygnus fixture, from one seed,
 * once, at authoring time.
 *
 * WHY A GENERATOR AND NOT A HAND-WRITTEN FILE. This fixture has more internal
 * agreement to keep than any of the five before it, because it holds two
 * connected worlds. On the listening side an album's `trackIds` must all exist,
 * every track's `albumId` must point back at the album that lists it, a
 * playlist may not hold a track twice, and the viewer's liked count has to
 * equal the tracks actually marked. On the editing side every clip must belong
 * to a track its project owns, no clip may run past the project's last bar, and
 * two clips on one lane may not overlap — which is not a nicety: overlapping
 * clips in a CSS grid stack into the same cell and the arrangement becomes
 * unreadable. Written by hand those agree until the first edit.
 *
 * WHY IT IS COMMITTED RATHER THAN RUN AT BUILD TIME. Five framework builds have
 * to render byte-identical output for `verify-showcase-parity` to mean
 * anything, and the fixture is the input to all five.
 *
 * ONE SEEDED STREAM, and every draw in this file advances it — including the
 * artwork, which takes this file's `rnd` rather than owning one. Adding a draw
 * anywhere shifts everything after it, which is why the invariants at the
 * bottom are asserted rather than eyeballed.
 *
 *   pnpm --filter @awc-ui/showcase-kit generate:music
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArtwork } from './lib/artwork.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'music', 'generated.ts');

/* A different seed again, or two fixtures would draw the same artwork in the
   same order and two apps would look like one app. */
const SEED = 0x4d3f81c5;
const REPORTING_INSTANT = '2026-11-18T15:20:00Z';
const REPORTING_MS = Date.parse(REPORTING_INSTANT);
const VIEWER_HANDLE = 'mira.halvorsen';

/* Musical time. Both mirror `src/music/types.ts`; see the note there on why
   every project is 120 BPM in 4/4. */
const SECONDS_PER_BAR = 2;
const BPM = 120;

/* How many of each prose pool the dictionary holds. Every `…Key` this file
   emits indexes into one of these, and `scripts/verify.mjs` fails if a key is
   missing from any locale — so these numbers and `src/i18n/*.ts` move
   together. */
const BIOS = 14;
const PLAYLIST_ABOUT = 10;
const CLIP_LABELS = 14;

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

const rows = (list) => list.map((row) => `  ${JSON.stringify(row)},`).join('\n');
const round2 = (n) => Math.round(n * 100) / 100;
const daysBefore = (days) =>
  new Date(REPORTING_MS - days * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** A run of loudness samples that looks like music rather than like noise. */
function peaks(count) {
  const out = [];
  let value = uf(0.35, 0.6);
  for (let i = 0; i < count; i += 1) {
    /* A random walk, not independent draws: consecutive samples in real audio
       are correlated, and independent ones read as static. */
    value = Math.max(0.12, Math.min(1, value + uf(-0.22, 0.22)));
    out.push(round2(value));
  }
  return out;
}

/* ------------------------------------------------------------------- names */

const ARTIST_NAMES = [
  'Halva Drift', 'Renée Aubry', 'Kestrel Lane', 'Bjørk Sandø', 'The Longwave',
  'Ondine Vance', 'Marek Pilar', 'Sable & Ash', 'Yuki Aramaki', 'Cormorant',
  'Ilse Brandt', 'Teodor Vrána',
];

const ALBUM_TITLES = [
  'Drift Season', 'Paper Harbour', 'Low Country', 'Signal Fade', 'The Quiet Hour',
  'Northerly', 'Salt and Copper', 'Ember Room', 'Tidewater', 'Long Exposure',
  'Glasshouse', 'Nightjar', 'Undertow', 'Cold Frame', 'Winter Ferry', 'Slow Machine',
];

const TRACK_TITLES = [
  'Anchor Light', 'Half a Mile', 'Ferrous', 'Blue Hour', 'Sleepwalker', 'Kilter',
  'Weathering', 'Sandbar', 'Nine Sixteen', 'Pale Fire', 'Understudy', 'Marram',
  'Copper Wire', 'Thaw', 'Distant Early', 'Harbour Wall', 'Static Bloom', 'Gleaner',
  'Lantern', 'Overwinter', 'Sixth Street', 'Nautilus', 'Fathom', 'Bellwether',
  'Quarry', 'Meridian', 'Softwood', 'Aster', 'Driftline', 'Kelp Forest',
  'Cinder', 'Vellum', 'Northing', 'Grain', 'Solder', 'Wick',
  'Tessellate', 'Foxglove', 'Ravel', 'Spindrift', 'Hush', 'Coriolis',
  'Palimpsest', 'Trawler', 'Alkaline', 'Beacon', 'Rill', 'Slack Water',
];

const PLAYLIST_TITLES = [
  'Late Desk', 'Morning Ferry', 'Deep Focus', 'Rain on Glass', 'Long Drive',
  'Studio Warmup', 'Everything Slow', 'For the Walk Home',
];

const PROJECT_TITLES = ['Harbour Wall', 'Kilter (remix)', 'Untitled Nov', 'Marram Sessions'];

const TRACK_KINDS = ['drums', 'bass', 'keys', 'guitar', 'vocal', 'synth', 'fx'];
const PROJECT_STATES = ['draft', 'mixing', 'mastering', 'released'];

/* ============================================================== 1. artists */

const artists = ARTIST_NAMES.map((name, index) => ({
  id: `art-${String(index + 1).padStart(2, '0')}`,
  handle: name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, ''),
  name,
  bioKey: `music.bio.${(index % BIOS) + 1}`,
  art: {
    src: artwork('square', ui(0, 359), pick(FAMILIES)),
    altKey: `music.alt.artist`,
    shape: 'square',
  },
  monthlyListeners: ui(4_000, 900_000),
  /* Six of twelve followed, so both states are on screen on the artists shelf
     and the follow button has something to toggle either way. */
  followed: index % 2 === 0,
}));

/* =============================================== 2. albums and their tracks */

const albums = [];
const tracks = [];
let trackTitleAt = 0;

ALBUM_TITLES.forEach((title, index) => {
  const artist = artists[index % artists.length];
  const id = `alb-${String(index + 1).padStart(2, '0')}`;
  const count = ui(3, 5);
  const trackIds = [];

  for (let n = 1; n <= count; n += 1) {
    const trackId = `trk-${String(tracks.length + 1).padStart(3, '0')}`;
    trackIds.push(trackId);
    tracks.push({
      id: trackId,
      title: TRACK_TITLES[trackTitleAt % TRACK_TITLES.length],
      artistId: artist.id,
      albumId: id,
      /* 1:48 to 6:12. Wide enough that the scrubber and the mm:ss readout have
         to handle both a short track and one that crosses six minutes. */
      durationSec: ui(108, 372),
      playCount: ui(120, 480_000),
      liked: chance(0.28),
      trackNumber: n,
      peaks: peaks(16),
    });
    trackTitleAt += 1;
  }

  albums.push({
    id,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title,
    artistId: artist.id,
    year: 2019 + (index % 8),
    art: { src: artwork('square', ui(0, 359), pick(FAMILIES)), altKey: 'music.alt.album', shape: 'square' },
    trackIds,
  });
});

/* ============================================================ 3. playlists */

const playlists = PLAYLIST_TITLES.map((title, index) => {
  /* Distinct tracks only — a playlist holding the same track twice would give
     the queue two entries with one id, and `queueIndex` would always find the
     first. That is a real bug in real players and not one worth demonstrating. */
  const chosen = new Set();
  const want = ui(5, 9);
  while (chosen.size < want) chosen.add(pick(tracks).id);

  return {
    id: `pls-${String(index + 1).padStart(2, '0')}`,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title,
    descriptionKey: `music.playlist.about.${(index % PLAYLIST_ABOUT) + 1}`,
    art: { src: artwork('wide', ui(0, 359), pick(FAMILIES)), altKey: 'music.alt.playlist', shape: 'wide' },
    trackIds: [...chosen],
    /* Five of eight are the viewer's own, so both the "your playlists" and the
       "followed" sections have something in them. */
    own: index < 5,
    updatedAt: daysBefore(ui(1, 90)),
  };
});

/* =============================================================== 4. studio */

const studioTracks = [];
const clips = [];
const projects = [];

PROJECT_TITLES.forEach((title, index) => {
  const id = `prj-${String(index + 1).padStart(2, '0')}`;
  /* One project of each length the stylesheet has a grid for, so all three
     `TIMELINE_BARS` values are exercised by something. */
  const bars = [64, 32, 96, 64][index];
  const trackCount = ui(5, 7);
  const trackIds = [];

  for (let n = 0; n < trackCount; n += 1) {
    const kind = TRACK_KINDS[n % TRACK_KINDS.length];
    const trackId = `st-${String(studioTracks.length + 1).padStart(3, '0')}`;
    trackIds.push(trackId);
    studioTracks.push({
      id: trackId,
      name: `${kind[0].toUpperCase()}${kind.slice(1)} ${n + 1}`,
      kind,
      volume: round2(uf(0.45, 0.95)),
      pan: round2(uf(-0.7, 0.7)),
      muted: false,
      soloed: false,
      level: round2(uf(0.2, 0.85)),
    });

    /*
     * Clips are laid out by WALKING the lane left to right, never by drawing a
     * start at random. Two clips that overlap would land in the same grid
     * columns and stack — see the invariant at the bottom — and rejection
     * sampling to avoid that would make the fixture depend on how many tries
     * the PRNG happened to need.
     */
    let at = ui(1, 4);
    while (at <= bars) {
      const length = ui(2, 8);
      if (at + length - 1 > bars) break;
      clips.push({
        id: `clp-${String(clips.length + 1).padStart(3, '0')}`,
        trackId,
        kind: kind === 'drums' || kind === 'bass' ? 'midi' : 'audio',
        labelKey: `music.clip.label.${(clips.length % CLIP_LABELS) + 1}`,
        startBar: at,
        bars: length,
        peaks: peaks(8),
      });
      /* A gap, so a lane reads as an arrangement rather than a solid block. */
      at += length + ui(1, 6);
    }
  }

  const state = PROJECT_STATES[index % PROJECT_STATES.length];
  projects.push({
    id,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title,
    state,
    stateKey: `music.state.${state}`,
    art: { src: artwork('square', ui(0, 359), pick(FAMILIES)), altKey: 'music.alt.project', shape: 'square' },
    bpm: BPM,
    bars,
    trackIds,
    updatedAt: daysBefore(index * 3 + 1),
  });
});

/* =============================================================== 5. viewer */

/* Drawn LAST of the artwork so adding a listener later cannot shift every
   cover that came before it in the stream. */
const viewer = {
  handle: VIEWER_HANDLE,
  displayName: 'Mira Halvorsen',
  art: { src: artwork('square', ui(0, 359), pick(FAMILIES)), altKey: 'music.alt.viewer', shape: 'square' },
};

/* ================================================================ 6. queue */

/*
 * The queue the transport starts with.
 *
 * IT IS AN ALBUM, not a random selection, because "up next" has to be
 * intelligible: a reader glancing at the queue should see a running order they
 * recognise. It is also long enough that Next can be pressed several times
 * without emptying it, which the browser tests do.
 */
const queueAlbum = albums[0];
const queue = [...queueAlbum.trackIds, ...albums[1].trackIds];

/* =============================================================== 7. totals */

const TOTALS = {
  tracks: tracks.length,
  albums: albums.length,
  artists: artists.length,
  playlists: playlists.length,
  projects: projects.length,
  likedTracks: tracks.filter((t) => t.liked).length,
  listeningMinutes: Math.round(tracks.reduce((sum, t) => sum + t.durationSec, 0) / 60),
};

/* =========================================================== 8. invariants */

const fail = [];
const check = (condition, message) => {
  if (!condition) fail.push(message);
};

/* ---- identity and referential integrity ---- */
check(new Set(tracks.map((t) => t.id)).size === tracks.length, 'duplicate track id');
check(new Set(albums.map((a) => a.slug)).size === albums.length, 'duplicate album slug');
check(new Set(artists.map((a) => a.handle)).size === artists.length, 'duplicate artist handle');
check(new Set(playlists.map((p) => p.slug)).size === playlists.length, 'duplicate playlist slug');
check(new Set(projects.map((p) => p.slug)).size === projects.length, 'duplicate project slug');
check(new Set(clips.map((c) => c.id)).size === clips.length, 'duplicate clip id');

const trackIds = new Set(tracks.map((t) => t.id));
const albumIds = new Set(albums.map((a) => a.id));
const artistIds = new Set(artists.map((a) => a.id));
const studioIds = new Set(studioTracks.map((t) => t.id));

check(tracks.every((t) => albumIds.has(t.albumId)), 'track points at a missing album');
check(tracks.every((t) => artistIds.has(t.artistId)), 'track points at a missing artist');
check(albums.every((a) => artistIds.has(a.artistId)), 'album points at a missing artist');
check(albums.every((a) => a.trackIds.every((id) => trackIds.has(id))), 'album lists a missing track');
check(playlists.every((p) => p.trackIds.every((id) => trackIds.has(id))), 'playlist lists a missing track');
check(clips.every((c) => studioIds.has(c.trackId)), 'clip points at a missing studio track');
check(projects.every((p) => p.trackIds.every((id) => studioIds.has(id))), 'project lists a missing track');
check(queue.every((id) => trackIds.has(id)), 'queue holds a missing track');

/* ---- the album/track relationship agrees in BOTH directions ---- */
check(
  albums.every((album) => album.trackIds.every((id) => tracks.find((t) => t.id === id).albumId === album.id)),
  'an album lists a track whose albumId points elsewhere',
);
check(
  tracks.every((track) => albums.find((a) => a.id === track.albumId).trackIds.includes(track.id)),
  'a track claims an album that does not list it',
);
check(
  albums.every((album) =>
    album.trackIds.every((id, at) => tracks.find((t) => t.id === id).trackNumber === at + 1),
  ),
  'album running order disagrees with trackNumber',
);

/* ---- no playlist holds the same track twice; see the note above ---- */
check(
  playlists.every((p) => new Set(p.trackIds).size === p.trackIds.length),
  'a playlist holds a duplicate track',
);
check(new Set(queue).size === queue.length, 'the queue holds a duplicate track');

/* ---- the timeline: the ones the CSS grid depends on ---- */
check(clips.every((c) => c.startBar >= 1), 'a clip starts before bar 1');
check(clips.every((c) => c.bars >= 1), 'a clip is shorter than one bar');
for (const project of projects) {
  check([32, 64, 96].includes(project.bars), `project ${project.slug} has no CSS grid for ${project.bars} bars`);
  for (const trackId of project.trackIds) {
    const lane = clips.filter((c) => c.trackId === trackId).sort((a, b) => a.startBar - b.startBar);
    check(
      lane.every((c) => c.startBar + c.bars - 1 <= project.bars),
      `a clip runs past the end of ${project.slug}`,
    );
    /* THE ONE THAT MATTERS MOST. Overlapping clips occupy the same grid cells
       and render on top of each other. */
    for (let i = 1; i < lane.length; i += 1) {
      check(
        lane[i].startBar > lane[i - 1].startBar + lane[i - 1].bars - 1,
        `clips ${lane[i - 1].id} and ${lane[i].id} overlap on one lane`,
      );
    }
  }
  check(clips.some((c) => project.trackIds.includes(c.trackId)), `project ${project.slug} has no clips`);
}

/* ---- reachability: every state a screen can show must be in the data ---- */
check(tracks.some((t) => t.liked), 'no track is liked, so the liked list is empty');
check(tracks.some((t) => !t.liked), 'every track is liked, so the like button never turns on');
check(artists.some((a) => a.followed) && artists.some((a) => !a.followed), 'follow is one-sided');
check(playlists.some((p) => p.own) && playlists.some((p) => !p.own), 'playlists are all one kind');
check(
  PROJECT_STATES.every((state) => projects.some((p) => p.state === state)),
  'a project state is unreachable, so one chip never renders',
);
check(
  TRACK_KINDS.every((kind) => studioTracks.some((t) => t.kind === kind)),
  'a track kind is unreachable, so one icon and one colour never render',
);
check(clips.some((c) => c.kind === 'audio') && clips.some((c) => c.kind === 'midi'), 'clips are all one kind');
check(studioTracks.some((t) => t.pan < -0.05), 'nothing is panned left');
check(studioTracks.some((t) => t.pan > 0.05), 'nothing is panned right');
check(
  projects.some((p) => p.bars === 32) && projects.some((p) => p.bars === 64) && projects.some((p) => p.bars === 96),
  'not every timeline length is exercised',
);

/* ---- the mixer ships CLEAN: nothing muted, nothing soloed ---- */
/*
 * DELIBERATE, AND THE OPPOSITE OF THE USUAL ADVICE. Everywhere else this file
 * insists every state be reachable in the data. Here the fixture must ship with
 * all flags off, because the solo/mute rule is the thing the mixer exists to
 * demonstrate and a reader has to be able to watch it take effect. Shipping a
 * soloed track means the screen opens with most of it already silent and the
 * first press turns something ON, which is the least legible possible
 * introduction to the rule.
 */
check(studioTracks.every((t) => !t.muted), 'the fixture ships a muted track');
check(studioTracks.every((t) => !t.soloed), 'the fixture ships a soloed track');

/* ---- durations and totals ---- */
check(tracks.every((t) => t.durationSec > 60 && t.durationSec < 600), 'a track duration is implausible');
check(TOTALS.likedTracks === tracks.filter((t) => t.liked).length, 'likedTracks disagrees with the data');
check(TOTALS.tracks === tracks.length, 'totals.tracks disagrees with the data');
check(queue.length >= 6, 'the queue is too short to press Next several times');

/* ---- artwork ---- */
const allArt = [
  ...artists.map((a) => a.art),
  ...albums.map((a) => a.art),
  ...playlists.map((p) => p.art),
  ...projects.map((p) => p.art),
  viewer.art,
];
check(allArt.every((a) => a.src.startsWith('data:image/svg+xml,')), 'an artwork is not an inlined SVG');
check(allArt.every((a) => typeof a.altKey === 'string' && a.altKey.length > 0), 'an artwork has no altKey');

if (fail.length > 0) {
  console.error('[generate:music] FAILED — the fixture is not internally consistent:');
  for (const message of fail) console.error(`  - ${message}`);
  process.exit(1);
}

/* ================================================================= output */

const file = `/**
 * GENERATED FILE — do not edit.
 *
 * Written by \`scripts/generate-music-fixture.mjs\` from seed
 * ${`0x${SEED.toString(16)}`}. Re-run it with:
 *
 *   pnpm --filter @awc-ui/showcase-kit generate:music
 *
 * Every invariant that file asserts held when this was written. Editing a value
 * here breaks that guarantee silently — change the generator instead.
 */

import type { MusicFixture } from './types';

export const FIXTURE: MusicFixture = {
  viewer: ${JSON.stringify(viewer)},
  totals: ${JSON.stringify(TOTALS)},
  artists: [
${rows(artists)}
  ],
  albums: [
${rows(albums)}
  ],
  tracks: [
${rows(tracks)}
  ],
  playlists: [
${rows(playlists)}
  ],
  projects: [
${rows(projects)}
  ],
  studioTracks: [
${rows(studioTracks)}
  ],
  clips: [
${rows(clips)}
  ],
  queue: ${JSON.stringify(queue)},
};
`;

writeFileSync(OUT, file);

const bytes = Buffer.byteLength(file);
const artBytes = allArt.reduce((sum, a) => sum + a.src.length, 0);

console.log(`[generate:music] ${OUT.split('/').slice(-3).join('/')}`);
console.log(
  `  artists=${artists.length} albums=${albums.length} tracks=${tracks.length} ` +
    `playlists=${playlists.length} projects=${projects.length}`,
);
console.log(
  `  studio tracks=${studioTracks.length} clips=${clips.length} queue=${queue.length} ` +
    `liked=${TOTALS.likedTracks} viewer=${VIEWER_HANDLE}`,
);
console.log(
  `  bars: ${projects.map((p) => `${p.slug}=${p.bars}`).join(' ')}  ` +
    `audio=${clips.filter((c) => c.kind === 'audio').length} midi=${clips.filter((c) => c.kind === 'midi').length}`,
);
console.log(
  `  ${Math.round(bytes / 1024)} kB total, of which ${Math.round(artBytes / 1024)} kB is ` +
    `artwork (${Math.round(artBytes / allArt.length)} B per image)`,
);
