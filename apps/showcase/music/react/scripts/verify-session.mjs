import assert from 'node:assert/strict';
import {
  SESSION_MODES,
  sessionCopy,
  listeningSession,
  startSession,
  removeQueuedTrack,
  initialTransport,
  getQueue,
  trackById,
} from '@awc-ui/showcase-kit/music';

const original = {
  ...initialTransport(getQueue()),
  volume: 0.37,
  muted: true,
  repeat: 'all',
  positionSec: 82,
};
for (const mode of SESSION_MODES) {
  const session = listeningSession(mode);
  assert.equal(session.tracks.length, 6);
  assert.equal(new Set(session.tracks.map((track) => track.id)).size, 6);
  assert.ok(session.tracks.every((track) => trackById(track.id)));
  assert.equal(
    session.duration,
    session.tracks.reduce((sum, track) => sum + track.durationSec, 0),
  );
  const started = startSession(original, session.tracks);
  assert.equal(started.state, 'playing');
  assert.equal(started.positionSec, 0);
  assert.equal(started.trackId, session.tracks[0].id);
  assert.deepEqual(
    started.queue,
    session.tracks.map((track) => track.id),
  );
  assert.equal(started.volume, original.volume);
  assert.equal(started.muted, true);
  assert.equal(started.repeat, 'all');
  assert.equal(removeQueuedTrack(started, started.trackId), started);
  const removed = removeQueuedTrack(started, session.tracks[1].id);
  assert.equal(removed.queue.length, 5);
  assert.equal(removed.trackId, started.trackId);
  assert.equal(removed.state, 'playing');
  assert.equal(removeQueuedTrack(started, 'missing'), started);
}
assert.equal(startSession(original, []), original);
assert.equal(
  startSession(original, [listeningSession('focus').tracks[0], listeningSession('focus').tracks[0]])
    .queue.length,
  1,
);
assert.notDeepEqual(
  listeningSession('focus').tracks.map((track) => track.id),
  listeningSession('energy').tracks.map((track) => track.id),
);
for (const locale of ['en', 'ro', 'ar']) {
  const copy = sessionCopy(locale);
  for (const value of Object.values(copy).flat())
    assert.ok(typeof value === 'string' && value.trim().length > 0);
  assert.equal(copy.modes.length, SESSION_MODES.length);
  assert.equal(copy.names.length, SESSION_MODES.length);
  assert.equal(copy.notes.length, SESSION_MODES.length);
}
assert.match(sessionCopy('ar').title, /[\u0600-\u06ff]/);
assert.deepEqual(sessionCopy('unknown'), sessionCopy('en'));
console.log(
  'Listening sessions: curation, queue replacement/removal, preference preservation, and 3 locales passed.',
);
