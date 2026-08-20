import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdTab } from './md-tab';

describe('md-tab', () => {
  async function create(html: string): Promise<SpecPage> {
    return newSpecPage({ components: [MdTab], html });
  }

  // ─── Rendering ───────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-tab label="Tab 1"></md-tab>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-tab');
    });

    it('renders label text', async () => {
      const page = await create('<md-tab label="Flights"></md-tab>');
      const label = page.root?.shadowRoot?.querySelector('.md-tab__label');
      expect(label?.textContent).toContain('Flights');
    });

    it('renders icon from prop', async () => {
      const page = await create('<md-tab label="Tab" icon="flight"></md-tab>');
      const icon = page.root?.shadowRoot?.querySelector('.md-tab__icon');
      expect(icon?.textContent).toBe('flight');
    });

    it('renders stacked layout with icon + label (primary)', async () => {
      const page = await create('<md-tab label="Tab" icon="home" variant="primary"></md-tab>');
      expect(page.root).toHaveClass('md-tab--stacked');
    });

    it('renders inline layout when inline-icon is set', async () => {
      const page = await create('<md-tab label="Tab" icon="home" inline-icon></md-tab>');
      expect(page.root).toHaveClass('md-tab--inline-icon');
      const content = page.root?.shadowRoot?.querySelector('.md-tab__content--inline');
      expect(content).toBeTruthy();
    });

    it('renders active indicator when active', async () => {
      const page = await create('<md-tab label="Tab" active></md-tab>');
      const indicator = page.root?.shadowRoot?.querySelector('.md-tab__indicator--active');
      expect(indicator).toBeTruthy();
    });

    it('renders divider element', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.shadowRoot?.querySelector('.md-tab__divider')).toBeTruthy();
    });

    it('renders md-ripple', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeTruthy();
    });
  });

  // ─── Variants ────────────────────────────────────────────

  describe('variants', () => {
    it('applies primary variant class', async () => {
      const page = await create('<md-tab variant="primary" label="Tab"></md-tab>');
      expect(page.root).toHaveClass('md-tab--primary');
    });

    it('applies secondary variant class', async () => {
      const page = await create('<md-tab variant="secondary" label="Tab"></md-tab>');
      expect(page.root).toHaveClass('md-tab--secondary');
    });
  });

  // ─── Props ───────────────────────────────────────────────

  describe('props', () => {
    it('defaults variant to primary', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.rootInstance.variant).toBe('primary');
    });

    it('defaults active to false', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.rootInstance.active).toBe(false);
    });

    it('reflects active attribute', async () => {
      const page = await create('<md-tab label="Tab" active></md-tab>');
      expect(page.root?.hasAttribute('active')).toBe(true);
    });

    it('reflects disabled attribute', async () => {
      const page = await create('<md-tab label="Tab" disabled></md-tab>');
      expect(page.root?.hasAttribute('disabled')).toBe(true);
    });
  });

  // ─── Accessibility ──────────────────────────────────────

  describe('accessibility', () => {
    it('has role="tab"', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.getAttribute('role')).toBe('tab');
    });

    it('sets aria-selected="true" when active', async () => {
      const page = await create('<md-tab label="Tab" active></md-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBe('true');
    });

    it('sets aria-selected="false" when inactive', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBe('false');
    });

    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-tab label="Tab" disabled></md-tab>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('has tabindex="0" when enabled', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('has tabindex="-1" when disabled', async () => {
      const page = await create('<md-tab label="Tab" disabled></md-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('sets aria-controls when controls prop is provided', async () => {
      const page = await create('<md-tab label="Tab" controls="panel-1"></md-tab>');
      expect(page.root?.getAttribute('aria-controls')).toBe('panel-1');
    });

    it('omits aria-controls when controls prop is empty', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.hasAttribute('aria-controls')).toBe(false);
    });
  });

  // ─── Events ─────────────────────────────────────────────

  describe('events', () => {
    it('emits mdTabClick on click', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not emit when disabled', async () => {
      const page = await create('<md-tab label="Tab" disabled></md-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits on Enter key', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('emits on Space key', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─── Badge ──────────────────────────────────────────────

  describe('badge', () => {
    it('renders badge with text', async () => {
      const page = await create('<md-tab label="Tab" icon="mail" badge="3"></md-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-tab__badge');
      expect(badge?.textContent).toBe('3');
    });

    it('renders dot badge when badge is empty string', async () => {
      const page = await create('<md-tab label="Tab" icon="mail" badge=""></md-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-tab__badge');
      expect(badge).toBeTruthy();
    });

    it('renders inline badge when icon is absent', async () => {
      const page = await create('<md-tab label="Tab" badge="5"></md-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-tab__badge--inline');
      expect(badge).toBeTruthy();
    });
  });

  // ─── Parts ──────────────────────────────────────────────

  describe('parts', () => {
    it('exposes content part', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="content"]')).toBeTruthy();
    });

    it('exposes label part', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeTruthy();
    });

    it('exposes indicator part', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="indicator"]')).toBeTruthy();
    });

    it('exposes divider part', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="divider"]')).toBeTruthy();
    });

    it('exposes state-layer part', async () => {
      const page = await create('<md-tab label="Tab"></md-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes icon part when icon is set', async () => {
      const page = await create('<md-tab label="Tab" icon="home"></md-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
    });
  });

  // ─── Slots ──────────────────────────────────────────────

  describe('slots', () => {
    it('renders named icon slot', async () => {
      const page = await create('<md-tab label="Tab" icon="x"><svg slot="icon"></svg></md-tab>');
      const iconSlot = page.root?.shadowRoot?.querySelector('slot[name="icon"]');
      expect(iconSlot).toBeTruthy();
    });
  });

  // ─── RTL ────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdTab],
        html: '<div dir="rtl"><md-tab label="Tab"></md-tab></div>',
      });
      expect(page.root).toBeTruthy();
    });
  });

  it('badge slot exists and slotted badge content is projected (not dropped)', async () => {
    const page = await newSpecPage({
      components: [MdTab],
      html: '<md-tab label="Mail" icon="mail"><span slot="badge" id="b">7</span></md-tab>',
    });
    await page.waitForChanges();
    const slot = page.root!.shadowRoot!.querySelector('slot[name="badge"]');
    expect(slot).not.toBeNull();
    expect(page.body.querySelector('#b')).not.toBeNull();
  });


  it('slotted icon WITHOUT an icon prop renders the icon slot on first paint', async () => {
    const page = await newSpecPage({
      components: [MdTab],
      html: '<md-tab label="Starred"><span slot="icon">S</span></md-tab>',
    });
    await page.waitForChanges();
    expect(page.root!.shadowRoot!.querySelector('slot[name="icon"]')).not.toBeNull();
    expect(page.root!.classList.contains('md-tab--stacked')).toBe(true); // icon + label layout
  });

});
