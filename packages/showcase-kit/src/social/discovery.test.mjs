import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  discoveryCopy,
  discoveryCount,
  discoverFeed,
  feedItems,
  matchesDiscovery,
  normalizeDiscoveryQuery,
} from '../../dist/social/index.mjs';
import { createTranslator } from '../../dist/i18n/index.mjs';

const items = feedItems();
const t = createTranslator('en').t;

test('social: empty search preserves feed order and records', () => {
  const before = JSON.stringify(items);
  assert.deepEqual(discoverFeed(items, '  ', 'all', t), items);
  assert.equal(JSON.stringify(items), before);
});

test('social: search matches translated prose, accents and all query terms', () => {
  for (const locale of ['en', 'ro', 'ar']) {
    const translate = createTranslator(locale).t;
    const first = items[0];
    const caption = translate(first.post.captionKey);
    assert.notEqual(caption, first.post.captionKey);
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

test('social: complete local copy and language-region fallback', () => {
  const keys = Object.keys(discoveryCopy('en')).sort();
  for (const locale of ['en', 'ro', 'ar']) {
    const copy = discoveryCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(), keys);
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.length > 0));
  }
  assert.deepEqual(discoveryCopy('ar-EG'), discoveryCopy('ar'));
  assert.deepEqual(discoveryCopy('unavailable'), discoveryCopy('en'));
});

test('social: saved filter uses live overrides and intersects search', () => {
  const chosen = items.find((item) => !item.post.saved);
  assert.ok(chosen);
  const result = discoverFeed(items, '', 'saved', t, (item) => item.post.id === chosen.post.id);
  assert.deepEqual(result, [chosen]);
  assert.deepEqual(
    discoverFeed(
      items,
      chosen.author.handle,
      'saved',
      t,
      (item) => item.post.id === chosen.post.id,
    ),
    [chosen],
  );
  assert.deepEqual(
    discoverFeed(items, '', 'saved', t, () => false),
    [],
  );
  assert.deepEqual(
    discoverFeed(items, '', 'carousel', t),
    items.filter((item) => item.post.kind === 'carousel'),
  );
});

test('social: result counts use natural English, Romanian and Arabic forms', () => {
  const cases = [
    [1, '1 moment', '1 moment', 'لحظة واحدة'],
    [2, '2 moments', '2 momente', 'لحظتان'],
    [3, '3 moments', '3 momente', '3 لحظات'],
    [11, '11 moments', '11 momente', '11 لحظة'],
    [31, '31 moments', '31 de momente', '31 لحظة'],
  ];
  for (const [count, en, ro, ar] of cases) {
    assert.equal(discoveryCount(count, 'en'), en);
    assert.equal(discoveryCount(count, 'ro'), ro);
    assert.equal(discoveryCount(count, 'ar'), ar);
  }
  assert.equal(discoveryCount(0, 'ar'), 'لا توجد لحظات');
  assert.equal(discoveryCount(20, 'ro'), '20 de momente');
  assert.equal(discoveryCount(101, 'ro'), '101 momente');
  assert.equal(discoveryCount(2, 'ar-EG'), 'لحظتان');
  assert.equal(discoveryCount(1, 'unavailable'), '1 moment');
});
