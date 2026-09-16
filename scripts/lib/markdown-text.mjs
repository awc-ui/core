import { parseFragment } from 'parse5';

// Keep source offsets when removing Markdown's HTML comments. Inserting a
// space avoids joining text on either side into a new tag or comment token.
export function withoutMarkdownComments(markdown) {
  const ranges = [];
  const visit = (node) => {
    if (node.nodeName === '#comment' && node.sourceCodeLocation) {
      ranges.push(node.sourceCodeLocation);
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(parseFragment(markdown, { sourceCodeLocationInfo: true }));
  let result = '';
  let offset = 0;
  for (const { startOffset, endOffset } of ranges.sort((a, b) => a.startOffset - b.startOffset)) {
    result += markdown.slice(offset, startOffset) + ' ';
    offset = endOffset;
  }
  return result + markdown.slice(offset);
}

export function markdownPlainText(markdown) {
  const text = [];
  const visit = (node) => {
    if (node.nodeName === '#text') text.push(node.value);
    if (node.tagName === 'script' || node.tagName === 'style') return;
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parseFragment(markdown.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')));
  return text.join(' ').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim();
}
