import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, loadState, persistState, toggleItem, rememberVideo, selectVideos, escapeHtml } from '../src/model.js';
import { sourceUrl, videos } from '../src/data.js';

test('damaged or unavailable browser storage still boots with valid defaults', () => {
  for (const storage of [{ getItem: () => '{broken' }, { getItem: () => { throw new Error('denied'); } }]) {
    assert.deepEqual(loadState(storage), normalizeState(null));
  }
  assert.equal(persistState({ setItem: () => { throw new Error('quota'); } }, {}), false);
});
test('restored state ignores malformed entries and invalid theme values', () => {
  const state = normalizeState({ saved: ['v1', 'v1', null, 5], liked: 'bad', history: {}, uploads: [null, {}], preferences: { theme: 'pink', compact: 'yes', motion: false }, comments: { v1: [{ text: 'hello' }, null, { text: 2 }] } });
  assert.deepEqual(state.saved, ['v1']);
  assert.deepEqual(state.liked, []);
  assert.deepEqual(state.uploads, []);
  assert.equal(state.preferences.theme, 'dark');
  assert.equal(state.preferences.compact, false);
  assert.equal(state.preferences.motion, false);
  assert.equal(state.comments.v1.length, 1);
});
test('search combines category and creator filters without changing the fixture', () => {
  const state = normalizeState(null);
  const order = videos.map(v => v.id);
  assert.deepEqual(selectVideos(state, { query: '  STUDIO  ', category: 'Design' }).map(v => v.id), ['v2', 'v6']);
  assert.deepEqual(selectVideos(state, { query: 'no matching video' }), []);
  assert.equal(selectVideos(state, { channel: 'north' }).length, 2);
  selectVideos(state, { sort: 'popular' });
  assert.deepEqual(videos.map(v => v.id), order);
});
test('saved and history views preserve user order and ignore removed records', () => {
  const state = normalizeState({ saved: ['v6', 'gone', 'v2'], history: ['v3', 'v1'] });
  assert.deepEqual(selectVideos(state, { page: 'saved' }).map(v => v.id), ['v6', 'v2']);
  assert.deepEqual(selectVideos(state, { page: 'history' }).map(v => v.id), ['v3', 'v1']);
  assert.deepEqual(selectVideos(state, { page: 'saved', category: 'Nature' }), []);
});
test('subscriptions show only followed creators and handle an empty collection', () => {
  const state = normalizeState({ subscriptions: ['open'] });
  assert.equal(selectVideos(state, { page: 'subscriptions' }).length, 3);
  state.subscriptions = [];
  assert.deepEqual(selectVideos(state, { page: 'subscriptions' }), []);
});
test('library deduplicates saved and liked videos and includes local videos', () => {
  const state = normalizeState({ saved: ['v1', 'v2'], liked: ['v2'], uploads: [{ id: 'local-1', local: true, title: 'My film', channel: 'you', views: 0 }] });
  assert.deepEqual(selectVideos(state, { page: 'library' }).map(v => v.id), ['local-1', 'v1', 'v2']);
});
test('toggle is reversible; watch history promotes existing videos and caps its size', () => {
  const original = ['v1'];
  assert.deepEqual(toggleItem(toggleItem(original, 'v2'), 'v2'), original);
  assert.deepEqual(rememberVideo(['v1', 'v2'], 'v2'), ['v2', 'v1']);
  assert.equal(rememberVideo(Array.from({ length: 100 }, (_, i) => `video-${i}`), 'new').length, 100);
});
test('user-provided text cannot inject markup and every fixture has an HTTPS stream', () => {
  assert.equal(escapeHtml('<img src=x onerror="boom">&\''), '&lt;img src=x onerror=&quot;boom&quot;&gt;&amp;&#39;');
  assert.ok(videos.every(v => sourceUrl(v)?.startsWith('https://')));
  assert.equal(sourceUrl({ local: true }), '');
});
