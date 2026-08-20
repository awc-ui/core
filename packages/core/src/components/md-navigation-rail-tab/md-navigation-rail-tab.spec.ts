import { newSpecPage } from '@stencil/core/testing';
import { MdNavigationRailTab } from './md-navigation-rail-tab';

async function create(html: string) {
  return newSpecPage({
    components: [MdNavigationRailTab],
    html,
  });
}

describe('md-navigation-rail-tab', () => {
  // ----------------------------------------------------------------
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" icon="home"></md-navigation-rail-tab>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-navigation-rail-tab');
    });

    it('renders icon from the icon prop', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      const icon = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toContain('home');
    });

    it('renders label when label prop is set', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      const label = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__label');
      expect(label?.textContent).toBe('Home');
    });

    it('omits the label element when no label is provided', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" aria-label="Home"></md-navigation-rail-tab>');
      const label = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__label');
      expect(label).toBeFalsy();
    });

    it('adds md-navigation-rail-tab--active class when active', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home" active></md-navigation-rail-tab>');
      expect(page.root).toHaveClass('md-navigation-rail-tab--active');
    });
  });

  // ----------------------------------------------------------------
  describe('accessibility', () => {
    it('uses role="tab" by default', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('role')).toBe('tab');
    });

    it('uses role="link" when href is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('role')).toBe('link');
    });

    it('sets aria-selected="false" by default', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBe('false');
    });

    it('sets aria-selected="true" when active', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" active></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBe('true');
    });

    it('sets aria-current="page" when active AND href is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home" active></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-current')).toBe('page');
    });

    it('does not set aria-selected when href is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home" active></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBeNull();
    });

    it('sets aria-disabled="true" when disabled', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('makes the destination non-focusable when disabled', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('makes active destination focusable (tabindex=0)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" active></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('makes inactive destination non-focusable by default (roving tabindex managed by parent)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ----------------------------------------------------------------
  describe('events', () => {
    it('emits mdTabClick on click', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('emits mdTabClick with value detail', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" value="home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ value: 'home' });
    });

    it('does NOT emit mdTabClick when disabled', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  describe('keyboard activation', () => {
    it('activates on Enter', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('activates on Space', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('does NOT activate on Enter when disabled', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('ignores other keys (e.g. ArrowDown propagates to parent rail)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  describe('badges', () => {
    it('renders a dot badge when `badge` is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Inbox" badge></md-navigation-rail-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__badge--dot');
      expect(badge).toBeTruthy();
    });

    it('renders a large badge when badge-value is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Inbox" badge-value="3"></md-navigation-rail-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__badge--large');
      expect(badge?.textContent).toBe('3');
    });

    it('clamps badge values above 999 to "999+"', async () => {
      const page = await create('<md-navigation-rail-tab label="Inbox" badge-value="1234"></md-navigation-rail-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__badge--large');
      expect(badge?.textContent).toBe('999+');
    });

    it('badge has accessible label', async () => {
      const page = await create('<md-navigation-rail-tab label="Inbox" badge></md-navigation-rail-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__badge');
      expect(badge?.getAttribute('aria-label')).toBe('new notifications');
    });
  });

  // ----------------------------------------------------------------
  describe('CSS parts', () => {
    it('exposes state-layer part', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes indicator part', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="indicator"]')).toBeTruthy();
    });

    it('exposes icon-wrapper part', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon-wrapper"]')).toBeTruthy();
    });

    it('exposes icon part when icon prop is set', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
    });

    it('exposes label part when label is set', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeTruthy();
    });

    it('exposes anchor part in link mode', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="anchor"]')).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  describe('slots', () => {
    it('renders the named icon slot', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"><svg slot="icon"></svg></md-navigation-rail-tab>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="icon"]');
      expect(slot).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  describe('link mode', () => {
    it('renders an internal anchor element when href is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home"></md-navigation-rail-tab>');
      const anchor = page.root?.shadowRoot?.querySelector('a.md-navigation-rail-tab__anchor') as HTMLAnchorElement | null;
      expect(anchor).toBeTruthy();
      expect(anchor?.getAttribute('href')).toBe('/home');
    });

    it('adds rel="noopener noreferrer" for target=_blank', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home" target="_blank"></md-navigation-rail-tab>');
      const anchor = page.root?.shadowRoot?.querySelector('a.md-navigation-rail-tab__anchor');
      expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('does NOT render anchor when disabled (even with href)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home" disabled></md-navigation-rail-tab>');
      const anchor = page.root?.shadowRoot?.querySelector('a.md-navigation-rail-tab__anchor');
      expect(anchor).toBeFalsy();
    });

    it('names the role=link host via aria-label (its label content is in the aria-hidden anchor)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home"></md-navigation-rail-tab>');
      // Without this, the link would be nameless (WCAG 2.4.4 / 4.1.2): the
      // visible label lives inside the aria-hidden anchor.
      expect(page.root?.getAttribute('aria-label')).toBe('Home');
    });

    it('falls back to an author aria-label in link mode when no label is set', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" aria-label="Home" href="/home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-label')).toBe('Home');
    });

    it('does NOT add a redundant aria-label to a role=tab host that already has a visible label', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      // tab mode is named by its rendered label contents — no aria-label needed.
      expect(page.root?.hasAttribute('aria-label')).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  describe('label visibility', () => {
    it('applies labels-all class by default', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      expect(page.root).toHaveClass('md-navigation-rail-tab--labels-all');
    });

    it('applies labels-selected class when set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" label-visibility="selected"></md-navigation-rail-tab>');
      expect(page.root).toHaveClass('md-navigation-rail-tab--labels-selected');
    });

    it('applies labels-none class when set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" label-visibility="none"></md-navigation-rail-tab>');
      expect(page.root).toHaveClass('md-navigation-rail-tab--labels-none');
    });
  });

  // ----------------------------------------------------------------
  describe('RTL', () => {
    it('renders inside dir="rtl" context', async () => {
      const page = await newSpecPage({
        components: [MdNavigationRailTab],
        html: `<div dir="rtl"><md-navigation-rail-tab icon="home" label="الرئيسية"></md-navigation-rail-tab></div>`,
      });
      const tab = page.body.querySelector('md-navigation-rail-tab');
      expect(tab).toBeTruthy();
    });
  });
});
