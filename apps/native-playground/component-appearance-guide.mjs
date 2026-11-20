import { componentAppearance } from './component-appearance.js';
import { buttonAppearanceGuide } from './button-appearance-guide.mjs';
import { usageSnippet } from './usage-snippets.js';
import { recipeFor } from './recipes.js';

export function componentAppearanceGuide(component, platform) {
  if (component.tag === 'md-button') return buttonAppearanceGuide(platform);
  const profile = componentAppearance(component.tag);
  if (!profile) return '';
  const swift = platform === 'ios';
  const recipe = recipeFor(component.tag);
  const samples = { color: '#6750A4', containerColor: '#6750A4', iconColor: '#FFFFFF', labelColor: '#FFFFFF', itemContainerColor: '#6750A4', itemLabelColor: '#FFFFFF', itemGap: 8, width: 300, height: 56, gap: 8, thickness: 2, cornerRadius: 16, iconSize: 24,
    ...(component.tag === 'md-snackbar' ? { containerColor: '#313033CC', messageColor: '#F4EFF4', actionColor: '#D0BCFF', closeColor: '#F4EFF4', containerShape: { topLeft: { x: { points: 12 }, y: { points: 6 } }, bottomRight: { x: { points: 4 }, y: { points: 4 } } }, minWidth: { points: 240 }, maxWidth: { points: -48, fraction: 1 } } : {}),
    ...(component.tag === 'md-skeleton' ? { color: '#12345680', highlight: '#FEDCBA80', radius: { topLeft: { x: { points: 10 }, y: { points: 20 } } }, roundedRadius: { topLeft: { x: { points: 2 }, y: { points: 2 } }, topRight: { x: { points: 12 }, y: { points: 12 } } }, width: { points: -32, fraction: 1 }, height: { em: 1.5 }, size: { points: 64 }, lineGap: { points: 11 }, pulseDuration: 1.3, waveDuration: 1.7, bloomDuration: 0.8 } : {}),
    ...(component.tag === 'md-progress-indicator' ? { activeIndicatorColor: '#006A6A80', activeIndicatorShape: { topLeft: { x: { points: 4 }, y: { points: 2 } } }, trackColor: '#D0E8E5', trackShape: { topLeft: { x: { fraction: 0.5 }, y: { fraction: 0.5 } } }, stopIndicatorColor: '#4F378B', stopIndicatorShape: { topLeft: { x: { points: 2 }, y: { points: 2 } } }, stopIndicatorSize: 6, stopIndicatorTrailingSpace: -2, trackActiveIndicatorSpace: 6, fourColor1: '#6750A4', fourColor2: '#006A6A', fourColor3: '#B3261E', fourColor4: '#805600' } : {}),
    ...(component.tag === 'md-meter' ? { indicatorColor: '#006A6A80', trackColor: '#D0E8E5', trackShape: { topLeft: { x: { fraction: 0.5 }, y: { points: 4 } }, topRight: { x: { points: 8 }, y: { points: 2 } } }, height: 8, labelColor: '#173B36', valueColor: '#4F378B', size: 72 } : {}),
    ...(component.tag === 'md-split-button' ? { outlineColor: '#006A6A' } : {}),
    ...(component.tag === 'md-date-picker' ? { iconSize: '20px' } : {}),
    ...(component.tag === 'md-loading-indicator' ? { color: '#6750A480', size: 64, shapeSize: 42, containerColor: '#EADDFF', containerShape: { topLeft: { x: { points: 4 }, y: { points: 12 } }, topRight: { x: { fraction: 0.25 }, y: { fraction: 0.5 } } } } : {}),
    ...(component.tag === 'md-status-dot' ? { size: 16, color: '#2DC653', pulseColor: '#2DC65380', outlineColor: '#FFFFFF', outlineWidth: 2, insetEnd: { points: -2, fraction: 0.1 }, insetBlockEnd: { points: -2, fraction: 0.1 }, pulseDuration: 1.6 } : {}),
    ...(component.tag === 'md-badge' ? { cornerRadius: 6, iconSize: 12, offsetX: { points: 2, fraction: 0.5 }, offsetY: { points: -2, fraction: -0.5 }, largeHeight: 20, largePadding: [0, 6, 0, 6], smallSize: 8 } : {}) };
  // Affine length fields (card and sheet sizes) take a length object, not a bare number.
  const sample = field => field.kind === 'affine' && typeof samples[field.name] === 'number' ? { points: samples[field.name] } : samples[field.name];
  const appearance = Object.fromEntries(profile.fields.filter(field => Object.hasOwn(samples, field.name)).map(field => [field.name, sample(field)]));
  const example = usageSnippet(component, recipe.props, swift ? 'swift' : 'android', { html: recipe.html, [profile.key]: appearance });
  return [
    `### Shared appearance on ${swift ? 'iOS / SwiftUI' : 'Android / Compose'}`,
    `Use \`${profile.nativeType}\` through ${swift ? `\`.${profile.swiftModifier}(...)\`` : `\`${profile.nativeType}Scope\``}. Scopes inherit field by field; local values override only fields supplied. The Laboratory uses these same typed values on all three platforms.`,
    '```' + (swift ? 'swift' : 'kotlin') + '\n' + example + '\n```',
    '| Field | Accepted value | Web property |\n| --- | --- | --- |\n' + profile.fields.map(field =>
      `| \`${field.name}\` | ${field.kind === 'color' ? field.hint || '`#RRGGBB`' : field.hint || `${field.min}–${field.max}`} | \`${field.cssPart ? `::part(${field.cssPart.part}) { ${field.cssPart.property} }` : field.cssProperty}\` |`).join('\n'),
    profile.note,
    component.tag === 'md-snackbar'
      ? 'AWCSnackbarLength preserves absolute, parent-relative and font-relative terms. Native dimensions accept px, %, em, rem, ch and additive calc(); unsupported CSS grammar is reported explicitly. Width constraints resolve against the actual overlay and font context, rather than a hard-coded preview size.'
      : component.tag === 'md-skeleton'
      ? 'Skeleton lengths retain absolute, parent-relative and font-relative terms. Native width/height properties accept px, %, em, rem, ch and additive calc(); unsupported CSS grammar is reported. The copyable example supplies a definite 260×160 parent with a 16-unit font context. Platform font metrics and rasterization can differ.'
      : 'Lengths use CSS px, SwiftUI points and Compose dp. Native drawing does not interpret CSS expressions or selectors. Named slots accept authored native children; supplied Material Symbols inherit the icon metrics. Platform rasterization can differ.',
  ].join('\n\n');
}
