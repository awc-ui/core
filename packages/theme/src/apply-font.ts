import { TYPESCALE_SLOTS } from './types';

const GOOGLE_FONT_FAMILIES = new Set([
  'Roboto',
  'Inter',
  'Open Sans',
  'Lato',
  'Poppins',
  'Nunito',
  'Montserrat',
  'Source Sans 3',
]);

function fontStack(fontFamily: string): string {
  const trimmed = fontFamily.trim();
  if (!trimmed) return 'Roboto, sans-serif';
  return trimmed.includes(',') ? trimmed : `${trimmed}, sans-serif`;
}

/** Set all 15 --md-sys-typescale-*-font-family tokens on an element. */
export function applyFontFamily(element: HTMLElement, fontFamily: string): void {
  const stack = fontStack(fontFamily);
  for (const slot of TYPESCALE_SLOTS) {
    element.style.setProperty(`--md-sys-typescale-${slot}-font-family`, stack);
  }
}

/**
 * Inject or update a Google Fonts stylesheet for common font choices.
 * Custom font family strings are applied via CSS vars only (no network fetch).
 */
export function loadGoogleFont(fontFamily: string): void {
  const primary = fontFamily.split(',')[0].trim();
  if (!GOOGLE_FONT_FAMILIES.has(primary)) return;

  const id = 'awc-ui-dynamic-font';
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  const family = primary.replace(/ /g, '+');
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700&display=swap`;
}
