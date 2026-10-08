// Browser-safe contract helpers. Literal parsing never evaluates source code.
export function literalChoices(property) {
  const type = typeof property.type === 'string' ? property.type : property.type?.text || '';
  const parts = [];
  let start = 0, quote = null, escaped = false;
  for (let index = 0; index < type.length; index++) {
    const char = type[index];
    if (escaped) { escaped = false; continue; }
    if (quote && char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = null; continue; }
    if (char === "'" || char === '"') quote = char;
    else if (char === '|') { parts.push(type.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(type.slice(start).trim());
  const choices = [];
  for (const part of parts.filter(Boolean)) {
    if (part === 'true' || part === 'false') choices.push(part === 'true');
    else if (part === 'null') choices.push(null);
    else if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(part)) choices.push(Number(part));
    else if (/^(['"])(?:\\.|(?!\1)[^\\])*\1$/.test(part)) {
      const content = part.slice(1, -1);
      choices.push(content.replace(/\\(?:u\{([\da-fA-F]+)\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|([\s\S]))/g, (_, codePoint, unicode, hex, char) => {
        if (codePoint || unicode || hex) return String.fromCodePoint(parseInt(codePoint || unicode || hex, 16));
        return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' })[char] ?? char;
      }));
    } else return Array.isArray(property.options) && property.options.length > 1 ? property.options : [];
  }
  return choices.length > 1 ? choices : [];
}

export const encodeLiteralChoice = value => JSON.stringify(value);
export function decodeLiteralChoice(encoded, property) {
  const candidate = JSON.parse(encoded);
  if (!literalChoices(property).some(value => Object.is(value, candidate))) throw new Error('Value is outside the declared literal union.');
  return candidate;
}
export function literalChoiceLabel(value, choices) {
  const label = value === null ? 'null' : String(value);
  return choices.some(other => !Object.is(other, value) && String(other) === label) ? `${label} (${value === null ? 'null' : typeof value})` : label;
}

export function portabilityFindings(component) {
  const source = component.diagnostics?.length || 0;
  const platforms = {};
  for (const platform of ['ios', 'android']) {
    const support = component.support?.[platform];
    platforms[platform] = ['unsupportedProperties', 'unsupportedEvents', 'unsupportedMethods', 'unsupportedSlots'].reduce((count, key) => count + (support?.[key]?.length || 0), 0) + (support?.status === 'missing-adapter' ? 1 : 0);
  }
  return { source, ...platforms, total: source + platforms.ios + platforms.android };
}

// Abort fetches eagerly, and guard callbacks (including image load events) that
// may still arrive after cancellation or a component/platform change.
export function createLatestRequest() {
  let controller;
  let generation = 0;
  const cancel = () => { generation++; controller?.abort(); controller = undefined; };
  return {
    cancel,
    start() {
      cancel();
      const currentGeneration = generation;
      controller = new AbortController();
      return { signal: controller.signal, isCurrent: () => currentGeneration === generation };
    },
  };
}

export function nativeRenderRequest(tag, properties, dark) {
  return { tag, properties: JSON.parse(JSON.stringify(properties)), dark: Boolean(dark), width: 640 };
}
