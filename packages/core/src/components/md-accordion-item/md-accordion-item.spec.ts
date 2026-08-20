import { newSpecPage } from '@stencil/core/testing';
import { MdAccordionItem } from './md-accordion-item';

describe('md-accordion-item', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdAccordionItem],
      html,
    });
  }

  // ─── Rendering ──────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-accordion-item headline="Account">Body</md-accordion-item>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-accordion-item');
    });

    it('does not have expanded class by default', async () => {
      const page = await create('<md-accordion-item headline="Account">Body</md-accordion-item>');
      expect(page.root).not.toHaveClass('md-accordion-item--expanded');
    });

    it('adds expanded class when expanded prop is set', async () => {
      const page = await create('<md-accordion-item headline="Account" expanded>Body</md-accordion-item>');
      expect(page.root).toHaveClass('md-accordion-item--expanded');
    });

    it('adds disabled class when disabled prop is set', async () => {
      const page = await create('<md-accordion-item headline="Account" disabled>Body</md-accordion-item>');
      expect(page.root).toHaveClass('md-accordion-item--disabled');
    });

    it('renders the headline prop', async () => {
      const page = await create('<md-accordion-item headline="Account">Body</md-accordion-item>');
      const headline = page.root?.shadowRoot?.querySelector('[part="headline"]');
      expect(headline?.textContent).toContain('Account');
    });

    it('renders supporting text when provided', async () => {
      const page = await create('<md-accordion-item headline="Account" supporting-text="Email & password">Body</md-accordion-item>');
      const supporting = page.root?.shadowRoot?.querySelector('[part="supporting-text"]');
      expect(supporting?.textContent).toBe('Email & password');
    });

    it('does not render supporting text when omitted', async () => {
      const page = await create('<md-accordion-item headline="Account">Body</md-accordion-item>');
      const supporting = page.root?.shadowRoot?.querySelector('[part="supporting-text"]');
      expect(supporting).toBeNull();
    });

    it('renders the prop-based leading icon', async () => {
      const page = await create('<md-accordion-item headline="Account" icon="person">Body</md-accordion-item>');
      const icon = page.root?.shadowRoot?.querySelector('.md-accordion-item__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('person');
    });

    it('does not render a prop-based icon when icon is unset', async () => {
      const page = await create('<md-accordion-item headline="Account">Body</md-accordion-item>');
      const icon = page.root?.shadowRoot?.querySelector('.md-accordion-item__icon');
      expect(icon).toBeNull();
    });

    it('renders a chevron in the trailing slot fallback', async () => {
      const page = await create('<md-accordion-item headline="Account">Body</md-accordion-item>');
      const chevron = page.root?.shadowRoot?.querySelector('.md-accordion-item__chevron');
      expect(chevron).toBeTruthy();
    });
  });

  // ─── Heading levels ────────────────────────────────────

  describe('heading-level', () => {
    it('defaults to h3', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const heading = page.root?.shadowRoot?.querySelector('[part="heading"]');
      expect(heading?.tagName).toBe('H3');
    });

    it.each([1, 2, 3, 4, 5, 6] as const)('renders h%i for heading-level=%i', async (level) => {
      const page = await create(`<md-accordion-item heading-level="${level}" headline="A">Body</md-accordion-item>`);
      const heading = page.root?.shadowRoot?.querySelector('[part="heading"]');
      expect(heading?.tagName).toBe(`H${level}`);
    });

    it('clamps below-range heading levels to h1', async () => {
      const page = await create('<md-accordion-item heading-level="0" headline="A">Body</md-accordion-item>');
      const heading = page.root?.shadowRoot?.querySelector('[part="heading"]');
      expect(heading?.tagName).toBe('H1');
    });

    it('clamps above-range heading levels to h6', async () => {
      const page = await create('<md-accordion-item heading-level="9" headline="A">Body</md-accordion-item>');
      const heading = page.root?.shadowRoot?.querySelector('[part="heading"]');
      expect(heading?.tagName).toBe('H6');
    });
  });

  // ─── ARIA on the trigger button ────────────────────────

  describe('accessibility · header button', () => {
    it('has type="button"', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      expect(btn?.getAttribute('type')).toBe('button');
    });

    it('aria-expanded reflects state — false when collapsed', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      expect(btn?.getAttribute('aria-expanded')).toBe('false');
    });

    it('aria-expanded reflects state — true when expanded', async () => {
      const page = await create('<md-accordion-item headline="A" expanded>Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      expect(btn?.getAttribute('aria-expanded')).toBe('true');
    });

    it('aria-controls points at the panel id', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      const controlsId = btn?.getAttribute('aria-controls');
      expect(controlsId).toBeTruthy();
      const panel = page.root?.shadowRoot?.querySelector(`#${controlsId}`);
      expect(panel).toBeTruthy();
    });

    it('aria-disabled=true when item is disabled', async () => {
      const page = await create('<md-accordion-item headline="A" disabled>Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      expect(btn?.getAttribute('aria-disabled')).toBe('true');
    });

    it('aria-disabled is unset when item is plain enabled', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      expect(btn?.getAttribute('aria-disabled')).toBeNull();
    });

    it('aria-disabled=true when expanded + collapsible=false (APG keep-open variant)', async () => {
      const page = await newSpecPage({
        components: [MdAccordionItem],
        html: '<md-accordion-item headline="A" expanded>Body</md-accordion-item>',
      });
      page.rootInstance.collapsible = false;
      await page.waitForChanges();
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      expect(btn?.getAttribute('aria-disabled')).toBe('true');
    });

    it('native disabled attribute on the button mirrors the disabled prop', async () => {
      const page = await create('<md-accordion-item headline="A" disabled>Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      // mock-doc doesn't always reflect to the .disabled JS prop on a
      // raw HTMLButtonElement; check the attribute directly.
      expect(btn?.hasAttribute('disabled')).toBe(true);
    });
  });

  // ─── ARIA on the panel ────────────────────────────────

  describe('accessibility · panel', () => {
    it('panel id matches button aria-controls', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.id).toBe(btn?.getAttribute('aria-controls'));
    });

    it('panel is labelled by the header button id', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('aria-labelledby')).toBe(btn?.id);
    });

    it('panel has role="region" by default', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('role')).toBe('region');
    });

    it('panel role can be downgraded to "group"', async () => {
      const page = await create('<md-accordion-item headline="A" region-role="group">Body</md-accordion-item>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('role')).toBe('group');
    });

    it('panel role is unset when region-role="none"', async () => {
      const page = await create('<md-accordion-item headline="A" region-role="none">Body</md-accordion-item>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('role')).toBeNull();
    });

    it('panel aria-hidden=true when collapsed', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('aria-hidden')).toBe('true');
    });

    it('panel aria-hidden=false when expanded', async () => {
      const page = await create('<md-accordion-item headline="A" expanded>Body</md-accordion-item>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('aria-hidden')).toBe('false');
    });

    it('panel is inert when collapsed', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]') as HTMLElement;
      expect(panel?.hasAttribute('inert') || (panel as unknown as { inert?: boolean }).inert).toBeTruthy();
    });

    it('panel is not inert when expanded', async () => {
      const page = await create('<md-accordion-item headline="A" expanded>Body</md-accordion-item>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]') as HTMLElement;
      // mock-doc maps the `inert` boolean prop to a boolean attribute.
      // When the prop is false, the attribute either won't be set or is
      // set to a falsy value.
      const attr = panel?.getAttribute('inert');
      const propVal = (panel as unknown as { inert?: boolean }).inert;
      expect(attr === null || attr === 'false' || propVal === false).toBe(true);
    });
  });

  // ─── Scrollable (capped) panel body ───────────────────
  // A capped panel body is a scroll container; it must be keyboard
  // focusable so keyboard-only users can scroll it (WCAG 2.1.1 / axe
  // `scrollable-region-focusable`). The accessible name comes from the
  // enclosing labelled panel region.

  describe('accessibility · scrollable panel body', () => {
    it('content region is NOT focusable when content-max-height is unset', async () => {
      const page = await create('<md-accordion-item headline="A" expanded>Body</md-accordion-item>');
      const inner = page.root?.shadowRoot?.querySelector('.md-accordion-item__content-inner');
      expect(inner?.hasAttribute('tabindex')).toBe(false);
      expect(inner?.classList.contains('md-accordion-item__content-inner--scroll')).toBe(false);
    });

    it('capped content region is keyboard-focusable (tabindex="0")', async () => {
      const page = await create('<md-accordion-item headline="A" expanded content-max-height="220px">Body</md-accordion-item>');
      const inner = page.root?.shadowRoot?.querySelector('.md-accordion-item__content-inner');
      expect(inner?.getAttribute('tabindex')).toBe('0');
      expect(inner?.classList.contains('md-accordion-item__content-inner--scroll')).toBe(true);
    });

    it('capped content region stays inside the labelled panel region (name inherited)', async () => {
      const page = await create('<md-accordion-item headline="A" expanded content-max-height="220px">Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      const inner = page.root?.shadowRoot?.querySelector('.md-accordion-item__content-inner');
      // The focusable scroll region sits within the region labelled by the header.
      expect(panel?.getAttribute('role')).toBe('region');
      expect(panel?.getAttribute('aria-labelledby')).toBe(btn?.id);
      expect(panel?.contains(inner ?? null)).toBe(true);
    });
  });

  // ─── CSS Parts ─────────────────────────────────────────

  describe('parts', () => {
    const expectedParts = [
      'heading',
      'header',
      'state-layer',
      'drag-handle',
      'chassis-handle',
      'chassis-handle-bar',
      'panel',
      'content',
      'headline',
      'trailing-icon',
    ];

    it.each(expectedParts)('exposes part="%s"', async (part) => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const node = page.root?.shadowRoot?.querySelector(`[part="${part}"]`);
      expect(node).toBeTruthy();
    });

    it('exposes part="leading-icon" only when an icon is provided', async () => {
      const withIcon = await create('<md-accordion-item headline="A" icon="info">Body</md-accordion-item>');
      expect(withIcon.root?.shadowRoot?.querySelector('[part="leading-icon"]')).toBeTruthy();

      const withoutIcon = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      expect(withoutIcon.root?.shadowRoot?.querySelector('[part="leading-icon"]')).toBeNull();
    });

    it('exposes part="supporting-text" only when supporting-text is provided', async () => {
      const withSupporting = await create('<md-accordion-item headline="A" supporting-text="Sub">Body</md-accordion-item>');
      expect(withSupporting.root?.shadowRoot?.querySelector('[part="supporting-text"]')).toBeTruthy();

      const without = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      expect(without.root?.shadowRoot?.querySelector('[part="supporting-text"]')).toBeNull();
    });
  });

  // ─── Slots ─────────────────────────────────────────────

  describe('slots', () => {
    it('renders the default slot', async () => {
      const page = await create('<md-accordion-item headline="A">Body content</md-accordion-item>');
      const slot = page.root?.shadowRoot?.querySelector('.md-accordion-item__content-inner slot:not([name])');
      expect(slot).toBeTruthy();
      expect(page.root?.textContent).toContain('Body content');
    });

    it('renders a named "headline" slot', async () => {
      const page = await create('<md-accordion-item><span slot="headline">Custom</span>Body</md-accordion-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="headline"]');
      expect(slot).toBeTruthy();
    });

    it('renders a named "leading-icon" slot when slotted content is present', async () => {
      const page = await create('<md-accordion-item headline="A"><svg slot="leading-icon"></svg>Body</md-accordion-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="leading-icon"]');
      expect(slot).toBeTruthy();
    });

    it('renders a named "trailing-icon" slot for replacing the chevron', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="trailing-icon"]');
      expect(slot).toBeTruthy();
    });

    it('slotchange on the leading-icon slot toggles the slotted-icon flag', async () => {
      // Render with an `icon` prop so the leading-icon slot exists in
      // shadow at componentDidLoad time and `bindSlotListener` attaches.
      const page = await create('<md-accordion-item headline="A" icon="info">Body</md-accordion-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="leading-icon"]') as HTMLSlotElement | null;
      expect(slot).toBeTruthy();
      // Stub `assignedElements()` so the slotchange handler sees content.
      // mock-doc returns an empty list by default; we force a non-empty
      // result to exercise the setter branch.
      Object.defineProperty(slot!, 'assignedElements', {
        configurable: true,
        value: () => [page.doc.createElement('svg')],
      });
      slot!.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      expect(page.rootInstance.hasSlottedLeadingIcon).toBe(true);
    });
  });

  // ─── Toggle behaviour ─────────────────────────────────

  describe('toggle behaviour', () => {
    it('clicking the header toggles expanded → true', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]') as HTMLElement;
      btn?.click();
      await page.waitForChanges();
      expect(page.rootInstance.expanded).toBe(true);
    });

    it('clicking the header again toggles expanded → false', async () => {
      const page = await create('<md-accordion-item headline="A" expanded>Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]') as HTMLElement;
      btn?.click();
      await page.waitForChanges();
      expect(page.rootInstance.expanded).toBe(false);
    });

    it('clicking is a no-op when disabled', async () => {
      const page = await create('<md-accordion-item headline="A" disabled>Body</md-accordion-item>');
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]') as HTMLElement;
      btn?.click();
      await page.waitForChanges();
      expect(page.rootInstance.expanded).toBe(false);
    });

    it('clicking does not collapse when expanded + collapsible=false', async () => {
      const page = await create('<md-accordion-item headline="A" expanded>Body</md-accordion-item>');
      page.rootInstance.collapsible = false;
      await page.waitForChanges();
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]') as HTMLElement;
      btn?.click();
      await page.waitForChanges();
      expect(page.rootInstance.expanded).toBe(true);
    });

    it('clicking on a drag-handle does not propagate to the header', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const handle = page.root?.shadowRoot?.querySelector('[part="drag-handle"]') as HTMLElement;
      const startExpanded = page.rootInstance.expanded;
      handle?.click();
      await page.waitForChanges();
      expect(page.rootInstance.expanded).toBe(startExpanded);
    });
  });

  // ─── Events ───────────────────────────────────────────

  describe('events', () => {
    it('emits mdItemToggle when expanded changes', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemToggle', spy);
      page.rootInstance.expanded = true;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail.expanded).toBe(true);
    });

    it('mdItemToggle carries the data-index when assigned', async () => {
      const page = await create('<md-accordion-item headline="A" data-index="2">Body</md-accordion-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemToggle', spy);
      page.rootInstance.expanded = true;
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail.index).toBe(2);
    });

    it('mdItemToggle index is -1 when no data-index is assigned', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemToggle', spy);
      page.rootInstance.expanded = true;
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail.index).toBe(-1);
    });
  });

  // ─── Keyboard ─────────────────────────────────────────

  describe('keyboard', () => {
    async function pressOnHeader(html: string, init: KeyboardEventInit) {
      const page = await create(html);
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      btn?.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true }));
      await page.waitForChanges();
      return page;
    }

    it('Enter toggles when collapsed', async () => {
      const page = await pressOnHeader('<md-accordion-item headline="A">Body</md-accordion-item>', { key: 'Enter' });
      expect(page.rootInstance.expanded).toBe(true);
    });

    it('Space toggles when collapsed', async () => {
      const page = await pressOnHeader('<md-accordion-item headline="A">Body</md-accordion-item>', { key: ' ' });
      expect(page.rootInstance.expanded).toBe(true);
    });

    it('Enter is a no-op when disabled', async () => {
      const page = await pressOnHeader('<md-accordion-item headline="A" disabled>Body</md-accordion-item>', { key: 'Enter' });
      expect(page.rootInstance.expanded).toBe(false);
    });

    it('Enter does not collapse when expanded + collapsible=false', async () => {
      const page = await create('<md-accordion-item headline="A" expanded>Body</md-accordion-item>');
      page.rootInstance.collapsible = false;
      await page.waitForChanges();
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      btn?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.expanded).toBe(true);
    });

    it.each([
      ['ArrowDown', 'next'],
      ['ArrowUp', 'prev'],
      ['Home', 'first'],
      ['End', 'last'],
    ] as const)('%s emits mdItemRequestFocus with direction=%s', async (key, direction) => {
      const page = await create('<md-accordion-item headline="A" data-index="0">Body</md-accordion-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemRequestFocus', spy);
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      btn?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.direction).toBe(direction);
    });

    it.each([
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
    ] as const)('Alt+%s emits mdItemRequestReorder with direction=%s', async (key, direction) => {
      const page = await create('<md-accordion-item headline="A" data-index="1">Body</md-accordion-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdItemRequestReorder', spy);
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      btn?.dispatchEvent(
        new KeyboardEvent('keydown', { key, altKey: true, bubbles: true, composed: true }),
      );
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.direction).toBe(direction);
    });

    it('keyboard is a no-op when disabled', async () => {
      const page = await create('<md-accordion-item headline="A" disabled data-index="0">Body</md-accordion-item>');
      const focusSpy = jest.fn();
      const reorderSpy = jest.fn();
      page.root?.addEventListener('mdItemRequestFocus', focusSpy);
      page.root?.addEventListener('mdItemRequestReorder', reorderSpy);
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]');
      btn?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
      btn?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, composed: true }));
      await page.waitForChanges();
      expect(focusSpy).not.toHaveBeenCalled();
      expect(reorderSpy).not.toHaveBeenCalled();
    });

    it('drag-handle absorbs keydown so it does not toggle', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      const handle = page.root?.shadowRoot?.querySelector('[part="drag-handle"]');
      handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      // No assertion on expanded — what we're verifying is the bubbling
      // is stopped so the header keydown handler never runs.
      expect(page.rootInstance.expanded).toBe(false);
    });
  });

  // ─── Public methods ───────────────────────────────────

  describe('methods', () => {
    it('toggle() flips expanded', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      await page.rootInstance.toggle();
      expect(page.rootInstance.expanded).toBe(true);
      await page.rootInstance.toggle();
      expect(page.rootInstance.expanded).toBe(false);
    });

    it('toggle() is a no-op when disabled', async () => {
      const page = await create('<md-accordion-item headline="A" disabled>Body</md-accordion-item>');
      await page.rootInstance.toggle();
      expect(page.rootInstance.expanded).toBe(false);
    });

    it('focusHeader() invokes focus() on the header button', async () => {
      const page = await create('<md-accordion-item headline="A">Body</md-accordion-item>');
      // mock-doc doesn't actually move focus, but we can spy on the
      // button to confirm `focus()` was invoked on the right element.
      const btn = page.root?.shadowRoot?.querySelector('[part="header"]') as HTMLElement;
      const focusSpy = jest.spyOn(btn, 'focus');
      await page.rootInstance.focusHeader();
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  // ─── RTL ───────────────────────────────────────────────

  describe('RTL', () => {
    it('renders inside a dir="rtl" parent', async () => {
      const page = await newSpecPage({
        components: [MdAccordionItem],
        html: '<div dir="rtl"><md-accordion-item headline="حساب">محتوى</md-accordion-item></div>',
      });
      const item = page.body.querySelector('md-accordion-item');
      expect(item).toBeTruthy();
      const headline = item?.shadowRoot?.querySelector('[part="headline"]');
      expect(headline?.textContent).toContain('حساب');
    });
  });
});
