const words = value => value.replace(/-/g, ' ').replace(/\bbg\b/g, 'background').replace(/^./, c => c.toUpperCase());
export const STYLE_GROUPS = ['Surface', 'Text', 'Icons & indicators', 'Layout', 'Interaction states', 'Motion', 'Other'];

/** Describe public CSS hooks without manufacturing native equivalents. */
export function styleField(tag, member, index = 0) {
  const name = member.name;
  const short = name.startsWith(`--${tag}-`) ? name.slice(tag.length + 3) : name.replace(/^--md-/, '');
  const group = /duration|easing|animation|transition/.test(short) ? 'Motion'
    : /hover|focus|pressed|disabled|selected|error|active|checked/.test(short) ? 'Interaction states'
    : /font|letter-spacing|line-height|label|headline|supporting|text|input-color|on-color/.test(short) ? 'Text'
    : /icon|loading|spinner|handle|thumb|tick|dot/.test(short) ? 'Icons & indicators'
    : /padding|margin|gap|width|height|size|inset|offset|nudge|position|columns|length/.test(short) ? 'Layout'
    : /container|surface|background|color|outline|shape|radius|shadow|elevation|track|scrim|bg/.test(short) ? 'Surface' : 'Other';
  let kind = 'css', property, example = 'CSS value';
  if (/(?:color|bg|background)$/.test(short)) { kind = 'color'; property = short.endsWith('background') ? 'background' : 'color'; example = '#6750A4'; }
  else if (/opacity$/.test(short)) { kind = 'number'; property = 'opacity'; example = '0.12'; }
  else if (/font-family$/.test(short)) { property = 'font-family'; example = 'system-ui'; }
  else if (/font-weight$/.test(short)) { property = 'font-weight'; example = '600'; }
  else if (/line-height$/.test(short)) { property = 'line-height'; example = '1.5'; }
  else if (/letter-spacing$/.test(short)) { property = 'letter-spacing'; example = '0.02em'; }
  else if (/font-size$/.test(short)) { property = 'font-size'; example = '16px'; }
  else if (/shape|radius/.test(short) && !/size$/.test(short)) { property = 'border-radius'; example = '12px'; }
  else if (/elevation|shadow/.test(short)) { property = 'box-shadow'; example = '0 2px 8px #0002'; }
  else if (/duration$/.test(short)) { property = 'transition-duration'; example = '200ms'; }
  else if (/easing$/.test(short)) { property = 'transition-timing-function'; example = 'ease-in-out'; }
  else if (/cursor$/.test(short)) { property = 'cursor'; example = 'pointer'; }
  else if (/padding/.test(short)) { property = 'padding'; example = '12px'; }
  else if (/margin|inset|offset|nudge/.test(short)) { property = 'margin'; example = '4px'; }
  else if (/gap$/.test(short)) { property = 'gap'; example = '8px'; }
  else if (/(?:max|min)-(?:width|height|block-size|inline-size)$/.test(short)) { property = short.match(/(?:max|min)-(?:width|height|block-size|inline-size)$/)[0]; example = property.startsWith('max-') ? 'none' : '24px'; }
  else if (/width|height|size|length|thickness/.test(short)) { property = 'width'; example = '24px'; }
  return { ...member, index, label: words(short), group, kind, property, example,
    search: `${name} ${words(short)} ${member.description || ''} ${group}`.toLowerCase() };
}

export function groupedStyleFields(tag, members = []) {
  const seen = new Set();
  const fields = members.filter(member => typeof member.name === 'string' && /^--[\w-]+$/.test(member.name) && !seen.has(member.name) && seen.add(member.name)).map((member, index) => styleField(tag, member, index));
  return STYLE_GROUPS.map(title => ({ title, fields: fields.filter(field => field.group === title) })).filter(group => group.fields.length);
}

/** Keep authored CSS syntax (including variables and units); reject invalid edits. */
export function parseStyleValue(field, value, supports = globalThis.CSS?.supports?.bind(globalThis.CSS)) {
  const source = String(value ?? '').trim();
  if (!source) return '';
  if (source.length > 1024 || /[{};]/.test(source)) throw new Error('Enter one CSS value, without a declaration or semicolon.');
  if (field.property && supports && !supports(field.property, source)) throw new Error(`Enter a valid ${field.property} value, for example ${field.example}.`);
  return source;
}

export function createCSSOverrideApplier() {
  const originals = new WeakMap();
  return (target, values, fallback = {}, managedNames = []) => {
    let styles = originals.get(target);
    if (!styles) { styles = new Map(); originals.set(target, styles); }
    for (const [name, value] of Object.entries(values || {})) {
      if (!styles.has(name)) styles.set(name, managedNames.includes(name) ? ['', ''] : [target.style.getPropertyValue?.(name) || '', target.style.getPropertyPriority?.(name) || '']);
      const [original, priority] = styles.get(name);
      if (value) target.style.setProperty(name, value);
      else if (Object.hasOwn(fallback, name)) target.style.setProperty(name, fallback[name]);
      else if (original) target.style.setProperty(name, original, priority);
      else target.style.removeProperty(name);
    }
  };
}
