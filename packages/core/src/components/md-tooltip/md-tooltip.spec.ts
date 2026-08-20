import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdTooltip } from './md-tooltip';

describe('md-tooltip', () => {
  async function create(html: string): Promise<SpecPage> {
    return newSpecPage({
      components: [MdTooltip],
      html,
    });
  }

  // ─── Rendering ───────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-tooltip text="Hello"><button>Hover</button></md-tooltip>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-tooltip-wrapper');
    });

    it('renders plain variant by default', async () => {
      const page = await create('<md-tooltip text="Tip"><button>Hover</button></md-tooltip>');
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup');
      expect(popup).toHaveClass('md-tooltip__popup--plain');
    });

    it('renders rich variant', async () => {
      const page = await create('<md-tooltip variant="rich" text="Details"><button>Hover</button></md-tooltip>');
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup');
      expect(popup).toHaveClass('md-tooltip__popup--rich');
    });

    it('renders plain tooltip text', async () => {
      const page = await create('<md-tooltip text="Save file"><button>Save</button></md-tooltip>');
      const textEl = page.root?.shadowRoot?.querySelector('.md-tooltip__text');
      expect(textEl?.textContent).toBe('Save file');
    });

    it('renders rich subhead and supporting text', async () => {
      const page = await create(
        '<md-tooltip variant="rich" subhead="Feature" text="Description"><button>Info</button></md-tooltip>',
      );
      const subhead = page.root?.shadowRoot?.querySelector('.md-tooltip__subhead');
      const text = page.root?.shadowRoot?.querySelector('.md-tooltip__supporting-text');
      expect(subhead?.textContent).toBe('Feature');
      expect(text?.textContent).toBe('Description');
    });

    it('renders rich tooltip without subhead', async () => {
      const page = await create(
        '<md-tooltip variant="rich" text="Just text"><button>Info</button></md-tooltip>',
      );
      const subhead = page.root?.shadowRoot?.querySelector('.md-tooltip__subhead');
      expect(subhead).toBeNull();
    });
  });

  // ─── Props ───────────────────────────────────────────────

  describe('props', () => {
    it('defaults position to top', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      expect(page.rootInstance.position).toBe('top');
    });

    it('defaults variant to plain', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      expect(page.rootInstance.variant).toBe('plain');
    });

    it('defaults offset to 8', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      expect(page.rootInstance.offset).toBe(8);
    });

    it('defaults autoPosition to true', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      expect(page.rootInstance.autoPosition).toBe(true);
    });

    it('defaults showDelay to 500', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      expect(page.rootInstance.showDelay).toBe(500);
    });

    it('defaults hideDelay to 200', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      expect(page.rootInstance.hideDelay).toBe(200);
    });

    it('accepts custom offset', async () => {
      const page = await create('<md-tooltip text="Tip" offset="16"><button>X</button></md-tooltip>');
      expect(page.rootInstance.offset).toBe(16);
    });

    it('reflects open attribute', async () => {
      const page = await create('<md-tooltip text="Tip" open><button>X</button></md-tooltip>');
      expect(page.root?.hasAttribute('open')).toBe(true);
    });

    it('reflects variant attribute', async () => {
      const page = await create('<md-tooltip variant="rich" text="Tip"><button>X</button></md-tooltip>');
      expect(page.root?.getAttribute('variant')).toBe('rich');
    });
  });

  // ─── Accessibility ──────────────────────────────────────

  describe('accessibility', () => {
    it('has role="tooltip" on popup', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup');
      expect(popup?.getAttribute('role')).toBe('tooltip');
    });

    it('sets aria-hidden="true" when closed', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup');
      expect(popup?.getAttribute('aria-hidden')).toBe('true');
    });

    it('sets aria-hidden="false" when open', async () => {
      const page = await create('<md-tooltip text="Tip" open><button>X</button></md-tooltip>');
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup');
      expect(popup?.getAttribute('aria-hidden')).toBe('false');
    });

    it('has unique id on popup', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup');
      expect(popup?.id).toMatch(/^md-tooltip-/);
    });

    it('does not use aria-describedby (broken cross shadow DOM)', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      const trigger = page.root?.querySelector('button');
      expect(trigger?.hasAttribute('aria-describedby')).toBe(false);
    });

    it('focus stays on trigger while tooltip is displayed', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup');
      expect(popup?.getAttribute('tabindex')).toBeNull();
    });
  });

  // ─── Events ─────────────────────────────────────────────

  describe('events', () => {
    it('emits mdOpen when opened programmatically', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);
      page.rootInstance.open = true;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdClose when closed programmatically', async () => {
      const page = await create('<md-tooltip text="Tip" open><button>X</button></md-tooltip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);
      page.rootInstance.open = false;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('mdOpen does not bubble to parent elements', async () => {
      const page = await newSpecPage({
        components: [MdTooltip],
        html: '<div id="host"><md-tooltip text="Tip"><button>X</button></md-tooltip></div>',
      });
      const parentSpy = jest.fn();
      page.body.querySelector('#host')?.addEventListener('mdOpen', parentSpy);
      page.rootInstance.open = true;
      await page.waitForChanges();
      expect(parentSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Methods ────────────────────────────────────────────

  describe('methods', () => {
    it('show() sets open to true', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      await page.rootInstance.show();
      expect(page.rootInstance.open).toBe(true);
    });

    it('hide() sets open to false', async () => {
      const page = await create('<md-tooltip text="Tip" open><button>X</button></md-tooltip>');
      await page.rootInstance.hide();
      expect(page.rootInstance.open).toBe(false);
    });
  });

  // ─── Parts ──────────────────────────────────────────────

  describe('parts', () => {
    it('exposes popup part', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      expect(page.root?.shadowRoot?.querySelector('[part="popup"]')).toBeTruthy();
    });

    it('exposes text part on plain tooltip', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      expect(page.root?.shadowRoot?.querySelector('[part="text"]')).toBeTruthy();
    });

    it('exposes subhead part on rich tooltip', async () => {
      const page = await create(
        '<md-tooltip variant="rich" subhead="Head" text="Tip"><button>X</button></md-tooltip>',
      );
      expect(page.root?.shadowRoot?.querySelector('[part="subhead"]')).toBeTruthy();
    });

    it('exposes supporting-text part on rich tooltip', async () => {
      const page = await create(
        '<md-tooltip variant="rich" text="Tip"><button>X</button></md-tooltip>',
      );
      expect(page.root?.shadowRoot?.querySelector('[part="supporting-text"]')).toBeTruthy();
    });

    it('exposes actions part on rich tooltip', async () => {
      const page = await create(
        '<md-tooltip variant="rich" text="Tip"><button>X</button></md-tooltip>',
      );
      expect(page.root?.shadowRoot?.querySelector('[part="actions"]')).toBeTruthy();
    });
  });

  // ─── Slots ──────────────────────────────────────────────

  describe('slots', () => {
    it('renders default slot (trigger)', async () => {
      const page = await create('<md-tooltip text="Tip"><button>Trigger</button></md-tooltip>');
      expect(page.root?.querySelector('button')?.textContent).toBe('Trigger');
    });

    it('renders content slot in rich tooltip', async () => {
      const page = await create(
        '<md-tooltip variant="rich"><button>Info</button><span slot="content">Content here</span></md-tooltip>',
      );
      const contentSlot = page.root?.shadowRoot?.querySelector('slot[name="content"]');
      expect(contentSlot).toBeTruthy();
    });

    it('renders subhead slot in rich tooltip', async () => {
      const page = await create(
        '<md-tooltip variant="rich" subhead="Head"><button>Info</button><span slot="subhead">My Head</span></md-tooltip>',
      );
      const subheadSlot = page.root?.shadowRoot?.querySelector('slot[name="subhead"]');
      expect(subheadSlot).toBeTruthy();
    });

    it('renders actions slot in rich tooltip', async () => {
      const page = await create(
        '<md-tooltip variant="rich"><button>Info</button><div slot="actions"><button>Learn</button></div></md-tooltip>',
      );
      const actionsSlot = page.root?.shadowRoot?.querySelector('slot[name="actions"]');
      expect(actionsSlot).toBeTruthy();
    });
  });

  // ─── Rich Configurations ────────────────────────────────

  describe('rich configurations', () => {
    it('subhead + text + actions (2 buttons)', async () => {
      const page = await create(
        `<md-tooltip variant="rich" subhead="Title" text="Description">
          <button>Trigger</button>
          <div slot="actions"><button>Learn</button><button>Got it</button></div>
        </md-tooltip>`,
      );
      expect(page.root?.shadowRoot?.querySelector('.md-tooltip__subhead')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('.md-tooltip__supporting-text')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('.md-tooltip__actions')).toBeTruthy();
    });

    it('text only (no subhead, no actions)', async () => {
      const page = await create(
        '<md-tooltip variant="rich" text="Just text"><button>Trigger</button></md-tooltip>',
      );
      expect(page.root?.shadowRoot?.querySelector('.md-tooltip__subhead')).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('.md-tooltip__supporting-text')).toBeTruthy();
    });

    it('subhead + text (no actions)', async () => {
      const page = await create(
        '<md-tooltip variant="rich" subhead="Head" text="Text"><button>Trigger</button></md-tooltip>',
      );
      expect(page.root?.shadowRoot?.querySelector('.md-tooltip__subhead')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('.md-tooltip__actions--empty')).toBeTruthy();
    });
  });

  // ─── RTL ────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdTooltip],
        html: '<div dir="rtl"><md-tooltip text="Tip"><button>X</button></md-tooltip></div>',
      });
      expect(page.root).toBeTruthy();
    });
  });

  // ─── Keyboard ───────────────────────────────────────────

  describe('keyboard', () => {
    it('closes on Escape when visible', async () => {
      const page = await create('<md-tooltip text="Tip" open><button>X</button></md-tooltip>');
      const trigger = page.root?.querySelector('button');
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });
  });

  // ─── Positioning ────────────────────────────────────────

  describe('positioning', () => {
    it('uses fixed viewport coordinates when open', async () => {
      const page = await create('<md-tooltip text="Tip" open><button>X</button></md-tooltip>');
      const trigger = page.root?.querySelector('button') as HTMLElement;
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup') as HTMLElement;

      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 200,
        width: 48,
        height: 32,
        right: 248,
        bottom: 132,
        x: 200,
        y: 100,
        toJSON: () => ({}),
      } as DOMRect);

      Object.defineProperty(popup, 'offsetWidth', { configurable: true, value: 80 });
      Object.defineProperty(popup, 'offsetHeight', { configurable: true, value: 24 });

      page.rootInstance.open = true;
      await page.waitForChanges();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await page.waitForChanges();

      // top placement: triggerRect.top + (-(popupH + offset)) = 100 - (24 + 8) = 68
      expect(popup.style.top).toBe('68px');
      // centered: triggerRect.left + (triggerW - popupW) / 2 = 200 + (48 - 80) / 2 = 184
      expect(popup.style.left).toBe('184px');
    });

    it('adjusts fixed coords when a transform ancestor creates a containing block', async () => {
      const page = await newSpecPage({
        components: [MdTooltip],
        html: `
          <div id="panel" style="transform: translateY(0) scale(1)">
            <md-tooltip text="Tip" open><button>X</button></md-tooltip>
          </div>
        `,
      });

      const panel = page.body.querySelector('#panel') as HTMLElement;
      const trigger = page.root?.querySelector('button') as HTMLElement;
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup') as HTMLElement;

      // mock-doc's getComputedStyle returns '' for every property (it does not
      // reflect inline styles), so mock it explicitly: the panel is transformed,
      // everything else gets real browser-like defaults. Previously this test only
      // passed because '' !== 'none' made the FIRST ancestor match accidentally.
      const styleFor = (transform: string) =>
        ({
          transform,
          filter: 'none',
          perspective: 'none',
          backdropFilter: 'none',
          willChange: 'auto',
          contain: 'none',
          contentVisibility: 'visible',
          containerType: 'normal',
          direction: 'ltr',
          display: 'block',
          visibility: 'visible',
        }) as unknown as CSSStyleDeclaration;
      const gcsSpy = jest
        .spyOn(globalThis as any, 'getComputedStyle')
        .mockImplementation(((el: Element) => styleFor(el === panel ? 'matrix(1, 0, 0, 1, 0, 0)' : 'none')) as never);

      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 200,
        width: 48,
        height: 32,
        right: 248,
        bottom: 132,
        x: 200,
        y: 100,
        toJSON: () => ({}),
      } as DOMRect);

      jest.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
        top: 40,
        left: 60,
        width: 320,
        height: 400,
        right: 380,
        bottom: 440,
        x: 60,
        y: 40,
        toJSON: () => ({}),
      } as DOMRect);

      Object.defineProperty(popup, 'offsetWidth', { configurable: true, value: 80 });
      Object.defineProperty(popup, 'offsetHeight', { configurable: true, value: 24 });

      page.rootInstance.open = true;
      await page.waitForChanges();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await page.waitForChanges();

      // viewport top 68 minus containing block top 40
      expect(popup.style.top).toBe('28px');
      // viewport left 184 minus containing block left 60
      expect(popup.style.left).toBe('124px');

      gcsSpy.mockRestore(); // window-level spy would leak into later tests
    });

    it('detects a will-change:transform ancestor as the fixed containing block', async () => {
      const page = await newSpecPage({
        components: [MdTooltip],
        html: `
          <div id="wc-panel">
            <md-tooltip text="Tip" open><button>X</button></md-tooltip>
          </div>
        `,
      });
      const panel = page.body.querySelector('#wc-panel') as HTMLElement;
      const trigger = page.root?.querySelector('button') as HTMLElement;
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup') as HTMLElement;

      const styleFor = (willChange: string) =>
        ({
          transform: 'none',
          filter: 'none',
          perspective: 'none',
          backdropFilter: 'none',
          willChange,
          contain: 'none',
          contentVisibility: 'visible',
          containerType: 'normal',
          direction: 'ltr',
          display: 'block',
          visibility: 'visible',
        }) as unknown as CSSStyleDeclaration;
      const gcsSpy = jest
        .spyOn(globalThis as any, 'getComputedStyle')
        .mockImplementation(((el: Element) => styleFor(el === panel ? 'transform' : 'auto')) as never);

      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top: 100, left: 200, width: 48, height: 32, right: 248, bottom: 132, x: 200, y: 100, toJSON: () => ({}),
      } as DOMRect);
      jest.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
        top: 40, left: 60, width: 320, height: 400, right: 380, bottom: 440, x: 60, y: 40, toJSON: () => ({}),
      } as DOMRect);
      Object.defineProperty(popup, 'offsetWidth', { configurable: true, value: 80 });
      Object.defineProperty(popup, 'offsetHeight', { configurable: true, value: 24 });

      page.rootInstance.open = true;
      await page.waitForChanges();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await page.waitForChanges();

      // will-change: transform creates a fixed containing block (md-list-item's
      // --shifting state uses it) — coords must be panel-relative, same math as
      // a real transform: top 68-40, left 184-60.
      expect(popup.style.top).toBe('28px');
      expect(popup.style.left).toBe('124px');

      gcsSpy.mockRestore();
    });

    it('does NOT treat a container-type: scroll-state ancestor as a containing block', async () => {
      const page = await newSpecPage({
        components: [MdTooltip],
        html: `
          <div id="ss-panel">
            <md-tooltip text="Tip" open><button>X</button></md-tooltip>
          </div>
        `,
      });
      const panel = page.body.querySelector('#ss-panel') as HTMLElement;
      const trigger = page.root?.querySelector('button') as HTMLElement;
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup') as HTMLElement;

      const styleFor = (containerType: string) =>
        ({
          transform: 'none', filter: 'none', perspective: 'none', backdropFilter: 'none',
          translate: 'none', rotate: 'none', scale: 'none',
          willChange: 'auto', contain: 'none', contentVisibility: 'visible', containerType,
          direction: 'ltr', display: 'block', visibility: 'visible',
        }) as unknown as CSSStyleDeclaration;
      const gcsSpy = jest
        .spyOn(globalThis as any, 'getComputedStyle')
        .mockImplementation(((el: Element) => styleFor(el === panel ? 'scroll-state' : 'normal')) as never);

      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top: 100, left: 200, width: 48, height: 32, right: 248, bottom: 132, x: 200, y: 100, toJSON: () => ({}),
      } as DOMRect);
      Object.defineProperty(popup, 'offsetWidth', { configurable: true, value: 80 });
      Object.defineProperty(popup, 'offsetHeight', { configurable: true, value: 24 });

      page.rootInstance.open = true;
      await page.waitForChanges();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await page.waitForChanges();

      // scroll-state query containers apply NO containment — coords stay viewport
      // (top placement: 100 - 24 - 8 = 68; centered: 200 + 24 - 40 = 184).
      expect(popup.style.top).toBe('68px');
      expect(popup.style.left).toBe('184px');

      gcsSpy.mockRestore();
    });

    it('RTL keeps -start/-end block-axis alignment for left/right placements (only the side flips)', async () => {
      const page = await newSpecPage({
        components: [MdTooltip],
        html: '<div dir="rtl"><md-tooltip text="Tip" position="left-start" auto-position="false" open><button>X</button></md-tooltip></div>',
      });
      const trigger = page.root?.querySelector('button') as HTMLElement;
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup') as HTMLElement;

      const styleFor = () =>
        ({
          transform: 'none', filter: 'none', perspective: 'none', backdropFilter: 'none',
          willChange: 'auto', contain: 'none', contentVisibility: 'visible', containerType: 'normal',
          direction: 'rtl', display: 'block', visibility: 'visible',
        }) as unknown as CSSStyleDeclaration;
      const gcsSpy = jest.spyOn(globalThis as any, 'getComputedStyle').mockImplementation((() => styleFor()) as never);

      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top: 100, left: 200, width: 48, height: 32, right: 248, bottom: 132, x: 200, y: 100, toJSON: () => ({}),
      } as DOMRect);
      Object.defineProperty(popup, 'offsetWidth', { configurable: true, value: 80 });
      Object.defineProperty(popup, 'offsetHeight', { configurable: true, value: 24 });

      page.rootInstance.open = true;
      await page.waitForChanges();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await page.waitForChanges();

      // left-start in RTL: the SIDE mirrors (left → physical right: 200+48+8=256),
      // but -start stays TOP-aligned (block axis does not mirror): top = 100.
      // The old swap produced right-end (top 100+32-24=108) — bottom-aligned, wrong.
      expect(popup.style.left).toBe('256px');
      expect(popup.style.top).toBe('100px');

      gcsSpy.mockRestore();
    });

    it('centers bottom tooltip under trigger in RTL using physical left', async () => {
      const page = await newSpecPage({
        components: [MdTooltip],
        html: '<div dir="rtl"><md-tooltip text="Tip" position="bottom" open><button>X</button></md-tooltip></div>',
      });

      const trigger = page.root?.querySelector('button') as HTMLElement;
      const popup = page.root?.shadowRoot?.querySelector('.md-tooltip__popup') as HTMLElement;

      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 200,
        width: 48,
        height: 32,
        right: 248,
        bottom: 132,
        x: 200,
        y: 100,
        toJSON: () => ({}),
      } as DOMRect);

      Object.defineProperty(popup, 'offsetWidth', { configurable: true, value: 80 });
      Object.defineProperty(popup, 'offsetHeight', { configurable: true, value: 24 });

      page.rootInstance.open = true;
      await page.waitForChanges();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await page.waitForChanges();

      // bottom placement: triggerRect.top + triggerH + offset = 100 + 32 + 8 = 140
      expect(popup.style.top).toBe('140px');
      // centered under trigger — same physical left as LTR
      expect(popup.style.left).toBe('184px');
      expect(popup.style.insetInlineStart).toBe('');
    });
  });

  describe('presentational triggers', () => {
    it('opens on host mouseenter for non-interactive span triggers', async () => {
      const page = await create('<md-tooltip text="Sunday" show-delay="0"><span>S</span></md-tooltip>');
      const host = page.root as HTMLElement;

      host.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.waitForChanges();

      expect(page.rootInstance.open).toBe(true);
    });
  });

  // ─── Cleanup ────────────────────────────────────────────

  describe('cleanup', () => {
    it('clears timers on disconnect', async () => {
      const page = await create('<md-tooltip text="Tip"><button>X</button></md-tooltip>');
      page.root?.remove();
      await page.waitForChanges();
    });
  });
});
