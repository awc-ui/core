import { newE2EPage } from '@stencil/core/testing';

/**
 * Library-wide contract: `el.hidden = true` must actually hide the element.
 *
 * Every component declares `display` on `:host`. That is an AUTHOR-origin
 * rule, and the browser's `[hidden] { display: none }` is UA-origin — author
 * beats UA, so a `:host` display silently defeats the `hidden` attribute
 * unless the stylesheet also carries a `:host([hidden])` guard. 80 of 81
 * components were missing it, which meant `hidden` was a no-op almost
 * everywhere: a docs demo hiding skeleton placeholders left them stacked
 * above the real content, and an "empty state" toggled with `hidden` sat in
 * a flex column eating half the pane.
 *
 * This test samples across display modes (block, flex, inline-flex,
 * inline-block, contents) rather than all 81 tags — a missing guard is a
 * per-file omission, and the sample covers each shape a regression could
 * take.
 */
const SAMPLE = [
  'md-skeleton',
  'md-button',
  'md-card',
  'md-list',
  'md-list-item',
  'md-chip',
  'md-avatar',
  'md-badge',
  'md-divider',
  'md-status-dot',
  'md-text-field',
  'md-checkbox',
  'md-step',
  'md-meter',
  'md-tabs',
];

describe('hidden attribute · every component honours it', () => {
  it('sets display: none on the host when hidden', async () => {
    const page = await newE2EPage();
    await page.setContent(
      SAMPLE.map((tag, i) => `<${tag} id="h${i}" hidden></${tag}>`).join('') +
        SAMPLE.map((tag, i) => `<${tag} id="v${i}"></${tag}>`).join(''),
    );
    await page.waitForChanges();

    const result = await page.evaluate((tags: string[]) => {
      const out: Record<string, { hidden: string; visible: string; rect: number }> = {};
      tags.forEach((tag, i) => {
        const h = document.getElementById(`h${i}`)!;
        const v = document.getElementById(`v${i}`)!;
        out[tag] = {
          hidden: getComputedStyle(h).display,
          visible: getComputedStyle(v).display,
          // A hidden element must also occupy no space.
          rect: Math.round(h.getBoundingClientRect().width + h.getBoundingClientRect().height),
        };
      });
      return out;
    }, SAMPLE);

    const offenders = Object.entries(result).filter(
      ([, r]) => r.hidden !== 'none' || r.rect !== 0,
    );
    expect(offenders).toEqual([]);

    // Sanity: the same tags DO render when not hidden, so the assertion above
    // cannot pass by the elements simply never upgrading.
    const notRendering = Object.entries(result).filter(([, r]) => r.visible === 'none');
    expect(notRendering).toEqual([]);
  }, 90000);
});
