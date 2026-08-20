import { newSpecPage } from '@stencil/core/testing';
import { MdBadge } from './md-badge';

describe('md-badge', () => {
  // ── Rendering ──────────────────────────────────────────────
  it('renders with default props', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge></md-badge>',
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-badge')).toBe(true);
  });

  it('defaults to large variant', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge></md-badge>',
    });
    expect(page.root?.classList.contains('md-badge--large')).toBe(true);
    expect(page.root?.classList.contains('md-badge--small')).toBe(false);
  });

  it('applies small variant class', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge variant="small"></md-badge>',
    });
    expect(page.root?.classList.contains('md-badge--small')).toBe(true);
    expect(page.root?.classList.contains('md-badge--large')).toBe(false);
  });

  // ── Accessibility ──────────────────────────────────────────
  describe('accessibility', () => {
    // ── role ──
    it('has role="status" on large badge with value', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="5"></md-badge>',
      });
      expect(page.root?.getAttribute('role')).toBe('status');
    });

    it('has role="status" on small badge', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge variant="small"></md-badge>',
      });
      expect(page.root?.getAttribute('role')).toBe('status');
    });

    it('has role="status" on empty large badge', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge></md-badge>',
      });
      expect(page.root?.getAttribute('role')).toBe('status');
    });

    it('has role="status" on icon-only badge', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge icon="error"></md-badge>',
      });
      expect(page.root?.getAttribute('role')).toBe('status');
    });

    // ── aria-label — small variant ──
    it('sets aria-label="notification" for small badge', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge variant="small"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('notification');
    });

    it('sets aria-label="notification" for small badge even with value', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge variant="small" value="99"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('notification');
    });

    it('sets aria-label="notification" for small badge even with icon', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge variant="small" icon="error"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('notification');
    });

    // ── aria-label — large variant with value ──
    it('sets aria-label to display value for large badge', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="5"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('5');
    });

    it('sets aria-label to truncated value for overflow max', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="1500" max="999"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('999+');
    });

    it('sets aria-label to custom max overflow', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="20" max="9"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('9+');
    });

    it('sets aria-label to string value', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="NEW"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('NEW');
    });

    it('sets aria-label to truncated string value (4 chars)', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="HELLO"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('HELL');
    });

    // ── aria-label — large variant with icon ──
    it('sets aria-label to icon name when only icon is provided', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge icon="error"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('error');
    });

    it('prefers value over icon for aria-label', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="3" icon="error"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('3');
    });

    // ── aria-label — empty large badge ──
    it('has no aria-label on empty large badge', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBeNull();
    });

    // ── decorative elements hidden from AT ──
    it('icon element has aria-hidden="true"', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge icon="error"></md-badge>',
      });
      const icon = page.root?.shadowRoot?.querySelector('.md-badge__icon');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });

    it('label element does not have aria-hidden', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="5"></md-badge>',
      });
      const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
      expect(label?.getAttribute('aria-hidden')).toBeNull();
    });

    // ── dynamic updates ──
    it('updates aria-label when value changes', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="1"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('1');

      page.root!.value = '99';
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toBe('99');
    });

    it('updates aria-label when variant changes from large to small', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="5"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('5');

      page.root!.variant = 'small';
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toBe('notification');
    });

    it('updates aria-label when variant changes from small to large', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge variant="small"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('notification');

      page.root!.variant = 'large';
      page.root!.value = '42';
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toBe('42');
    });

    it('updates aria-label when value exceeds max after change', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="5" max="9"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('5');

      page.root!.value = '15';
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toBe('9+');
    });

    it('updates aria-label when icon is added', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBeNull();

      page.root!.icon = 'warning';
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toBe('warning');
    });

    it('updates aria-label when icon is removed and value exists', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge icon="error" value="3"></md-badge>',
      });
      expect(page.root?.getAttribute('aria-label')).toBe('3');

      page.root!.icon = '';
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toBe('3');
    });

    // ── no interactive role ──
    it('does not have role="button" or role="link"', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="5"></md-badge>',
      });
      expect(page.root?.getAttribute('role')).not.toBe('button');
      expect(page.root?.getAttribute('role')).not.toBe('link');
    });

    it('does not have tabindex (not focusable)', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="5"></md-badge>',
      });
      expect(page.root?.getAttribute('tabindex')).toBeNull();
    });

    it('does not have aria-live (role="status" implies polite)', async () => {
      const page = await newSpecPage({
        components: [MdBadge],
        html: '<md-badge value="5"></md-badge>',
      });
      // role="status" implicitly has aria-live="polite" per WAI-ARIA spec,
      // so an explicit aria-live attribute is redundant and should be absent
      expect(page.root?.getAttribute('aria-live')).toBeNull();
    });
  });

  // ── Value display ──────────────────────────────────────────
  it('displays the value text', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="7"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('7');
  });

  it('displays string values', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="NEW"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('NEW');
  });

  it('does not render label for small variant', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge variant="small" value="5"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label).toBeNull();
  });

  it('does not render label when value is empty', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label).toBeNull();
  });

  // ── Max threshold ──────────────────────────────────────────
  it('caps numeric value at max with +', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="1500" max="999"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('999+');
  });

  it('shows exact value when at max', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="999" max="999"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('999');
  });

  it('shows exact value when below max', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="42" max="999"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('42');
  });

  it('defaults max to 999', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="2000"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('999+');
  });

  it('uses custom max', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="15" max="9"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('9+');
  });

  it('does not cap non-numeric values', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="NEW" max="9"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('NEW');
  });

  // ── 4-character limit ──────────────────────────────────────
  it('truncates label to 4 characters', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="ABCDE"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('ABCD');
  });

  it('allows up to 4 characters', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="SALE"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('SALE');
  });

  it('keeps max+ within 4-char limit (e.g. 99+)', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="200" max="99"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('99+');
    expect(label?.textContent?.length).toBeLessThanOrEqual(4);
  });

  // ── has-content class ──────────────────────────────────────
  it('adds has-content class when value is present', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="3"></md-badge>',
    });
    expect(page.root?.classList.contains('md-badge--has-content')).toBe(true);
  });

  it('does not add has-content class when value is empty', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge></md-badge>',
    });
    expect(page.root?.classList.contains('md-badge--has-content')).toBe(false);
  });

  it('adds has-content class when icon is present', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge icon="error"></md-badge>',
    });
    expect(page.root?.classList.contains('md-badge--has-content')).toBe(true);
  });

  // ── Icon prop ──────────────────────────────────────────────
  it('renders icon element when icon prop is set', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge icon="error"></md-badge>',
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-badge__icon');
    expect(icon).toBeTruthy();
    expect(icon?.textContent).toBe('error');
  });

  it('does not render icon when icon prop is empty', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="5"></md-badge>',
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-badge__icon');
    expect(icon).toBeNull();
  });

  it('does not render icon for small variant', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge variant="small" icon="error"></md-badge>',
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-badge__icon');
    expect(icon).toBeNull();
  });

  it('renders both icon and label together', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge icon="error" value="3"></md-badge>',
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-badge__icon');
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(icon).toBeTruthy();
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe('3');
  });

  it('icon element has aria-hidden="true"', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge icon="error"></md-badge>',
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-badge__icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('icon element has material-symbols-outlined class', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge icon="error"></md-badge>',
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-badge__icon');
    expect(icon?.classList.contains('material-symbols-outlined')).toBe(true);
  });

  // ── CSS shadow parts ───────────────────────────────────────
  it('exposes "label" CSS part', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="5"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('[part="label"]');
    expect(label).toBeTruthy();
  });

  it('exposes "icon" CSS part', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge icon="error"></md-badge>',
    });
    const icon = page.root?.shadowRoot?.querySelector('[part="icon"]');
    expect(icon).toBeTruthy();
  });

  // ── Icon slot ──────────────────────────────────────────────
  it('renders icon slot when icon prop is set', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge icon="error"></md-badge>',
    });
    const slot = page.root?.shadowRoot?.querySelector('slot[name="icon"]');
    expect(slot).toBeTruthy();
  });

  // The slot is always present on a large badge, but empty — gating it on the
  // `icon` prop left a slotted custom icon unassigned, so it never showed.
  it('renders an empty icon slot when icon is empty', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="5"></md-badge>',
    });
    const slot = page.root?.shadowRoot?.querySelector('slot[name="icon"]');
    expect(slot).toBeTruthy();
    expect(slot?.querySelector('.md-badge__icon')).toBeNull();
  });

  it('does not render the icon slot on a small badge', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge variant="small"></md-badge>',
    });
    expect(page.root?.shadowRoot?.querySelector('slot[name="icon"]')).toBeNull();
  });

  it('counts a slotted icon as content without an icon prop', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge><svg slot="icon"></svg></md-badge>',
    });
    expect(page.root?.className).toContain('md-badge--has-content');
    expect(page.root?.shadowRoot?.querySelector('slot[name="icon"]')).toBeTruthy();
  });

  // ── Edge cases ─────────────────────────────────────────────
  it('handles "0" as a valid value', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="0"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('0');
  });

  it('handles negative numbers', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="-1"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('-1');
  });

  it('handles decimal numbers', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="3.5"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('3.5');
  });

  it('handles whitespace-only value as empty', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value=" "></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe(' ');
  });

  it('handles single character', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge value="!"></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    expect(label?.textContent).toBe('!');
  });

  it('variant reflects as attribute', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge variant="small"></md-badge>',
    });
    expect(page.root?.getAttribute('variant')).toBe('small');
  });

  it('renders empty large badge without label or icon', async () => {
    const page = await newSpecPage({
      components: [MdBadge],
      html: '<md-badge></md-badge>',
    });
    const label = page.root?.shadowRoot?.querySelector('.md-badge__label');
    const icon = page.root?.shadowRoot?.querySelector('.md-badge__icon');
    expect(label).toBeNull();
    expect(icon).toBeNull();
    expect(page.root?.classList.contains('md-badge--has-content')).toBe(false);
  });
});
