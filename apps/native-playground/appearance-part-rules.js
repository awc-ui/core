/**
 * `::part()` declarations of a component appearance (fields that are not custom properties, such as md-button's fixed
 * state-layer opacity). The Web preview keeps one stylesheet per styled element in that element's root (document or
 * shadow root); usage examples print the same rules.
 */
const ids = new WeakMap();
let nextId = 0;

/** CSS text for [{ part, property, value }] under a selector. */
export function partRulesCSS(selector, rules = []) {
  const byPart = new Map();
  for (const { part, property, value } of rules) {
    if (!byPart.has(part)) byPart.set(part, []);
    byPart.get(part).push(`${property}: ${value};`);
  }
  return [...byPart].map(([part, declarations]) => `${selector}::part(${part}) { ${declarations.join(' ')} }`).join('\n');
}

/** Replaces the element's part rules (none removes them). */
export function applyAppearancePartRules(target, rules = []) {
  if (!target || typeof target.getRootNode !== 'function') return;
  const root = target.getRootNode();
  const doc = target.ownerDocument || root;
  const host = root && root.nodeType === 11 ? root : doc?.head || doc?.documentElement;
  if (!host) return;
  if (!ids.has(target)) ids.set(target, String(++nextId));
  const id = ids.get(target);
  let style = [...(host.children || [])].find(node => node.localName === 'style' && node.getAttribute?.('data-awc-part-rules') === id);
  if (!rules.length) {
    target.removeAttribute?.('data-awc-part-style');
    style?.remove?.();
    return;
  }
  target.setAttribute?.('data-awc-part-style', id);
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute('data-awc-part-rules', id);
    host.append(style);
  }
  style.textContent = partRulesCSS(`[data-awc-part-style="${id}"]`, rules);
}
