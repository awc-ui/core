import { readFileSync } from 'fs';
import { resolve } from 'path';
import { newE2EPage } from '@stencil/core/testing';

const tokens = readFileSync(resolve(__dirname, '../../../../tokens/src/tokens.css'), 'utf8');

describe('md-skeleton surface visibility', () => {
  it.each(['light', 'dark'])('remains visible on Core surfaces in the %s theme', async (theme) => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(`<style>${tokens}</style><div data-theme="${theme}" dir="rtl" data-density="-2">
      ${['elevated', 'filled', 'outlined'].map((variant) => `<md-card variant="${variant}">
        <md-skeleton animation="none" lines="2" announce="false"></md-skeleton>
      </md-card>`).join('')}
      ${['surface', 'surface-container', 'surface-container-high', 'surface-bright'].map((surface) => `<div class="surface" style="background:var(--md-sys-color-${surface});padding:16px">
        <md-skeleton animation="none" variant="rounded" height="24px" announce="false"></md-skeleton>
      </div>`).join('')}
    </div>`);
    const samples = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const luminance = (rgba: Uint8ClampedArray) => {
        const channels = Array.from(rgba).slice(0, 3).map((value) => {
          const c = value / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      return Array.from(document.querySelectorAll('md-skeleton')).map((host) => {
        const shape = host.shadowRoot!.querySelector('[part="shape"], [part="line"]')!;
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = getComputedStyle(host.parentElement!).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const surface = luminance(context.getImageData(0, 0, 1, 1).data);
        context.fillStyle = getComputedStyle(shape).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const fill = luminance(context.getImageData(0, 0, 1, 1).data);
        return {
          contrast: (Math.max(fill, surface) + 0.05) / (Math.min(fill, surface) + 0.05),
          width: shape.getBoundingClientRect().width,
          hidden: host.getAttribute('aria-hidden'),
        };
      });
    });
    expect(samples).toHaveLength(7);
    for (const sample of samples) {
      // Decorative placeholders need a visible tonal difference, not text-level
      // contrast. The old filled-card default produced exactly 1:1 here.
      expect(sample.contrast).toBeGreaterThan(1.2);
      expect(sample.width).toBeGreaterThan(0);
      expect(sample.hidden).toBe('true');
    }
    await page.$eval('md-skeleton', (host: HTMLElement) => host.style.setProperty('--md-skeleton-color', 'rgb(40, 90, 150)'));
    expect(await page.$eval('md-skeleton', (host) => getComputedStyle(host.shadowRoot!.querySelector('[part="line"]')!).backgroundColor))
      .toBe('rgb(40, 90, 150)');
  });
});
