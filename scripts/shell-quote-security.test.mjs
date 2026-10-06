import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const fromStorybook = createRequire(new URL('../apps/storybook/package.json', import.meta.url));
const fromConcurrently = createRequire(fromStorybook.resolve('concurrently'));
const { parse, quote } = fromConcurrently('shell-quote');

test('shell quoting rejects line terminators after comment tokens', () => {
  // Exercise GHSA-pqg4-j6r4-53mv without passing any generated text to a shell.
  for (const terminator of ['\n', '\r', '\u2028', '\u2029']) {
    assert.throws(
      () => quote(['echo', 'ok', { comment: 'fixture' }, `value${terminator}unexpected`]),
      TypeError,
    );
  }
});

test('ordinary command arguments preserve spaces, quotes, and metacharacters', () => {
  const arguments_ = ['awc', 'build site', 'name=demo', "it's fine", ';literal', '$literal'];
  assert.deepEqual(parse(quote(arguments_)), arguments_);
});
