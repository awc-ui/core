import { parse, serialize } from 'parse5';

/**
 * Remove comment nodes from a complete HTML document. Parse and serialize the
 * tree so malformed comment delimiters follow browser rules and removing a
 * comment cannot join surrounding text into new markup. Script/style contents,
 * attribute values and whitespace in text nodes are not comments.
 */
function removeComments(html, shouldRemove, includeTemplates) {
  const document = parse(html);
  const pending = [document];
  while (pending.length) {
    const parent = pending.pop();
    if (!parent.childNodes) continue;
    parent.childNodes = parent.childNodes.filter(
      (node) => node.nodeName !== '#comment' || !shouldRemove(node.data),
    );
    for (const node of parent.childNodes) {
      pending.push(node);
      // Template content (including declarative shadow DOM) has its own tree.
      if (includeTemplates && node.content) pending.push(node.content);
    }
  }
  return serialize(document);
}

/** Drop explanatory comments from built showcase shells, including templates. */
export function removeHtmlComments(html) {
  return removeComments(html, () => true, true);
}

/**
 * Keep Stencil's positional comments out of Angular's light DOM. Angular's
 * hydration anchors and all template/shadow-root annotations must survive.
 * Testing comment data (not HTML source) also preserves marker-looking strings
 * inside scripts, attributes and escaped text.
 */
export function stripLightDomAnnotations(html) {
  return removeComments(html, (data) => /^[a-z]+\.[\d.]+$/.test(data), false);
}
