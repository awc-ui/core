import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slugify } from '../../dist/design/index.mjs';

test('project slugs collapse separators and remove both edge separators', () => {
  for (const [name, expected] of [
    ['Meridian Rebrand', 'meridian-rebrand'],
    ['---  Meridian___Rebrand !!! ', 'meridian-rebrand'],
    ['Project 42', 'project-42'],
    ['', ''],
    ['---?!   ', ''],
    ['a', 'a'],
  ]) assert.equal(slugify(name), expected);
});

test('project slugs normalize long separator runs', () => {
  const separators = '-!?'.repeat(100000);
  assert.equal(slugify(`${separators}Design${separators}System${separators}`), 'design-system');
  assert.equal(slugify(separators), '');
});
