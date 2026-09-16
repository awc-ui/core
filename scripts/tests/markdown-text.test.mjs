import assert from 'node:assert/strict';
import test from 'node:test';
import { markdownPlainText, withoutMarkdownComments } from '../lib/markdown-text.mjs';

test('manifest summaries extract plain text while ignoring HTML comments and active elements', () => {
  assert.equal(markdownPlainText('A **button** with [label](https://example.com) and <b>text</b>.'), 'A button with label and text .');
  assert.equal(markdownPlainText('Visible <!-- hidden --> text<script>unsafe()</script>'), 'Visible text');
});

test('removing comments cannot synthesize a tag and preserves Markdown source', () => {
  assert.equal(withoutMarkdownComments('# Title\n\n<!-- note -->\n**Description**'), '# Title\n\n \n**Description**');
  assert.equal(withoutMarkdownComments('a<!-- first --><!-- second -->b'), 'a  b');
  assert.equal(markdownPlainText('a<!-->hidden -->b'), 'a hidden -->b');
});
