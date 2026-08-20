import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdNavigationTab } from './md-navigation-tab';

async function create(html: string): Promise<SpecPage> {
  return newSpecPage({
    components: [MdNavigationTab],
    html,
  });
}

const $ = (page: SpecPage, selector: string): Element | null =>
  page.root?.shadowRoot?.querySelector(selector) ?? null;

describe('md-navigation-tab', () => {
  // ─── Rendering ───────────────────────────────────────────
  describe('rendering', () => {
    it('renders the host with role=tab', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home"></md-navigation-tab>');
      expect(page.root?.getAttribute('role')).toBe('tab');
    });

    it('renders label, icon, indicator, and state layer', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home"></md-navigation-tab>');
      expect($(page, '.md-navigation-tab__label')?.textContent).toContain('Home');
      expect($(page, '.md-navigation-tab__icon')?.textContent).toContain('home');
      expect($(page, '.md-navigation-tab__indicator')).toBeTruthy();
      expect($(page, '.md-navigation-tab__state-layer')).toBeTruthy();
    });

    it('exposes the documented shadow parts', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home" badge></md-navigation-tab>');
      const parts = ['container', 'indicator', 'state-layer', 'icon-container', 'icon', 'badge', 'label'];
      parts.forEach(p => {
        const el = page.root?.shadowRoot?.querySelector(`[part="${p}"]`);
        expect(el).toBeTruthy(); // each anatomy part should be present
      });
    });
  });

  // ─── Active state ────────────────────────────────────────
  describe('active state', () => {
    it('aria-selected mirrors `active`', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home"></md-navigation-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBe('false');

      (page.root as unknown as { active: boolean }).active = true;
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-selected')).toBe('true');
      expect(page.root?.classList.contains('md-navigation-tab--active')).toBe(true);
    });

    it('adds the --active modifier on the indicator', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home" active></md-navigation-tab>');
      const indicator = $(page, '.md-navigation-tab__indicator');
      expect(indicator?.classList.contains('md-navigation-tab__indicator--active')).toBe(true);
    });

    it('renders activeIcon glyph when active and activeIcon is set', async () => {
      const page = await create(
        '<md-navigation-tab label="Home" icon="home" active-icon="home_filled" active></md-navigation-tab>',
      );
      const icon = $(page, '.md-navigation-tab__icon');
      expect(icon?.textContent?.trim()).toBe('home_filled');
      expect(icon?.classList.contains('md-navigation-tab__icon--filled')).toBe(true);
    });

    it('falls back to icon glyph when activeIcon is empty', async () => {
      const page = await create(
        '<md-navigation-tab label="Home" icon="home" active></md-navigation-tab>',
      );
      const icon = $(page, '.md-navigation-tab__icon');
      expect(icon?.textContent?.trim()).toBe('home');
      expect(icon?.classList.contains('md-navigation-tab__icon--filled')).toBe(true);
    });

    it('uses the outlined glyph when inactive', async () => {
      const page = await create(
        '<md-navigation-tab label="Home" icon="home" active-icon="home_filled"></md-navigation-tab>',
      );
      const icon = $(page, '.md-navigation-tab__icon');
      expect(icon?.textContent?.trim()).toBe('home');
      expect(icon?.classList.contains('md-navigation-tab__icon--filled')).toBe(false);
    });
  });

  // ─── Disabled ────────────────────────────────────────────
  describe('disabled', () => {
    it('reflects the disabled attribute and aria-disabled', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" disabled></md-navigation-tab>');
      expect(page.root?.hasAttribute('disabled')).toBe(true);
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      expect(page.root?.classList.contains('md-navigation-tab--disabled')).toBe(true);
    });

    it('blocks the click when disabled (preventDefault, no bubble to the bar)', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" disabled></md-navigation-tab>');
      const ev = new CustomEvent('click', { bubbles: true, cancelable: true });
      page.root?.dispatchEvent(ev);
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(true);
    });

    it('reapplies aria-disabled when the prop flips at runtime', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home"></md-navigation-tab>');
      (page.root as unknown as { disabled: boolean }).disabled = true;
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      (page.root as unknown as { disabled: boolean }).disabled = false;
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-disabled')).toBe('false');
    });
  });

  // ─── Soft-disabled ───────────────────────────────────────
  describe('soft-disabled', () => {
    it('sets aria-disabled but NOT the hard disabled attribute', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" soft-disabled></md-navigation-tab>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      expect(page.root?.hasAttribute('disabled')).toBe(false);
      expect(page.root?.hasAttribute('soft-disabled')).toBe(true);
      // Keeps the focus ring (no hard `--disabled` class), gains the soft modifier.
      expect(page.root?.classList.contains('md-navigation-tab--disabled')).toBe(false);
      expect(page.root?.classList.contains('md-navigation-tab--soft-disabled')).toBe(true);
    });

    it('blocks the click when soft-disabled (preventDefault, no bubble to the bar)', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" soft-disabled></md-navigation-tab>');
      const ev = new CustomEvent('click', { bubbles: true, cancelable: true });
      page.root?.dispatchEvent(ev);
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(true);
    });

    it('toggles aria-disabled when soft-disabled flips at runtime', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home"></md-navigation-tab>');
      (page.root as unknown as { softDisabled: boolean }).softDisabled = true;
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      (page.root as unknown as { softDisabled: boolean }).softDisabled = false;
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-disabled')).toBe('false');
    });
  });

  // ─── Badges ──────────────────────────────────────────────
  describe('badges', () => {
    it('renders a small dot when `badge` is true without a value', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" badge></md-navigation-tab>');
      const badge = $(page, '.md-navigation-tab__badge');
      expect(badge).toBeTruthy();
      expect(badge?.classList.contains('md-navigation-tab__badge--small')).toBe(true);
      expect(badge?.getAttribute('aria-label')).toBe('New');
    });

    it('renders the large variant when `badge-value` is set', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" badge-value="3"></md-navigation-tab>');
      const badge = $(page, '.md-navigation-tab__badge');
      expect(badge).toBeTruthy();
      expect(badge?.classList.contains('md-navigation-tab__badge--large')).toBe(true);
      expect(badge?.textContent).toBe('3');
      expect(badge?.getAttribute('aria-label')).toBe('3 new');
    });

    it('caps numeric badge values at badge-max', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" badge-value="1500" badge-max="99"></md-navigation-tab>');
      const badge = $(page, '.md-navigation-tab__badge');
      expect(badge?.textContent).toBe('99+');
    });

    it('passes through non-numeric badge values as-is', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" badge-value="New"></md-navigation-tab>');
      const badge = $(page, '.md-navigation-tab__badge');
      expect(badge?.textContent).toBe('New');
    });

    it('hides the badge when neither badge nor badge-value are set', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home"></md-navigation-tab>');
      expect($(page, '.md-navigation-tab__badge')).toBeNull();
    });
  });

  // ─── Label behavior ──────────────────────────────────────
  describe('label behavior', () => {
    it('shows the label by default', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home"></md-navigation-tab>');
      expect($(page, '.md-navigation-tab__label')).toBeTruthy();
    });

    it('hides the label when labelBehavior=none', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home" label-behavior="none"></md-navigation-tab>');
      expect($(page, '.md-navigation-tab__label')).toBeNull();
      // Falls back to aria-label so the accessible name remains.
      expect(page.root?.getAttribute('aria-label')).toBe('Home');
      expect(page.root?.classList.contains('md-navigation-tab--label-hidden')).toBe(true);
    });

    it('renders but visually hides the label when labelBehavior=selected and tab is inactive', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home" label-behavior="selected"></md-navigation-tab>');
      const label = $(page, '.md-navigation-tab__label');
      expect(label).toBeTruthy();
      expect(label?.classList.contains('md-navigation-tab__label--hidden')).toBe(true);
    });

    it('renders the label when labelBehavior=selected and the tab is active', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home" label-behavior="selected" active></md-navigation-tab>');
      const label = $(page, '.md-navigation-tab__label');
      expect(label?.classList.contains('md-navigation-tab__label--hidden')).toBe(false);
    });
  });

  // ─── Click / activation ──────────────────────────────────
  // Activation flows through a native, bubbling click — the parent
  // md-navigation-bar reads the tab's index and emits `mdChange`.
  describe('activation', () => {
    it('lets an enabled tab click through (not prevented → bubbles to the bar)', async () => {
      const page = await create('<md-navigation-tab label="Solo" icon="home"></md-navigation-tab>');
      const ev = new CustomEvent('click', { bubbles: true, cancelable: true });
      page.root?.dispatchEvent(ev);
      await page.waitForChanges();
      expect(ev.defaultPrevented).toBe(false);
    });

    it('synthesizes a native click on Enter', async () => {
      const page = await create('<md-navigation-tab label="Solo" icon="home"></md-navigation-tab>');
      const onClick = jest.fn();
      page.root?.addEventListener('click', onClick);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(onClick).toHaveBeenCalled();
    });

    it('synthesizes a native click on Space', async () => {
      const page = await create('<md-navigation-tab label="Solo" icon="home"></md-navigation-tab>');
      const onClick = jest.fn();
      page.root?.addEventListener('click', onClick);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await page.waitForChanges();
      expect(onClick).toHaveBeenCalled();
    });

    it('does not synthesize a click on Enter when disabled', async () => {
      const page = await create('<md-navigation-tab label="Solo" icon="home" disabled></md-navigation-tab>');
      const onClick = jest.fn();
      page.root?.addEventListener('click', onClick);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // ─── Initial tabindex/aria attributes ────────────────────
  describe('initial roving tabindex', () => {
    it('defaults tabindex=-1 when inactive', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home"></md-navigation-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('defaults tabindex=0 when active', async () => {
      const page = await create('<md-navigation-tab label="A" icon="home" active></md-navigation-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });
  });

  // ─── Accessibility helpers ───────────────────────────────
  describe('accessibility', () => {
    it('does not double-announce icon / badge content (aria-hidden on visuals)', async () => {
      const page = await create('<md-navigation-tab label="Home" icon="home"></md-navigation-tab>');
      expect($(page, '.md-navigation-tab__icon')?.getAttribute('aria-hidden')).toBe('true');
      expect($(page, '.md-navigation-tab__indicator')?.getAttribute('aria-hidden')).toBe('true');
      expect($(page, '.md-navigation-tab__state-layer')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('exposes label as the accessible name when labelBehavior=none', async () => {
      const page = await create('<md-navigation-tab label="Profile" icon="person" label-behavior="none"></md-navigation-tab>');
      expect(page.root?.getAttribute('aria-label')).toBe('Profile');
    });
  });
});
