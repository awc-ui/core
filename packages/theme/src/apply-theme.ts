import { generateCss } from './generate-css';
import { tokenName } from './token-name';
import { ROLE_KEYS, type RoleMap, type ThemeComputeResult } from './types';

/** Apply generated MD3 color role tokens as inline CSS custom properties on an element. */
export function applyThemeRoles(element: HTMLElement, roles: RoleMap): void {
  for (const [role, hex] of Object.entries(roles)) {
    element.style.setProperty(`--md-sys-color-${tokenName(role)}`, hex);
  }
}

/** Remove inline MD3 color role overrides so stylesheet / data-theme tokens can apply. */
export function clearThemeRoles(element: HTMLElement): void {
  for (const role of ROLE_KEYS) {
    element.style.removeProperty(`--md-sys-color-${tokenName(role)}`);
  }
}

/**
 * Inject or update a stylesheet with light (:root) and dark ([data-theme="dark"]) role tokens.
 *
 * Charts pick this up automatically: they watch `document.head` for the
 * `<style>` this appends and for later rewrites of its content, so a seed or
 * accent swap repaints every canvas on the page. The one path no browser API
 * can observe is a sheet applied through `document.adoptedStyleSheets` or
 * edited via CSSOM `insertRule` — if you theme that way with charts on
 * screen, call each chart's `refreshTheme()` afterwards.
 */
export function applyThemeStylesheet(
  theme: ThemeComputeResult,
  styleId = 'awc-ui-dynamic-theme',
): void {
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = generateCss(theme);
}
