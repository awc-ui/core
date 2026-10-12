/** Copyable examples for the public web, SwiftUI and Compose integration APIs.
 * `html` is trusted local recipe markup. Property values are JSON data, never code.
 */
export function usageSnippet(component, properties = {}, platform = 'web', { html, text } = {}) {
  const tag = component?.tag;
  if (typeof tag !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tag)) throw new TypeError('A valid component tag is required.');
  if (!['web', 'ios', 'android'].includes(platform)) throw new TypeError(`Unknown snippet platform: ${platform}`);
  const declared = Array.isArray(component.properties) ? new Set(component.properties.map(property => typeof property === 'string' ? property : property.name)) : null;
  const filtered = Object.fromEntries(Object.entries(properties ?? {}).filter(([key, value]) => value !== undefined && (!declared || declared.has(key))));
  const values = jsonValue(filtered);
  const events = [...new Set((component.events ?? []).map(event => typeof event === 'string' ? event : event.name).filter(name => typeof name === 'string' && name.length))];
  const content = recipeContent(tag, html, text);
  if (platform === 'web') return webSnippet(tag, values, events, html, content.text);
  if (platform === 'ios') return swiftSnippet(tag, values, content);
  return kotlinSnippet(tag, values, content);
}

function jsonValue(value, seen = new Set()) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') throw new TypeError('Snippet properties must contain JSON values.');
  if (seen.has(value)) throw new TypeError('Snippet properties must not contain cycles.');
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = Array.from(value, item => jsonValue(item, seen));
  else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Snippet properties must contain plain JSON objects.');
    result = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, jsonValue(item, seen)]));
  }
  seen.delete(value);
  return result;
}

function htmlText(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function decodeText(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name) => {
    if (name[0] !== '#') return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[name.toLowerCase()] ?? entity;
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
  });
}
function recipeContent(tag, html, text) {
  const markup = typeof html === 'string' ? html.trim() : '';
  const root = markup.match(new RegExp(`<${tag}(?=[\\s>])(?:[^"\'<>]|"[^"]*"|\'[^\']*\')*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  const complex = Boolean(markup && (!root || root[0] !== markup || /<[!/?a-z]/i.test(root[1])));
  const plain = root && !/<[!/?a-z]/i.test(root[1]) ? decodeText(root[1].trim()) : '';
  return { text: text === undefined ? plain : String(text ?? ''), complex };
}

// Escape HTML parser delimiters even though these are JavaScript string/object
// literals: a literal </script> would terminate the containing HTML script first.
function jsLiteral(value, pretty = false) {
  return JSON.stringify(value, null, pretty ? 2 : undefined)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
    .replace(/"__proto__":/g, '["__proto__"]:');
}
function indent(value, spaces) { return value.split('\n').map(line => ' '.repeat(spaces) + line).join('\n'); }
function webSnippet(tag, properties, events, html, text) {
  const markup = typeof html === 'string' && html.trim() ? html.trim() : `<${tag}>${htmlText(text)}</${tag}>`;
  const listeners = events.length ? `\nfor (const name of ${jsLiteral(events)}) {\n  component.addEventListener(name, event => {\n    console.log(name, event.detail);\n  });\n}\n` : '\n';
  return `<div id="awc-example">\n${indent(markup, 2)}\n</div>\n\n<script type="module">\nimport "@awc-ui/core/define";\nimport "@awc-ui/core/css/tokens.css";\n\nawait customElements.whenDefined(${jsLiteral(tag)});\nconst component = document.querySelector(${jsLiteral(`#awc-example ${tag}`)});\n${listeners}\nObject.assign(component, ${jsLiteral(properties, true)});\n</script>`;
}

function nativeString(value, language) {
  let result = '"';
  for (const character of value) {
    const code = character.codePointAt(0);
    if (character === '\\') result += '\\\\';
    else if (character === '"') result += '\\"';
    else if (character === '\n') result += '\\n';
    else if (character === '\r') result += '\\r';
    else if (character === '\t') result += '\\t';
    else if (character === '$' && language === 'kotlin') result += '\\$';
    else if (code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff)) {
      // Swift strings cannot contain an isolated UTF-16 surrogate scalar.
      const scalar = language === 'swift' && code >= 0xd800 && code <= 0xdfff ? 0xfffd : code;
      result += language === 'swift' ? `\\u{${scalar.toString(16)}}` : `\\u${scalar.toString(16).padStart(4, '0')}`;
    } else result += character;
  }
  return result + '"';
}
function numberLiteral(value) {
  if (Object.is(value, -0)) return '-0.0';
  const number = String(value);
  return /[.e]/i.test(number) ? number : `${number}.0`;
}
function swiftValue(value) {
  if (value === null) return '.null';
  if (typeof value === 'string') return `.string(${nativeString(value, 'swift')})`;
  if (typeof value === 'boolean') return `.bool(${value})`;
  if (typeof value === 'number') return `.number(${numberLiteral(value)})`;
  if (Array.isArray(value)) return `.array([${value.map(swiftValue).join(', ')}])`;
  const entries = Object.entries(value);
  return `.object(${entries.length ? `[${entries.map(([key, item]) => `${nativeString(key, 'swift')}: ${swiftValue(item)}`).join(', ')}]` : '[:]'})`;
}
function swiftSnippet(tag, values, content) {
  const entries = Object.entries(values);
  const properties = entries.length ? `[\n${entries.map(([key, value]) => `                ${nativeString(key, 'swift')}: ${swiftValue(value)}`).join(',\n')}\n            ]` : '[:]';
  const children = content.text ? `[.text(${nativeString(content.text, 'swift')})]` : '[]';
  const note = content.complex ? '        // Compose the remaining native child components and named slots with AWCNode.\n        // The web recipe markup and its setup handlers are not translated here.\n' : '';
  return `import SwiftUI\nimport AWCUI\n\nstruct ComponentExample: View {\n    var body: some View {\n${note}        AWCNativeView(\n            tag: ${nativeString(tag, 'swift')},\n            properties: ${properties},\n            children: ${children},\n            onEvent: { event in\n                print(event.name, event.detail.json)\n            }\n        )\n    }\n}`;
}
function kotlinValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return nativeString(value, 'kotlin');
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return numberLiteral(value);
  if (Array.isArray(value)) return value.length ? `listOf<AWCValue>(${value.map(kotlinValue).join(', ')})` : 'emptyList<AWCValue>()';
  const entries = Object.entries(value);
  return entries.length ? `mapOf<String, AWCValue>(${entries.map(([key, item]) => `${nativeString(key, 'kotlin')} to ${kotlinValue(item)}`).join(', ')})` : 'emptyMap<String, AWCValue>()';
}
function kotlinSnippet(tag, values, content) {
  const entries = Object.entries(values);
  const properties = entries.length ? `mapOf<String, AWCValue>(\n${entries.map(([key, value]) => `                ${nativeString(key, 'kotlin')} to ${kotlinValue(value)}`).join(',\n')}\n            )` : 'emptyMap()';
  const note = content.complex ? '        // Compose the remaining native components in the matching content slots.\n        // The web recipe markup and its setup handlers are not translated here.\n' : '';
  const children = content.text ? ` { slot ->\n            if (slot == "") Text(${nativeString(content.text, 'kotlin')})\n        }` : '';
  return `import androidx.compose.runtime.Composable\n${content.text ? 'import androidx.compose.material3.Text\n' : ''}import dev.awc.nativeui.AWCComponent\nimport dev.awc.nativeui.AWCTheme\nimport dev.awc.nativeui.AWCValue\n\n@Composable\nfun ComponentExample() {\n    AWCTheme {\n${note}        AWCComponent(\n            tag = ${nativeString(tag, 'kotlin')},\n            properties = ${properties},\n            onEvent = { name, detail -> println(name + ": " + detail) },\n        )${children}\n    }\n}`;
}
