import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { deriveTechnologySnippets } from './htmlToTechnology.ts';

function reactStyle(css) {
  const { react } = deriveTechnologySnippets(`<div style="${css}">Example</div>`);
  const object = react.match(/style=\{\{ ([\s\S]*?) \}\}/)?.[1];
  assert.ok(object, react);
  return runInNewContext(`({ ${object} })`);
}

test('React style values preserve quotes, backslashes and control characters as string data', () => {
  for (const value of [String.raw`\'`, String.raw`C:\temp\font`, 'one\ntwo', "'quoted'"]) {
    assert.equal(reactStyle(`--example: ${value}`)['--example'], value);
  }
  const css = "--example: \\' + unexpectedCodeExecution() + '";
  assert.equal(reactStyle(css)['--example'], css.slice('--example: '.length));
});

test('React style keys are serialized and ordinary CSS properties remain camel case', () => {
  const styles = reactStyle("--quote'key: value; background-color: red");
  assert.equal(styles["--quote'key"], 'value');
  assert.equal(styles.backgroundColor, 'red');
});

test('script extraction follows HTML closing-tag syntax and quoted attributes', () => {
  for (const closingTag of ['</script>', '</SCRIPT >', '</script ignored>', '</script\n>']) {
    const { react } = deriveTechnologySnippets(
      `<md-button>Launch</md-button><script data-label="a > b">console.log('setup');${closingTag}`,
    );
    assert.ok(react.includes("console.log('setup');"), react);
    assert.ok(react.includes('useEffect(() => {'), react);
    assert.ok(react.includes('<MdButton>Launch</MdButton>'), react);
    const markup = react.slice(react.indexOf('return ('));
    assert.ok(!markup.includes('console.log'), markup);
    assert.ok(!markup.toLowerCase().includes('<script'), markup);
  }
});

test('script-like custom elements, attributes, and comments are not executable script blocks', () => {
  const authored = '<script-demo>Example</script-demo>\n<!-- <script>commentOnly()</script> -->\n<div title="<script>attributeOnly()</script>">Content</div>';
  const result = deriveTechnologySnippets(authored);
  assert.ok(!result.react.includes('useEffect'), result.react);
  assert.ok(result.html.includes('<script-demo>Example</script-demo>'), result.html);
  assert.ok(result.html.includes('<!-- <script>commentOnly()</script> -->'), result.html);
  assert.ok(result.html.includes('title="<script>attributeOnly()</script>"'), result.html);
});

test('multiple script blocks and scripts inside template contents are lifted once in source order', () => {
  const result = deriveTechnologySnippets('<script>first()</script><template><script>second()</script></template><script>third()</script>');
  assert.ok(result.react.indexOf('first()') < result.react.indexOf('second()'));
  assert.ok(result.react.indexOf('second()') < result.react.indexOf('third()'));
  for (const body of ['first()', 'second()', 'third()']) {
    assert.equal(result.react.split(body).length - 1, 1);
  }
  assert.ok(!result.react.slice(result.react.indexOf('return (')).includes('<script'));
});

test('unterminated scripts are lifted through the end of the authored fragment', () => {
  const { react } = deriveTechnologySnippets('<md-button>Launch</md-button><script>console.log("setup");');
  assert.ok(react.includes('useEffect(() => {'), react);
  assert.ok(react.includes('console.log("setup");'), react);
  assert.ok(!react.slice(react.indexOf('return (')).includes('<script'));
});
