import { newE2EPage } from '@stencil/core/testing';

/**
 * A submenu row sits in the same column as its md-menu-item siblings, so its
 * box model has to track theirs: row height, inline padding, the gap between
 * regions and the leading-icon size — per variant (standard / vibrant tighten
 * icons to 20px and the gap to 8px) and per density rung. Otherwise the
 * leading icon and the headline of the submenu row drift off the column.
 * (The row deliberately reads no `--md-menu-item-*` hooks — see its readme.)
 */
const ICON = '<span slot="leading-icon" style="font-family:monospace">*</span>';
const menu = (variant: string, attrs = '') => `
  <md-menu variant="${variant}" ${attrs}>
    <md-menu-item id="item" headline="Copy">${ICON}</md-menu-item>
    <md-sub-menu-item id="row" headline="Share">${ICON}<md-menu slot="submenu"><md-menu-item headline="Email"></md-menu-item></md-menu></md-sub-menu-item>
  </md-menu>`;

const metrics = (page: any) => page.evaluate(() => {
  const m = (id: string) => {
    const host = document.getElementById(id)!;
    const r = host.getBoundingClientRect();
    const cs = getComputedStyle(host);
    const icon = host.shadowRoot!.querySelector('[part="leading-icon"]')!.getBoundingClientRect();
    const headline = host.shadowRoot!.querySelector('[part="headline"]')!.getBoundingClientRect();
    // offsetHeight: a closed menu's surface is scaled, so the rect height is not the row height.
    return { height: host.offsetHeight, padding: cs.paddingInlineStart, gap: cs.columnGap, icon: icon.width, headlineX: headline.left - r.left };
  };
  return { item: m('item'), row: m('row') };
});

describe('md-sub-menu-item stays on its siblings\' column', () => {
  for (const variant of ['baseline', 'standard', 'vibrant']) {
    for (const density of [0, -4]) {
      it(`${variant} at density ${density}`, async () => {
        const page = await newE2EPage();
        await page.setContent(menu(variant, density ? `density="${density}"` : ''));
        const { item, row } = await metrics(page);
        expect(row).toEqual(item);
      });
    }
  }
});
