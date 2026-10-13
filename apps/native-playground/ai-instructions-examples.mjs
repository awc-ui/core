import { nativeApiExample, nativeUsageExample, nativeThemeExample } from './native-api-examples.js';

const nameOf = value => typeof value === 'string' ? value : value?.name;
const code = value => '`' + String(value || '(default)').replaceAll('`', '\\`').replaceAll('|', '\\|').replaceAll('\n', ' ') + '`';
const fence = result => result.code ? '```' + result.language + '\n' + result.code + '\n```' : '';
const prepared = (component, policy, platform) => ({ ...component, support: { ...component.support, [platform === 'swift' ? 'ios' : 'android']: policy } });
const notes = result => result.notes.map(note => `- ${note}`).join('\n');

/** The same verified recipes power Laboratory API tabs and downloaded guides. */
export function nativeGuideOverview(component, policy, platform) {
  const result = nativeUsageExample(prepared(component, policy, platform), platform);
  return [`### Working ${platform === 'swift' ? 'SwiftUI' : 'Compose'} example`, result.description, fence(result), notes(result), 'This standalone recipe uses supported native properties, concrete data and native child composition. Replace the sample values with application data. Each code block is independent; use distinct view/function names when combining examples.'].filter(Boolean).join('\n\n');
}

export function nativeGuideRecipes(component, policy, platform) {
  const native = prepared(component, policy, platform);
  const sections = ['### Per-member native recipes', 'These recipes use the public native adapter API. A source method may have a declarative alternative while its imperative signature remains unavailable. Source DOM payloads, return values and CSS selectors are not silently treated as native APIs.'];
  for (const [kind, collection, title] of [['event', 'events', 'Event'], ['slot', 'slots', 'Slot'], ['method', 'methods', 'Method']]) {
    const names = [...new Set([...(component[collection] ?? []).map(nameOf), ...(policy[collection] ?? []).map(nameOf)].filter(name => typeof name === 'string'))];
    if (!names.length) continue;
    const results = names.map(name => ({ name, example: nativeApiExample(native, kind, name, platform) }));
    sections.push(`#### ${title} coverage`, '| Member | Native recipe | Behavior |\n| --- | --- | --- |\n' + results.map(({ name, example }) => `| ${code(name)} | ${example.status} | ${example.description.replaceAll('|', '\\|').replaceAll('\n', ' ')} |`).join('\n'));
    for (const { name, example } of results) {
      if (!example.code) continue;
      sections.push(`#### ${title}: ${code(name)}`, example.description, fence(example), notes(example));
    }
  }
  const theme = nativeThemeExample(native, platform);
  sections.push('### Native theme recipe', theme.description, fence(theme), notes(theme));
  return sections.filter(Boolean).join('\n\n');
}
