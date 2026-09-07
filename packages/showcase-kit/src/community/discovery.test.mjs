import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  discoveryCopy,
  discoveryCount,
  discoverFeed,
  feedItems,
  matchesDiscovery,
  normalizeDiscoveryQuery,
} from '../../dist/community/index.mjs';
import { createTranslator } from '../../dist/i18n/index.mjs';

const items = feedItems();
const t = createTranslator('en').t;

test('community: empty search preserves feed order and records', () => {
  const before = JSON.stringify(items);
  assert.deepEqual(discoverFeed(items, '  ', 'all', t), items);
  assert.equal(JSON.stringify(items), before);
});

test('community: search matches translated prose, accents and all query terms', () => {
  for (const locale of ['en', 'ro', 'ar']) {
    const translate = createTranslator(locale).t;
    const first = items[0];
    const caption = translate(first.post.bodyKey);
    assert.notEqual(caption, first.post.bodyKey);
    assert.ok(
      discoverFeed(items, caption, 'all', translate).some((item) => item.post.id === first.post.id),
    );
  }
  assert.equal(normalizeDiscoveryQuery('  ÎNȘIRAT  '), 'insirat');
  assert.equal(normalizeDiscoveryQuery('إِلْهَام'), normalizeDiscoveryQuery('الهام'));
  assert.equal(matchesDiscovery('Ada travel sketches', 'sketches ada', 'all', ''), true);
  assert.equal(matchesDiscovery('Ada travel sketches', 'ada music', 'all', ''), false);
  assert.deepEqual(discoverFeed(items, 'no-such-post-429014', 'all', t), []);
});

test('community: complete local copy and language-region fallback', () => {
  const keys = Object.keys(discoveryCopy('en')).sort();
  for (const locale of ['en', 'ro', 'ar']) {
    const copy = discoveryCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), keys);
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.length > 0));
  }
  assert.deepEqual(discoveryCopy('ar-EG'), discoveryCopy('ar'));
  assert.deepEqual(discoveryCopy('unavailable'), discoveryCopy('en'));
});

test('community: friend and group feeds partition the same timeline', () => {
  const friends = discoverFeed(items, '', 'friends', t);
  const groups = discoverFeed(items, '', 'groups', t);
  assert.ok(friends.length > 0 && groups.length > 0);
  assert.ok(friends.every((item) => item.group === null));
  assert.ok(groups.every((item) => item.group !== null));
  assert.equal(friends.length + groups.length, items.length);
  const group = groups[0].group;
  const matches = discoverFeed(items, group.name, 'groups', t);
  assert.ok(matches.length > 0);
  assert.ok(matches.every((item) => item.group !== null));
});

test('community: result counts use natural English, Romanian and Arabic forms', () => {
  const cases = [
    [1, '1 conversation', '1 conversație', 'محادثة واحدة'],
    [2, '2 conversations', '2 conversații', 'محادثتان'],
    [3, '3 conversations', '3 conversații', '3 محادثات'],
    [11, '11 conversations', '11 conversații', '11 محادثة'],
    [31, '31 conversations', '31 de conversații', '31 محادثة'],
  ];
  for (const [count, en, ro, ar] of cases) {
    assert.equal(discoveryCount(count, 'en'), en);
    assert.equal(discoveryCount(count, 'ro'), ro);
    assert.equal(discoveryCount(count, 'ar'), ar);
  }
  assert.equal(discoveryCount(0, 'ar'), 'لا توجد محادثات');
  assert.equal(discoveryCount(20, 'ro'), '20 de conversații');
  assert.equal(discoveryCount(101, 'ro'), '101 conversații');
  assert.equal(discoveryCount(2, 'ar-EG'), 'محادثتان');
  assert.equal(discoveryCount(1, 'unavailable'), '1 conversation');
});
