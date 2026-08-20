import { newSpecPage } from '@stencil/core/testing';
import { MdNavigationRail } from './md-navigation-rail';
import { MdNavigationRailTab } from '../md-navigation-rail-tab/md-navigation-rail-tab';

async function create(html: string) {
  return newSpecPage({
    components: [MdNavigationRail, MdNavigationRailTab],
    html,
  });
}

const basicHtml = `
  <md-navigation-rail label="Primary">
    <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
    <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
    <md-navigation-rail-tab icon="settings" label="Settings"></md-navigation-rail-tab>
  </md-navigation-rail>
`;

const railTabs = (page: { root?: Element | null }): HTMLElement[] =>
  Array.from(page.root?.querySelectorAll('md-navigation-rail-tab') ?? []) as HTMLElement[];

/** Simulate a destination activation the way the child tab does — a bubbling,
 *  composed `mdTabClick` that the rail listens for. */
const fireTabClick = (tab: HTMLElement, value = '') =>
  tab.dispatchEvent(
    new CustomEvent('mdTabClick', { detail: { value }, bubbles: true, composed: true }),
  );

describe('md-navigation-rail', () => {
  // ----------------------------------------------------------------
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-navigation-rail');
    });

    it('applies the variant class', async () => {
      const page = await create('<md-navigation-rail variant="expanded"></md-navigation-rail>');
      expect(page.root).toHaveClass('md-navigation-rail--expanded');
    });

    it('defaults variant to "standard"', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.rootInstance.variant).toBe('standard');
      expect(page.root).toHaveClass('md-navigation-rail--standard');
    });

    it('defaults alignment to "top"', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.rootInstance.alignment).toBe('top');
      expect(page.root).toHaveClass('md-navigation-rail--align-top');
    });

    it('applies middle alignment class', async () => {
      const page = await create('<md-navigation-rail alignment="middle"></md-navigation-rail>');
      expect(page.root).toHaveClass('md-navigation-rail--align-middle');
    });

    it('applies bottom alignment class', async () => {
      const page = await create('<md-navigation-rail alignment="bottom"></md-navigation-rail>');
      expect(page.root).toHaveClass('md-navigation-rail--align-bottom');
    });

    it('defaults label-visibility to "all"', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.rootInstance.labelVisibility).toBe('all');
      expect(page.root).toHaveClass('md-navigation-rail--labels-all');
    });

    it('respects custom label-visibility="selected"', async () => {
      const page = await create('<md-navigation-rail label-visibility="selected"></md-navigation-rail>');
      expect(page.root).toHaveClass('md-navigation-rail--labels-selected');
    });

    it('respects custom label-visibility="none"', async () => {
      const page = await create('<md-navigation-rail label-visibility="none"></md-navigation-rail>');
      expect(page.root).toHaveClass('md-navigation-rail--labels-none');
    });
  });

  // ----------------------------------------------------------------
  describe('accessibility', () => {
    it('has role=navigation on host', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.root?.getAttribute('role')).toBe('navigation');
    });

    it('uses default aria-label "Navigation"', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.root?.getAttribute('aria-label')).toBe('Navigation');
    });

    it('reflects custom label prop on aria-label', async () => {
      const page = await create('<md-navigation-rail label="Primary destinations"></md-navigation-rail>');
      expect(page.root?.getAttribute('aria-label')).toBe('Primary destinations');
    });

    it('inner destinations container has role=tablist and vertical orientation', async () => {
      const page = await create(basicHtml);
      const tablist = page.root?.shadowRoot?.querySelector('.md-navigation-rail__destinations');
      expect(tablist?.getAttribute('role')).toBe('tablist');
      expect(tablist?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('tablist propagates aria-label from rail label', async () => {
      const page = await create('<md-navigation-rail label="Side nav"></md-navigation-rail>');
      const tablist = page.root?.shadowRoot?.querySelector('.md-navigation-rail__destinations');
      expect(tablist?.getAttribute('aria-label')).toBe('Side nav');
    });
  });

  // ----------------------------------------------------------------
  describe('CSS parts', () => {
    it('exposes container part', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('exposes destinations part', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.root?.shadowRoot?.querySelector('[part="destinations"]')).toBeTruthy();
    });

    it('exposes header / fab / footer parts', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="header"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="fab"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="footer"]')).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  describe('slots', () => {
    it('renders default slot for destinations', async () => {
      const page = await create(basicHtml);
      const slot = page.root?.shadowRoot?.querySelector('slot:not([name])');
      expect(slot).toBeTruthy();
    });

    it('renders named header / fab / footer slots', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('slot[name="header"]')).toBeTruthy();
      expect(shadow?.querySelector('slot[name="fab"]')).toBeTruthy();
      expect(shadow?.querySelector('slot[name="footer"]')).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  describe('events', () => {
    it('emits mdTabChange when a destination tab is clicked', async () => {
      const page = await create(basicHtml);
      const spy = jest.fn();
      page.root?.addEventListener('mdTabChange', spy);
      const tabs = page.root?.querySelectorAll('md-navigation-rail-tab');
      tabs?.[1].dispatchEvent(
        new CustomEvent('mdTabClick', { detail: { value: '' }, bubbles: true, composed: true }),
      );
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('emits mdExpand when variant changes to expanded', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      const spy = jest.fn();
      page.root?.addEventListener('mdExpand', spy);
      (page.root as HTMLElement).setAttribute('variant', 'expanded');
      page.rootInstance.variant = 'expanded';
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('emits mdCollapse when variant changes from expanded to standard', async () => {
      const page = await create('<md-navigation-rail variant="expanded"></md-navigation-rail>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCollapse', spy);
      page.rootInstance.variant = 'standard';
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  describe('methods', () => {
    it('expand() switches to expanded variant', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      await page.rootInstance.expand();
      await page.waitForChanges();
      expect(page.rootInstance.variant).toBe('expanded');
    });

    it('collapse() switches to standard variant', async () => {
      const page = await create('<md-navigation-rail variant="expanded"></md-navigation-rail>');
      await page.rootInstance.collapse();
      await page.waitForChanges();
      expect(page.rootInstance.variant).toBe('standard');
    });

    it('toggle() flips between standard and expanded', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      await page.rootInstance.toggle();
      expect(page.rootInstance.variant).toBe('expanded');
      await page.rootInstance.toggle();
      expect(page.rootInstance.variant).toBe('standard');
    });
  });

  // ----------------------------------------------------------------
  describe('RTL', () => {
    it('renders inside dir="rtl" context', async () => {
      const page = await newSpecPage({
        components: [MdNavigationRail, MdNavigationRailTab],
        html: `<div dir="rtl"><md-navigation-rail><md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab></md-navigation-rail></div>`,
      });
      const rail = page.body.querySelector('md-navigation-rail');
      expect(rail).toBeTruthy();
      expect(rail).toHaveClass('md-navigation-rail');
    });
  });

  // ----------------------------------------------------------------
  describe('keyboard navigation', () => {
    it('does not crash on arrow keys with no destinations', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      expect(() => page.root?.dispatchEvent(ev)).not.toThrow();
    });

    it('respects disableFocusManagement', async () => {
      const page = await create(
        `<md-navigation-rail disable-focus-management>${basicHtml.replace(/<\/?md-navigation-rail[^>]*>/g, '')}</md-navigation-rail>`,
      );
      const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      expect(() => page.root?.dispatchEvent(ev)).not.toThrow();
    });
  });

  // ----------------------------------------------------------------
  describe('active selection & syncing to tabs', () => {
    it('marks no destination active by default (activeIndex = -1)', async () => {
      const page = await create(basicHtml);
      expect(page.rootInstance.activeIndex).toBe(-1);
      railTabs(page).forEach((tab) => expect(tab.hasAttribute('active')).toBe(false));
    });

    it('activates the destination matching active-index and clears the rest', async () => {
      const page = await create(`
        <md-navigation-rail active-index="1">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="settings" label="Settings"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      const [home, search, settings] = railTabs(page);
      expect(home.hasAttribute('active')).toBe(false);
      expect(search.hasAttribute('active')).toBe(true);
      expect(settings.hasAttribute('active')).toBe(false);
    });

    it('moves the active destination when activeIndex changes programmatically', async () => {
      const page = await create(basicHtml);
      page.rootInstance.activeIndex = 2;
      await page.waitForChanges();
      const [home, , settings] = railTabs(page);
      expect(home.hasAttribute('active')).toBe(false);
      expect(settings.hasAttribute('active')).toBe(true);
    });

    it('propagates label-visibility to every child destination', async () => {
      const page = await create(`
        <md-navigation-rail label-visibility="selected">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      railTabs(page).forEach((tab) =>
        expect(tab.getAttribute('label-visibility')).toBe('selected'),
      );
    });

    it('re-syncs label-visibility to children when it changes', async () => {
      const page = await create(basicHtml);
      page.rootInstance.labelVisibility = 'none';
      await page.waitForChanges();
      railTabs(page).forEach((tab) =>
        expect(tab.getAttribute('label-visibility')).toBe('none'),
      );
    });

    it('reflects the expanded variant onto children as the `expanded` prop', async () => {
      const page = await create(`
        <md-navigation-rail variant="expanded">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      railTabs(page).forEach((tab) => expect(tab.hasAttribute('expanded')).toBe(true));
    });
  });

  // ----------------------------------------------------------------
  describe('pre-marked active child adoption', () => {
    it('adopts a child marked `active` into activeIndex when no active-index is set', async () => {
      const page = await create(`
        <md-navigation-rail>
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search" active></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="settings" label="Settings"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      expect(page.rootInstance.activeIndex).toBe(1);
      const [, search] = railTabs(page);
      expect(search.hasAttribute('active')).toBe(true);
    });

    it('active-index takes precedence over a child `active` marker', async () => {
      const page = await create(`
        <md-navigation-rail active-index="0">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search" active></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      expect(page.rootInstance.activeIndex).toBe(0);
      const [home, search] = railTabs(page);
      expect(home.hasAttribute('active')).toBe(true);
      expect(search.hasAttribute('active')).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  describe('roving tabindex', () => {
    it('makes the first enabled destination tabbable when nothing is active', async () => {
      const page = await create(basicHtml);
      const [home, search, settings] = railTabs(page);
      expect(home.tabIndex).toBe(0);
      expect(search.tabIndex).toBe(-1);
      expect(settings.tabIndex).toBe(-1);
    });

    it('makes the active destination the only tabbable one', async () => {
      const page = await create(`
        <md-navigation-rail active-index="2">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="settings" label="Settings"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      const [home, search, settings] = railTabs(page);
      expect(home.tabIndex).toBe(-1);
      expect(search.tabIndex).toBe(-1);
      expect(settings.tabIndex).toBe(0);
    });

    it('skips a disabled leading destination when picking the roving tab', async () => {
      const page = await create(`
        <md-navigation-rail>
          <md-navigation-rail-tab icon="home" label="Home" disabled></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      const [home, search] = railTabs(page);
      expect(home.tabIndex).toBe(-1);
      expect(search.tabIndex).toBe(0);
    });

    it('never makes a disabled destination tabbable', async () => {
      const page = await create(`
        <md-navigation-rail active-index="0">
          <md-navigation-rail-tab icon="home" label="Home" disabled></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      const [home] = railTabs(page);
      expect(home.tabIndex).toBe(-1);
    });

    it('leaves tabindex untouched when focus management is disabled', async () => {
      const page = await create(`
        <md-navigation-rail disable-focus-management>
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      // The rail does not set roving tabindex; each tab keeps its own default
      // (-1 for an inactive destination), never forced to 0 by the parent.
      railTabs(page).forEach((tab) => expect(tab.tabIndex).toBe(-1));
    });
  });

  // ----------------------------------------------------------------
  describe('destination activation (mdTabClick handling)', () => {
    it('updates activeIndex and emits mdTabChange with index + value', async () => {
      const page = await create(basicHtml);
      const spy = jest.fn();
      page.root?.addEventListener('mdTabChange', spy);
      const [, search] = railTabs(page);
      fireTabClick(search, 'search');
      await page.waitForChanges();
      expect(page.rootInstance.activeIndex).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ index: 1, value: 'search' });
    });

    it('does not re-emit mdTabChange when the active destination is reselected', async () => {
      const page = await create(`
        <md-navigation-rail active-index="0">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdTabChange', spy);
      const [home] = railTabs(page);
      fireTabClick(home);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.activeIndex).toBe(0);
    });

    it('ignores activation of a disabled destination (no change, no event)', async () => {
      const page = await create(`
        <md-navigation-rail active-index="0">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search" disabled></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdTabChange', spy);
      const [, search] = railTabs(page);
      fireTabClick(search);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.activeIndex).toBe(0);
    });

    it('moves the roving tabindex to the activated destination', async () => {
      const page = await create(basicHtml);
      const [home, , settings] = railTabs(page);
      fireTabClick(settings);
      await page.waitForChanges();
      expect(settings.tabIndex).toBe(0);
      expect(home.tabIndex).toBe(-1);
    });
  });

  // ----------------------------------------------------------------
  describe('expandable toggle button', () => {
    const toggleButton = (page: { root?: Element | null }) =>
      page.root?.shadowRoot?.querySelector('.md-navigation-rail__toggle-button');

    it('is not rendered unless expandable is set', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(toggleButton(page)).toBeFalsy();
    });

    it('renders when expandable is set', async () => {
      const page = await create('<md-navigation-rail expandable></md-navigation-rail>');
      expect(toggleButton(page)).toBeTruthy();
    });

    it('uses the toggle-label as its accessible name', async () => {
      const page = await create(
        '<md-navigation-rail expandable toggle-label="Expand navigation"></md-navigation-rail>',
      );
      expect(toggleButton(page)?.getAttribute('aria-label')).toBe('Expand navigation');
    });

    it('falls back to the default toggle label', async () => {
      const page = await create('<md-navigation-rail expandable></md-navigation-rail>');
      expect(toggleButton(page)?.getAttribute('aria-label')).toBe('Toggle navigation');
    });

    it('reflects collapsed state via aria-expanded=false and the menu icon', async () => {
      const page = await create('<md-navigation-rail expandable></md-navigation-rail>');
      const btn = toggleButton(page);
      expect(btn?.getAttribute('aria-expanded')).toBe('false');
      expect(btn?.getAttribute('icon')).toBe('menu');
    });

    it('reflects expanded state via aria-expanded=true and the menu_open icon', async () => {
      const page = await create('<md-navigation-rail expandable variant="expanded"></md-navigation-rail>');
      const btn = toggleButton(page);
      expect(btn?.getAttribute('aria-expanded')).toBe('true');
      expect(btn?.getAttribute('icon')).toBe('menu_open');
    });

    it('toggles the variant when clicked', async () => {
      const page = await create('<md-navigation-rail expandable></md-navigation-rail>');
      (toggleButton(page) as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.variant).toBe('expanded');
    });
  });

  // ----------------------------------------------------------------
  describe('modal overlay', () => {
    it('applies the modal class', async () => {
      const page = await create('<md-navigation-rail modal></md-navigation-rail>');
      expect(page.root).toHaveClass('md-navigation-rail--modal');
    });

    it('never sets aria-modal — invalid on a navigation landmark (ARIA aria-allowed-attr)', async () => {
      // aria-modal is only valid on dialog/alertdialog. The modal rail conveys
      // its overlay nature through the scrim + dismissal behaviour instead.
      const page = await create('<md-navigation-rail modal variant="expanded"></md-navigation-rail>');
      expect(page.root?.hasAttribute('aria-modal')).toBe(false);
    });

    it('Escape collapses a modal expanded rail and emits mdCollapse', async () => {
      const page = await create('<md-navigation-rail modal variant="expanded" expandable></md-navigation-rail>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCollapse', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.variant).toBe('standard');
      expect(spy).toHaveBeenCalled();
    });

    it('Escape is a no-op when the rail is not modal', async () => {
      const page = await create('<md-navigation-rail variant="expanded"></md-navigation-rail>');
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.variant).toBe('expanded');
    });

    it('renders an aria-hidden scrim', async () => {
      const page = await create('<md-navigation-rail modal variant="expanded"></md-navigation-rail>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-navigation-rail__scrim');
      expect(scrim).toBeTruthy();
      expect(scrim?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // ----------------------------------------------------------------
  describe('full-height', () => {
    it('applies the full-height class when set', async () => {
      const page = await create('<md-navigation-rail full-height></md-navigation-rail>');
      expect(page.root).toHaveClass('md-navigation-rail--full-height');
    });

    it('does not apply the full-height class by default', async () => {
      const page = await create('<md-navigation-rail></md-navigation-rail>');
      expect(page.root).not.toHaveClass('md-navigation-rail--full-height');
    });
  });

  // ----------------------------------------------------------------
  describe('focusTab() method', () => {
    it('makes the requested destination the roving (tabbable) tab', async () => {
      const page = await create(basicHtml);
      await page.rootInstance.focusTab(1);
      await page.waitForChanges();
      const [home, search, settings] = railTabs(page);
      expect(search.tabIndex).toBe(0);
      expect(home.tabIndex).toBe(-1);
      expect(settings.tabIndex).toBe(-1);
    });

    it('is a safe no-op for an out-of-range index', async () => {
      const page = await create(basicHtml);
      await expect(page.rootInstance.focusTab(99)).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  describe('variant watcher guards', () => {
    it('does not emit mdExpand when the variant is set to its current value', async () => {
      const page = await create('<md-navigation-rail variant="expanded"></md-navigation-rail>');
      const spy = jest.fn();
      page.root?.addEventListener('mdExpand', spy);
      page.rootInstance.variant = 'expanded';
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  describe('link destinations (tablist role validity)', () => {
    const destinations = (page: { root?: Element | null }) =>
      page.root?.shadowRoot?.querySelector('.md-navigation-rail__destinations');

    it('keeps role=tablist when destinations are tabs (no href)', async () => {
      const page = await create(basicHtml);
      expect(destinations(page)?.getAttribute('role')).toBe('tablist');
      expect(destinations(page)?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('drops the tablist role when destinations are links (a tablist may only hold tabs)', async () => {
      const page = await create(`
        <md-navigation-rail label="Primary">
          <md-navigation-rail-tab icon="home" label="Home" href="/home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search" href="/search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      const container = destinations(page);
      expect(container?.hasAttribute('role')).toBe(false);
      expect(container?.hasAttribute('aria-orientation')).toBe(false);
      // No aria-label either — naming a roleless/generic element is prohibited.
      expect(container?.hasAttribute('aria-label')).toBe(false);
    });

    it('drops the tablist role when ANY destination is a link', async () => {
      const page = await create(`
        <md-navigation-rail label="Primary">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search" href="/search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `);
      expect(destinations(page)?.hasAttribute('role')).toBe(false);
    });
  });
  // ─── Horizontal orientation ──────────────────────────────
  describe('orientation', () => {
    const destinations = (page: { root?: Element | null }) =>
      page.root?.shadowRoot?.querySelector('[part="destinations"]') as HTMLElement | null;
    const toggleButton = (page: { root?: Element | null }) =>
      page.root?.shadowRoot?.querySelector('.md-navigation-rail__toggle-button') as HTMLElement | null;

    const FIVE = (attrs = '') => `
      <md-navigation-rail ${attrs}>
        <md-navigation-rail-tab icon="home" label="Home" value="home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="folder" label="Files" value="files"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="star" label="Starred" value="starred"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="delete" label="Trash" value="trash"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="Settings" value="settings"></md-navigation-rail-tab>
      </md-navigation-rail>`;

    it('defaults to vertical and reports it on the destinations region', async () => {
      const page = await create(FIVE());
      await page.waitForChanges();
      expect(page.root?.getAttribute('orientation')).toBe('vertical');
      expect(destinations(page)?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('reports the horizontal axis to assistive tech', async () => {
      const page = await create(FIVE('orientation="horizontal"'));
      await page.waitForChanges();
      expect(destinations(page)?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('does not render the expand toggle in a bar — it has nowhere to grow', async () => {
      const page = await create(FIVE('orientation="horizontal" expandable'));
      await page.waitForChanges();
      expect(toggleButton(page)).toBeFalsy();
    });
  });

  // ─── Overflow ────────────────────────────────────────────
  describe('overflow (max-visible)', () => {
    const SIX = `
      <md-navigation-rail max-visible="3">
        <md-navigation-rail-tab icon="home" label="Home" value="home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="folder" label="Files" value="files"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="star" label="Starred" value="starred"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="delete" label="Trash" value="trash"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="settings" label="Settings" value="settings"></md-navigation-rail-tab>
      </md-navigation-rail>`;

    it('marks only the destinations past the cap', async () => {
      const page = await create(SIX);
      await page.waitForChanges();
      expect(railTabs(page).map((t) => t.hasAttribute('data-overflowed')))
        .toEqual([false, false, false, true, true]);
    });

    it('renders the trigger OUTSIDE the tablist — a tablist may only hold tabs', async () => {
      const page = await create(SIX);
      await page.waitForChanges();
      const trigger = page.root?.shadowRoot?.querySelector('.md-navigation-rail__overflow-trigger');
      expect(trigger).toBeTruthy();
      expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger?.closest('[role="tablist"]')).toBe(null);
    });

    it('lists exactly the collapsed destinations', async () => {
      const page = await create(SIX);
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelectorAll('md-menu-item')).toHaveLength(2);
    });

    it('renders no overflow affordance under the cap', async () => {
      const page = await create(SIX.replace('max-visible="3"', 'max-visible="9"'));
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-navigation-rail__overflow')).toBe(null);
      expect(railTabs(page).some((t) => t.hasAttribute('data-overflowed'))).toBe(false);
    });

    it('ignores a click on a collapsed destination (it is out of the rail)', async () => {
      const page = await create(SIX);
      await page.waitForChanges();
      const changed = jest.fn();
      page.root?.addEventListener('mdTabChange', changed);
      fireTabClick(railTabs(page)[4], 'settings');
      await page.waitForChanges();
      expect(changed).not.toHaveBeenCalled();
    });
  });
});
