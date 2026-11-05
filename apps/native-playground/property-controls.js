// Browser-safe, non-evaluating property editors. JSON editing validates the
// outer value shape; it does not pretend to implement the TypeScript checker.
import { literalChoices } from './contracts.js';
import { normalizeMeterFormatOptions } from './meter-format-options.js';

const typeText = value => typeof value === 'string' ? value : value?.text || '';
const domReference = /\b(?:HTMLElement|HTML\w+Element|SVG\w*Element|Element|Document|Window|Node|Event|EventTarget)\b/;
const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

function cleanType(input) {
  let result = '', quote = '', escaped = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index], next = input[index + 1];
    if (quote) {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
    } else if (char === "'" || char === '"' || char === '`') { quote = char; result += char; }
    else if (char === '/' && next === '*') { const end = input.indexOf('*/', index + 2); index = end < 0 ? input.length : end + 1; result += ' '; }
    else if (char === '/' && next === '/') { const end = input.indexOf('\n', index + 2); index = end < 0 ? input.length : end; result += ' '; }
    else result += char;
  }
  return result.trim().replace(/;\s*$/, '');
}

function unionParts(type) {
  const parts = []; let start = 0, quote = '', escaped = false; const stack = [];
  for (let index = 0; index < type.length; index++) {
    const char = type[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
    } else if (char === "'" || char === '"' || char === '`') quote = char;
    else if ('({[<'.includes(char)) stack.push(char);
    else if (')}]>'.includes(char)) stack.pop();
    else if (char === '|' && !stack.length) { parts.push(type.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(type.slice(start).trim());
  return parts.filter(Boolean);
}

function literal(type) {
  if (type === 'true' || type === 'false') return { kind: 'literal', value: type === 'true' };
  if (numberPattern.test(type) && Number.isFinite(Number(type))) return { kind: 'literal', value: Number(type) };
  if (/^(['"])(?:\\.|(?!\1)[^\\])*\1$/.test(type)) {
    try { const values = literalChoices({ type: `${type} | ${type}` }); if (values.length) return { kind: 'literal', value: values[0] }; } catch { /* Unrecognized literal stays read-only. */ }
  }
  return null;
}

function resolve(type, definitions, visited = new Set()) {
  type = cleanType(type);
  if (!type) return [{ kind: 'unknown' }];
  if (visited.size > 20) return [{ kind: 'unknown' }];
  const parts = unionParts(type);
  if (parts.length > 1) return parts.flatMap(part => resolve(part, definitions, new Set(visited)));
  type = parts[0] || type;
  if (type.startsWith('(') && type.endsWith(')')) return resolve(type.slice(1, -1), definitions, visited);
  const scalar = literal(type); if (scalar) return [scalar];
  if (/=>|\bFunction\b/.test(type) || domReference.test(type)) return [{ kind: 'reference' }];
  if (['string', 'number', 'boolean', 'null', 'undefined'].includes(type)) return [{ kind: type }];
  if (/^string\s*&\s*\{\s*\}$/.test(type)) return [{ kind: 'string' }];
  if (/^(?:readonly\s+)?\[[\s\S]*\]$/.test(type)) return [{ kind: 'array' }];
  if (type.endsWith('[]')) return [{ kind: 'array', items: resolve(type.slice(0, -2).replace(/^readonly\s+/, ''), definitions, new Set(visited)) }];
  const array = type.match(/^(?:ReadonlyArray|Array)<([\s\S]*)>$/);
  if (array) return [{ kind: 'array', items: resolve(array[1], definitions, new Set(visited)) }];
  if (type.startsWith('{') || /^(?:Record|Partial|Pick|Omit|Readonly)<|^object$|^Intl\.NumberFormatOptions$/.test(type)) return [{ kind: 'object' }];
  if (['Date', 'RegExp', 'Map', 'Set', 'Promise', 'symbol', 'bigint', 'never', 'void'].includes(type) || /^(?:Map|Set|Promise)</.test(type)) return [{ kind: 'reference' }];
  const definition = definitions.find(item => item.name === type);
  if (definition) {
    if (definition.kind === 'interface') return [{ kind: 'object' }];
    if (definition.kind === 'callable') return [{ kind: 'reference' }];
    if (visited.has(type)) return [{ kind: 'unknown' }];
    visited.add(type);
    return resolve(typeText(definition.body || definition.type), definitions, visited);
  }
  return [{ kind: 'unknown', name: type }];
}

/** The choices of a literal editor are actual JS values, not their labels. */
export function propertyEditor(component = {}, prop = {}, value) {
  const type = typeText(prop.type), definitions = component.dataTypes || [];
  if (component.tag === 'md-meter' && prop.name === 'formatOptions') return {
    kind: 'json', type, optional: true, schema: [{ kind: 'object' }],
    validate: normalizeMeterFormatOptions,
    note: 'Leave blank for a localized percentage of the range. {} formats the raw clamped number. Supports Intl number, currency and unit options; locale uses the separate locale property.',
  };
  const callable = (component.callableProps || []).some(item => item.name === prop.name);
  const schema = resolve(type, definitions);
  const optional = prop.optional === true || schema.some(item => item.kind === 'undefined');
  const nullable = schema.some(item => item.kind === 'null');
  const metadata = { type, optional, nullable, schema };
  const concrete = schema.filter(item => !['undefined', 'null'].includes(item.kind));
  if (callable || typeof value === 'function' || schema.some(item => item.kind === 'reference')) return { kind: 'readonly', ...metadata, note: 'Assign callbacks or native/browser object references in application code. This editor never evaluates JavaScript.' };
  if (concrete.length && concrete.every(item => item.kind === 'literal')) {
    const choices = [...new Set(concrete.map(item => item.value))];
    if (nullable) choices.push(null);
    return { kind: 'literal', ...metadata, choices, ...(optional ? { note: 'An unset value is also allowed.' } : {}) };
  }
  if (!concrete.length && nullable) return { kind: 'literal', ...metadata, choices: [null] };
  if (concrete.length && concrete.every(item => item.kind === 'number')) return { kind: 'number', ...metadata, note: optional ? 'Leave blank to unset this value.' : nullable ? 'Leave blank to use null.' : 'Enter a finite number.' };
  if (concrete.length && concrete.every(item => item.kind === 'boolean') && !nullable) return { kind: 'boolean', ...metadata, ...(optional ? { note: 'Use Unset to omit this optional value.' } : {}) };
  if (concrete.length && concrete.every(item => item.kind === 'string' || item.kind === 'literal' && typeof item.value === 'string') && !nullable) return { kind: 'text', ...metadata, ...(optional ? { note: 'An empty string is a value; use Unset to omit it.' } : {}) };
  if (schema.some(item => ['array', 'object'].includes(item.kind)) || concrete.length > 1 || nullable) return { kind: 'json', ...metadata, note: 'Enter JSON; quote string values. Leave blank to unset. Array/object shape is checked, but nested interface fields follow the source documentation.' };
  // An unresolved named alias is not silently interpreted as an enum or a
  // function. Existing primitive values can still be edited as that primitive.
  if (typeof value === 'string') return { kind: 'text', ...metadata, note: `The definition of ${type || 'this type'} is unavailable; editing the existing string value.` };
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'number', ...metadata, note: `The definition of ${type || 'this type'} is unavailable; editing the existing numeric value.` };
  if (typeof value === 'boolean') return { kind: 'boolean', ...metadata, note: `The definition of ${type || 'this type'} is unavailable; editing the existing boolean value.` };
  if (value && typeof value === 'object') return { kind: 'json', ...metadata, note: 'Type metadata is incomplete. Enter JSON matching the documented value; leave blank to unset.' };
  return { kind: 'readonly', ...metadata, note: 'This type is not sufficiently described to edit safely. Consult its source declaration and assign it in application code.' };
}

function finiteJSON(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteJSON);
  if (value && typeof value === 'object') return Object.values(value).every(finiteJSON);
  return true;
}

function matches(value, schema) {
  return schema.some(item => {
    if (item.kind === 'unknown') return true;
    if (item.kind === 'literal') return Object.is(item.value, value);
    if (item.kind === 'null') return value === null;
    if (item.kind === 'undefined') return value === undefined;
    if (item.kind === 'array') return Array.isArray(value) && (!item.items || value.every(child => matches(child, item.items)));
    if (item.kind === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    return typeof value === item.kind;
  });
}

/** Literal selects should pass JSON.stringify(choice), preserving mixed types. */
export function parsePropertyInput(editor, raw, checked) {
  if (editor.kind === 'readonly') throw new Error(editor.note || 'This property must be assigned in application code.');
  if (editor.kind === 'boolean') return Boolean(checked);
  const text = String(raw ?? ''), trimmed = text.trim();
  if (editor.kind === 'text') return text;
  if (editor.kind === 'number') {
    if (!trimmed) {
      if (editor.optional) return undefined;
      if (editor.nullable) return null;
      throw new Error('Enter a number; this property does not allow an empty value.');
    }
    if (!numberPattern.test(trimmed) || !Number.isFinite(Number(trimmed))) throw new Error('Enter a finite number, for example 12 or 0.5.');
    return Number(trimmed);
  }
  if (editor.kind === 'literal') {
    if (!trimmed && editor.optional) return undefined;
    let candidate;
    try { candidate = JSON.parse(text); } catch { candidate = text; }
    if (!editor.choices?.some(choice => Object.is(choice, candidate))) throw new Error('Choose one of the declared values.');
    return candidate;
  }
  if (editor.kind === 'json') {
    if (!trimmed) return undefined;
    let value;
    try { value = JSON.parse(text); } catch { throw new Error('Enter valid JSON. Quote text values; use arrays or objects for structured data.'); }
    if (!finiteJSON(value)) throw new Error('JSON numbers must be finite.');
    if (editor.schema && !matches(value, editor.schema)) throw new Error(`The JSON value does not match ${editor.type || 'the declared property type'}.`);
    return editor.validate ? editor.validate(value) : value;
  }
  throw new Error('Unsupported property editor.');
}
