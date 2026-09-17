import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { removeHtmlComments, stripLightDomAnnotations } from '../lib/html-comments.mjs';

function nodes(html) {
  const result = [];
  const pending = [parse(html)];
  while (pending.length) {
    const node = pending.pop();
    result.push(node);
    pending.push(...(node.childNodes ?? []));
    if (node.content) pending.push(node.content);
  }
  return result;
}

function comments(html) {
  return nodes(html).filter((node) => node.nodeName === '#comment').map((node) => node.data);
}

function textOf(node) {
  return (node.childNodes ?? []).map((child) => child.value ?? textOf(child)).join('');
}

// Compare browser-visible structure while ignoring comments and merging text
// nodes that become adjacent after a comment is removed.
function structure(node) {
  const children = [];
  for (const child of node.childNodes ?? []) {
    if (child.nodeName === '#comment') continue;
    if (child.nodeName === '#text') {
      if (typeof children.at(-1) === 'string') children[children.length - 1] += child.value;
      else children.push(child.value);
    } else children.push(structure(child));
  }
  return {
    name: node.nodeName,
    attrs: node.attrs,
    children,
    ...(node.content ? { content: structure(node.content) } : {}),
  };
}

test('comment removal cannot assemble a script tag from surrounding text', () => {
  for (const remove of [removeHtmlComments, stripLightDomAnnotations]) {
    const source = '<!doctype html><body><<!--r.123-->script>alert(1)</script></body>';
    const result = remove(source);
    assert.equal(nodes(result).some((node) => node.tagName === 'script'), false);
    assert.equal(textOf(nodes(result).find((node) => node.tagName === 'body')), '<script>alert(1)');
    assert.deepEqual(structure(parse(result)), structure(parse(source)));
  }
});

test('HTML comment syntax inside attributes, raw text and RCDATA stays intact', () => {
  const source = `<!doctype html><html><head>
    <title>Keep &lt;!--title--&gt;</title>
    <script>const marker = '<!--script-->';\n\nconst template = '<template>';\n</script>
    <style>/* <!--style--> */\n\n.example { color: red; }</style>
    </head><body data-example="<!--attribute-->">
    <textarea>Keep <!--textarea-->\n\n  spacing</textarea>
    <pre>Keep\n\n  spacing</pre><!-- actual comment -->
    </body></html>`;
  const result = removeHtmlComments(source);
  assert.deepEqual(comments(result), []);
  assert.deepEqual(structure(parse(result)), structure(parse(source)));
});

test('malformed and nested comment delimiters follow browser parsing', () => {
  const source = '<!doctype html><body><!-->one<!-- two --!>three<!--outer <!--inner-->four--><p>five</p></body>';
  const result = removeHtmlComments(source);
  assert.deepEqual(comments(result), []);
  assert.deepEqual(structure(parse(result)), structure(parse(source)));
  assert.equal(textOf(nodes(result).find((node) => node.tagName === 'body')), 'onethreefour-->five');
});

test('build comment removal also visits nested template contents', () => {
  const source = '<!doctype html><body><!--a--><template shadowrootmode="open"><!--b--><template><!--c--><p>keep</p></template></template></body>';
  const result = removeHtmlComments(source);
  assert.deepEqual(comments(result), []);
  assert.deepEqual(structure(parse(result)), structure(parse(source)));
});

test('SSR removes only light-DOM Stencil markers and preserves hydration boundaries', () => {
  const source = `<!doctype html><html><head><script>
    const annotation = '<!--r.99-->';
    const boundary = '</template><template>';
    </script></head><body><!--container--><md-button s-id="1" data-marker="<!--r.98-->">
    <!--r.1--><TEMPLATE shadowrootmode="open"><!--r.2--><span c-id="2.0.1"><!--t.2.0.1-->Shadow</span>
      <template><!--r.3--></template>
    </TEMPLATE><!--t.1.0.1-->Light
    <template><!--r.4--></template><!--r.5-->
    </md-button><!--ngetn--><!--ngtns--><!--ng-container--><!--r.not-a-marker-->
    <textarea><!--r.6--></textarea>&lt;!--r.7--&gt;</body></html>`;
  const result = stripLightDomAnnotations(source);
  assert.deepEqual(comments(result).sort(), [
    'container', 'ng-container', 'ngetn', 'ngtns', 'r.2', 'r.3', 'r.4', 'r.not-a-marker', 't.2.0.1',
  ].sort());
  assert.deepEqual(structure(parse(result)), structure(parse(source)));
  assert.equal(textOf(nodes(result).find((node) => node.tagName === 'script')),
    textOf(nodes(source).find((node) => node.tagName === 'script')));
});

test('all showcase build shells retain their non-comment document structure', () => {
  const showcase = fileURLToPath(new URL('../../apps/showcase/', import.meta.url));
  let checked = 0;
  for (const vertical of readdirSync(showcase, { withFileTypes: true })) {
    if (!vertical.isDirectory()) continue;
    for (const framework of ['react', 'vue', 'svelte', 'html', 'angular']) {
      const directory = resolve(showcase, vertical.name, framework);
      const shell = resolve(directory, framework === 'angular' ? 'src/index.html' : 'index.html');
      let source;
      try { source = readFileSync(shell, 'utf8'); }
      catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      const result = removeHtmlComments(source);
      assert.deepEqual(comments(result), [], shell);
      assert.deepEqual(structure(parse(result)), structure(parse(source)), shell);
      checked++;
    }
  }
  assert.ok(checked >= 29, `Expected all affected shells, checked ${checked}`);
});
