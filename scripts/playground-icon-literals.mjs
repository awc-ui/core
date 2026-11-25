import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ligature = /^[A-Za-z0-9_]+$/;
const token = /[A-Za-z0-9_]+/g;

function fromCodePoint(value) {
  return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '\uFFFD';
}

function decodeEntities(text) {
  return text.replace(/&#(?:x([0-9a-f]+)|(\d+));|&lowbar;/gi, (_, hex, decimal) =>
    hex ? fromCodePoint(Number.parseInt(hex, 16)) : decimal ? fromCodePoint(Number(decimal)) : '_');
}

function cssStrings(source) {
  const result = [];
  // Match comments and quoted strings together so that quotes inside a comment
  // and comment markers inside a string never affect what is extracted.
  for (const match of source.matchAll(/\/\*[\s\S]*?\*\/|"((?:\\[\s\S]|[^"\\])*)"|'((?:\\[\s\S]|[^'\\])*)'/g)) {
    const value = match[1] ?? match[2];
    if (value === undefined) continue;
    result.push(value.replace(/\\(?:([0-9a-f]{1,6})[\t\n\f\r ]?|(\r\n|[\s\S]))/gi,
      (_, hex, char) => hex ? fromCodePoint(Number.parseInt(hex, 16)) : /\r|\n|\f/.test(char) ? '' : char));
  }
  return result;
}

function literalValues(node) {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return literalValues(node.expression);
  if (ts.isConditionalExpression(node)) return [...literalValues(node.whenTrue), ...literalValues(node.whenFalse)];
  if (!ts.isTemplateExpression(node)) return [];

  let prefixes = [node.head.text];
  for (const { expression, literal } of node.templateSpans) {
    const values = literalValues(expression);
    prefixes = prefixes.flatMap(prefix => values.map(value => prefix + value + literal.text));
  }
  return prefixes;
}

export function extractRuntimeIconLiterals(file, source) {
  const names = new Set();
  const codepoints = new Set();
  const add = value => {
    value = value.trim();
    if (ligature.test(value)) names.add(value);
    // Keep complete tokens in embedded markup/data. In plain strings only a
    // complete ligature is useful, so general prose rarely contributes names.
    if (/<[A-Za-z][^>]*>/.test(value) || /^[\[{]/.test(value)) {
      for (const name of value.match(token) ?? []) names.add(name);
    }
    for (const char of value) {
      const code = char.codePointAt(0);
      if (code >= 0xe000 && code <= 0xf8ff) codepoints.add(code);
    }
  };

  const extension = extname(file);
  if (extension === '.css') {
    for (const value of cssStrings(source)) add(value);
  } else if (extension === '.html') {
    add(decodeEntities(source));
  } else {
    const fileNode = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isJsxText(node)) add(decodeEntities(node.text));
      if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
        for (const value of literalValues(node)) {
          add(ts.isJsxAttribute(node.parent) ? decodeEntities(value) : value);
        }
      }
      if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isEnumMember(node)) &&
          ts.isIdentifier(node.name)) add(node.name.text);
      ts.forEachChild(node, visit);
    };
    visit(fileNode);
  }
  return { names: [...names].sort(), codepoints: [...codepoints].sort((a, b) => a - b) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = JSON.parse(readFileSync(0, 'utf8'));
  process.stdout.write(JSON.stringify(Object.fromEntries(paths.map(path =>
    [path, extractRuntimeIconLiterals(path, readFileSync(path, 'utf8'))]))));
}
