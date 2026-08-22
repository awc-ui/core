import { newSpecPage } from '@stencil/core/testing';
import { MdMeter } from './md-meter';

async function create(html: string) {
  return newSpecPage({ components: [MdMeter], html });
}

/** Locale-independent expected strings — the spec must not assume en-US. */
const pct = (fraction: number, locale?: string) =>
  new Intl.NumberFormat(locale || undefined, { style: 'percent' }).format(fraction);

describe('md-meter', () => {
  // ── Rendering ────────────────────────────────────────────
  describe('rendering', () => {
    it('renders host class, track and indicator', async () => {
      const page = await create('<md-meter></md-meter>');
      expect(page.root).toHaveClass('md-meter');
      expect(page.root?.shadowRoot?.querySelector('[part="track"]')).not.toBeNull();
      expect(page.root?.shadowRoot?.querySelector('[part="indicator"]')).not.toBeNull();
    });

    it('renders no header by default', async () => {
      const page = await create('<md-meter label="Storage"></md-meter>');
      expect(page.root?.shadowRoot?.querySelector('.md-meter__header')).toBeNull();
      expect(page.root).not.toHaveClass('md-meter--with-header');
    });

    it('show-label renders the header with the label text', async () => {
      const page = await create('<md-meter label="Storage used" show-label></md-meter>');
      expect(page.root).toHaveClass('md-meter--with-header');
      const label = page.root?.shadowRoot?.querySelector('[part="label"]');
      expect(label?.textContent).toBe('Storage used');
      expect(page.root?.shadowRoot?.querySelector('[part="value"]')).toBeNull();
    });

    it('show-value renders the formatted value in the header', async () => {
      const page = await create('<md-meter value="25" show-value></md-meter>');
      expect(page.root).toHaveClass('md-meter--with-header');
      const value = page.root?.shadowRoot?.querySelector('[part="value"]');
      expect(value?.textContent).toBe(pct(0.25));
      expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeNull();
    });

    it('internal DOM is aria-hidden (host carries the semantics)', async () => {
      const page = await create('<md-meter label="Quota" show-label show-value></md-meter>');
      const header = page.root?.shadowRoot?.querySelector('.md-meter__header');
      const track = page.root?.shadowRoot?.querySelector('[part="track"]');
      expect(header?.getAttribute('aria-hidden')).toBe('true');
      expect(track?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // ── ARIA contract ────────────────────────────────────────
  describe('accessibility (ARIA value contract)', () => {
    it('exposes role=meter with the default range', async () => {
      const page = await create('<md-meter></md-meter>');
      expect(page.root?.getAttribute('role')).toBe('meter');
      expect(page.root?.getAttribute('aria-valuemin')).toBe('0');
      expect(page.root?.getAttribute('aria-valuemax')).toBe('100');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('0');
      expect(page.root?.getAttribute('aria-valuetext')).toBe(pct(0));
    });

    it('reports the raw value and the percent-formatted valuetext', async () => {
      const page = await create('<md-meter value="24"></md-meter>');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('24');
      expect(page.root?.getAttribute('aria-valuetext')).toBe(pct(0.24));
    });

    it('clamps value above max', async () => {
      const page = await create('<md-meter value="150"></md-meter>');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('100');
      expect(page.root?.getAttribute('aria-valuetext')).toBe(pct(1));
    });

    it('clamps value below min', async () => {
      const page = await create('<md-meter value="-5"></md-meter>');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('0');
      expect(page.root?.getAttribute('aria-valuetext')).toBe(pct(0));
    });

    it('non-zero min shifts the percentage (position in range, not raw value)', async () => {
      const page = await create('<md-meter min="100" max="200" value="150"></md-meter>');
      expect(page.root?.getAttribute('aria-valuemin')).toBe('100');
      expect(page.root?.getAttribute('aria-valuemax')).toBe('200');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('150');
      expect(page.root?.getAttribute('aria-valuetext')).toBe(pct(0.5));
    });

    it('collapses an empty range (max === min) to 0%', async () => {
      const page = await create('<md-meter min="10" max="10" value="10"></md-meter>');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('10');
      expect(page.root?.getAttribute('aria-valuetext')).toBe(pct(0));
    });

    it('sanitizes an inverted range (max < min) instead of emitting invalid ARIA', async () => {
      const page = await create('<md-meter min="50" max="10" value="30"></md-meter>');
      // max collapses up to min → empty range, value clamps to min.
      expect(page.root?.getAttribute('aria-valuemin')).toBe('50');
      expect(page.root?.getAttribute('aria-valuemax')).toBe('50');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('50');
    });

    it('label maps to aria-label; absent when empty', async () => {
      const withLabel = await create('<md-meter label="Battery"></md-meter>');
      expect(withLabel.root?.getAttribute('aria-label')).toBe('Battery');
      const without = await create('<md-meter></md-meter>');
      expect(without.root?.hasAttribute('aria-label')).toBe(false);
    });
  });

  // ── Formatting ───────────────────────────────────────────
  describe('formatting', () => {
    it('formatOptions formats the CLAMPED value instead of the percentage', async () => {
      const page = await create('<md-meter value="256" max="512"></md-meter>');
      (page.root as unknown as MdMeter).formatOptions = { style: 'unit', unit: 'gigabyte' };
      await page.waitForChanges();
      const expected = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'gigabyte' }).format(256);
      expect(page.root?.getAttribute('aria-valuetext')).toBe(expected);
    });

    it('locale drives Intl output', async () => {
      const page = await create('<md-meter value="50" locale="de-DE"></md-meter>');
      expect(page.root?.getAttribute('aria-valuetext')).toBe(pct(0.5, 'de-DE'));
    });

    it('value-text overrides aria-valuetext and the visible value', async () => {
      const page = await create('<md-meter value="3" max="10" value-text="3 of 10 seats" show-value></md-meter>');
      expect(page.root?.getAttribute('aria-valuetext')).toBe('3 of 10 seats');
      const value = page.root?.shadowRoot?.querySelector('[part="value"]');
      expect(value?.textContent).toBe('3 of 10 seats');
    });

    it('invalid formatOptions degrade to the raw clamped value, not a crash', async () => {
      const page = await create('<md-meter value="40"></md-meter>');
      // currency style without a currency code makes Intl.NumberFormat throw.
      (page.root as unknown as MdMeter).formatOptions = { style: 'currency' } as Intl.NumberFormatOptions;
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-valuetext')).toBe('40');
    });
  });

  // ── Fill geometry ────────────────────────────────────────
  describe('fill width variable', () => {
    it('writes the percentage onto --_fill-pct', async () => {
      const page = await create('<md-meter value="25"></md-meter>');
      const indicator = page.root?.shadowRoot?.querySelector('[part="indicator"]') as HTMLElement;
      expect(indicator.style.getPropertyValue('--_fill-pct')).toBe('25%');
    });

    it('clamps the fill to 100%', async () => {
      const page = await create('<md-meter value="200"></md-meter>');
      const indicator = page.root?.shadowRoot?.querySelector('[part="indicator"]') as HTMLElement;
      expect(indicator.style.getPropertyValue('--_fill-pct')).toBe('100%');
    });

    it('updates when value changes', async () => {
      const page = await create('<md-meter value="25"></md-meter>');
      (page.root as unknown as MdMeter).value = 75;
      await page.waitForChanges();
      const indicator = page.root?.shadowRoot?.querySelector('[part="indicator"]') as HTMLElement;
      expect(indicator.style.getPropertyValue('--_fill-pct')).toBe('75%');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('75');
    });
  });

  // ── Color ────────────────────────────────────────────────
  describe('color prop', () => {
    it('default (primary) sets no inline colour slots — CSS neutral defaults apply', async () => {
      const page = await create('<md-meter></md-meter>');
      expect(page.root?.style.getPropertyValue('--_c-main')).toBe('');
      expect(page.root?.style.getPropertyValue('--_c-container')).toBe('');
    });

    it('a role maps onto the two colour slots with neutral fallbacks', async () => {
      const page = await create('<md-meter color="success"></md-meter>');
      expect(page.root?.style.getPropertyValue('--_c-main')).toBe(
        'var(--md-sys-color-success, var(--md-sys-color-primary))',
      );
      expect(page.root?.style.getPropertyValue('--_c-container')).toBe(
        'var(--md-sys-color-success-container, var(--md-sys-color-secondary-container))',
      );
    });

    it('reflects the color attribute', async () => {
      const page = await create('<md-meter color="warning"></md-meter>');
      expect(page.root?.getAttribute('color')).toBe('warning');
    });

    it('rejects anything that is not a plain CSS ident', async () => {
      const page = await create('<md-meter color="url(https://evil.example)"></md-meter>');
      expect(page.root?.style.getPropertyValue('--_c-main')).toBe('');
      expect(page.root?.style.getPropertyValue('--_c-container')).toBe('');
    });
  });

  // ── Thickness ────────────────────────────────────────────
  describe('thickness', () => {
    it('default 4px sets no inline override (pure CSS resting look)', async () => {
      const page = await create('<md-meter></md-meter>');
      expect(page.root?.style.getPropertyValue('--_thickness')).toBe('');
    });

    it('non-default thickness re-declares --_thickness with the public hook and density taper', async () => {
      const page = await create('<md-meter thickness="8"></md-meter>');
      const v = page.root?.style.getPropertyValue('--_thickness') ?? '';
      expect(v).toContain('var(--md-meter-height,');
      expect(v).toContain('8px');
      expect(v).toContain('var(--md-sys-density-scale, 0)');
    });

    it('clears the override when thickness returns to 4', async () => {
      const page = await create('<md-meter thickness="8"></md-meter>');
      (page.root as unknown as MdMeter).thickness = 4;
      await page.waitForChanges();
      expect(page.root?.style.getPropertyValue('--_thickness')).toBe('');
    });
  });

  // ── Density ──────────────────────────────────────────────
  describe('density', () => {
    it('reflects the density rung attribute for the token-layer selector', async () => {
      const page = await create('<md-meter density="-2"></md-meter>');
      expect(page.root?.getAttribute('density')).toBe('-2');
    });
  });

  // ── RTL ──────────────────────────────────────────────────
  describe('RTL', () => {
    it('renders the same DOM under dir="rtl" (geometry is logical-property based)', async () => {
      const page = await newSpecPage({
        components: [MdMeter],
        html: '<div dir="rtl"><md-meter value="25" label="مساحة التخزين" show-label show-value></md-meter></div>',
      });
      const meter = page.body.querySelector('md-meter');
      expect(meter?.getAttribute('role')).toBe('meter');
      expect(meter?.getAttribute('aria-valuenow')).toBe('25');
      const indicator = meter?.shadowRoot?.querySelector('[part="indicator"]') as HTMLElement;
      expect(indicator.style.getPropertyValue('--_fill-pct')).toBe('25%');
    });
  });

  // ── Parts ────────────────────────────────────────────────
  describe('parts', () => {
    it('exposes track, indicator, label and value parts', async () => {
      const page = await create('<md-meter label="Quota" show-label show-value></md-meter>');
      for (const part of ['track', 'indicator', 'label', 'value']) {
        expect(page.root?.shadowRoot?.querySelector(`[part="${part}"]`)).not.toBeNull();
      }
    });
  });

  // ── Circular variant ─────────────────────────────────────
  describe('circular variant', () => {
    it('swaps the bar for a ring without touching the ARIA contract', async () => {
      const page = await create('<md-meter variant="circular" value="40"></md-meter>');
      const sr = page.root?.shadowRoot;
      expect(sr?.querySelector('.md-meter__ring')).not.toBeNull();
      // The bar's DOM must be gone, not merely hidden — two tracks would mean
      // two elements carrying part="track".
      expect(sr?.querySelector('.md-meter__track')).toBeNull();
      expect(sr?.querySelectorAll('[part="track"]').length).toBe(1);
      expect(page.root?.getAttribute('role')).toBe('meter');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('40');
      expect(page.root?.getAttribute('aria-valuetext')).toBe(pct(0.4));
    });

    it('draws the value as a dash offset of 1 - fraction on a normalised path', async () => {
      const page = await create('<md-meter variant="circular" value="25"></md-meter>');
      const arc = page.root?.shadowRoot?.querySelector('.md-meter__ring-indicator');
      expect(arc?.getAttribute('pathLength')).toBe('1');
      expect(arc?.getAttribute('stroke-dasharray')).toBe('1 1');
      expect(arc?.getAttribute('stroke-dashoffset')).toBe('0.75');
    });

    it('starts the fill at twelve o\'clock', async () => {
      const page = await create('<md-meter variant="circular" value="50" size="48"></md-meter>');
      const arc = page.root?.shadowRoot?.querySelector('.md-meter__ring-indicator');
      expect(arc?.getAttribute('transform')).toBe('rotate(-90 24 24)');
    });

    it('clamps size into the 24-240px band and insets the radius by half the stroke', async () => {
      const tiny = await create('<md-meter variant="circular" size="4" thickness="4"></md-meter>');
      expect(tiny.root?.shadowRoot?.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');

      const huge = await create('<md-meter variant="circular" size="9000"></md-meter>');
      expect(huge.root?.shadowRoot?.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 240 240');

      const normal = await create('<md-meter variant="circular" size="72" thickness="8"></md-meter>');
      const arc = normal.root?.shadowRoot?.querySelector('.md-meter__ring-indicator');
      expect(arc?.getAttribute('r')).toBe('32'); // (72 - 8) / 2
      expect(arc?.getAttribute('stroke-width')).toBe('8');
    });

    it('puts the value in the middle and the label underneath, not in a header row', async () => {
      const page = await create(
        '<md-meter variant="circular" value="60" label="Storage" show-label show-value></md-meter>',
      );
      const sr = page.root?.shadowRoot;
      expect(sr?.querySelector('.md-meter__header')).toBeNull();
      expect(sr?.querySelector('.md-meter__center')?.textContent).toBe(pct(0.6));
      expect(sr?.querySelector('.md-meter__caption')?.textContent).toBe('Storage');
      expect(page.root?.className).not.toContain('md-meter--with-header');
    });

    it('hides the arc entirely at zero so a round cap cannot leave a dot', async () => {
      const page = await create('<md-meter variant="circular" value="0"></md-meter>');
      const arc = page.root?.shadowRoot?.querySelector('.md-meter__ring-indicator') as HTMLElement;
      expect(arc?.style.opacity).toBe('0');
      expect(arc?.getAttribute('stroke-dashoffset')).toBe('1');
    });

    it('inlines --_size only when size deviates from the 48px default', async () => {
      const dflt = await create('<md-meter variant="circular"></md-meter>');
      expect(dflt.root?.getAttribute('style') ?? '').not.toContain('--_size');

      const custom = await create('<md-meter variant="circular" size="120"></md-meter>');
      expect(custom.root?.getAttribute('style') ?? '').toContain('--md-meter-size');
    });

    it('ignores size on the linear variant', async () => {
      const page = await create('<md-meter size="120" value="10"></md-meter>');
      expect(page.root?.getAttribute('style') ?? '').not.toContain('--_size');
      expect(page.root?.shadowRoot?.querySelector('.md-meter__track')).not.toBeNull();
    });
  });

  // ── Custom CSS API ───────────────────────────────────────
  describe('custom CSS API', () => {
    it('authored custom-property overrides pass through on the host', async () => {
      const page = await create(
        '<md-meter style="--md-meter-indicator-color: rebeccapurple; --md-meter-height: 10px;"></md-meter>',
      );
      const style = page.root?.getAttribute('style') ?? '';
      expect(style).toContain('--md-meter-indicator-color: rebeccapurple');
      expect(style).toContain('--md-meter-height: 10px');
    });
  });
});
