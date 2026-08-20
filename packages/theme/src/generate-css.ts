import { tokenName } from './token-name';
import type { ThemeComputeResult } from './types';

/** Format a computed theme as a drop-in CSS file overriding @awc-ui/tokens defaults. */
export function generateCss(result: ThemeComputeResult): string {
  const now = new Date().toISOString();
  const { sources, roles } = result;
  const lines: string[] = [
    '/*!',
    ' * AWC UI — Material Design 3 theme',
    ` * Generated: ${now}`,
    ' * Source colors:',
    `   primary:   ${sources.primary}`,
    `   secondary: ${sources.secondary}`,
    `   tertiary:  ${sources.tertiary}`,
    ' *',
    ' * Drop this file after @awc-ui/tokens to override the default theme.',
    ' * Toggle dark mode by setting [data-theme="dark"] on <html> or any ancestor.',
    ' */',
    '',
    ':root {',
  ];

  for (const [role, hex] of Object.entries(roles.light)) {
    lines.push(`  --md-sys-color-${tokenName(role)}: ${hex};`);
  }

  lines.push('}', '', '[data-theme="dark"] {');

  for (const [role, hex] of Object.entries(roles.dark)) {
    lines.push(`  --md-sys-color-${tokenName(role)}: ${hex};`);
  }

  lines.push('}', '');
  return lines.join('\n');
}
