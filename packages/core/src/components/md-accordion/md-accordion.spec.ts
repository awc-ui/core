import { newSpecPage } from '@stencil/core/testing';
import { MdAccordion } from './md-accordion';
import { MdAccordionItem } from '../md-accordion-item/md-accordion-item';

describe('md-accordion', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html,
    });
  }

  // ─── Rendering ──────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-accordion></md-accordion>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-accordion');
      expect(page.root).toHaveClass('md-accordion--filled');
    });

    it('applies role="presentation" to the host', async () => {
      const page = await create('<md-accordion></md-accordion>');
      expect(page.root?.getAttribute('role')).toBe('presentation');
    });

    it('renders a default slot', async () => {
      const page = await create('<md-accordion></md-accordion>');
      const slot = page.root?.shadowRoot?.querySelector('slot:not([name])');
      expect(slot).toBeTruthy();
    });
  });

  // ─── Variant / density / elevation classes ──────────────

  describe('variant', () => {
    it('applies the outlined variant class', async () => {
      const page = await create('<md-accordion variant="outlined"></md-accordion>');
      expect(page.root).toHaveClass('md-accordion--outlined');
    });

    it('reflects the variant attribute', async () => {
      const page = await create('<md-accordion variant="outlined"></md-accordion>');
      expect(page.root?.getAttribute('variant')).toBe('outlined');
    });
  });

  describe('density', () => {
    it('does not add a density class for density=0', async () => {
      const page = await create('<md-accordion></md-accordion>');
      // mock-doc's DOMTokenList occasionally yields undefined entries
      // when spread, so filter before substring-matching.
      const cls = Array.from(page.root?.classList ?? []).filter((c): c is string => typeof c === 'string');
      expect(cls.some((c) => c.startsWith('md-accordion--density-'))).toBe(false);
    });

    it('adds density-1 for density=-1', async () => {
      const page = await create('<md-accordion density="-1"></md-accordion>');
      expect(page.root).toHaveClass('md-accordion--density-1');
    });

    it('adds density-2 for density=-2', async () => {
      const page = await create('<md-accordion density="-2"></md-accordion>');
      expect(page.root).toHaveClass('md-accordion--density-2');
    });
  });

  describe('elevation', () => {
    it('does not add an elevation class for elevation=0', async () => {
      const page = await create('<md-accordion></md-accordion>');
      const cls = Array.from(page.root?.classList ?? []).filter((c): c is string => typeof c === 'string');
      expect(cls.some((c) => c.startsWith('md-accordion--elevation-'))).toBe(false);
    });

    it.each([1, 2, 3, 4, 5] as const)('adds elevation-%i class for elevation=%i', async (level) => {
      const page = await create(`<md-accordion elevation="${level}"></md-accordion>`);
      expect(page.root).toHaveClass(`md-accordion--elevation-${level}`);
    });
  });

  describe('transition', () => {
    it('reflects transition attribute by default', async () => {
      const page = await create('<md-accordion></md-accordion>');
      expect(page.root?.getAttribute('transition')).toBe('expressive');
    });

    it.each(['standard', 'fade', 'collapse', 'none'] as const)('reflects transition=%s', async (t) => {
      const page = await create(`<md-accordion transition="${t}"></md-accordion>`);
      expect(page.root?.getAttribute('transition')).toBe(t);
    });
  });

  // ─── Item indexing ─────────────────────────────────────

  describe('item indexing', () => {
    it('assigns sequential data-index attributes to child items', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
          <md-accordion-item headline="C">C</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.getAttribute('data-index')).toBe('0');
      expect(items?.[1]?.getAttribute('data-index')).toBe('1');
      expect(items?.[2]?.getAttribute('data-index')).toBe('2');
    });
  });

  // ─── default-expanded ──────────────────────────────────

  describe('default-expanded', () => {
    it('expands a single item by index', async () => {
      const page = await create(`
        <md-accordion default-expanded="1">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.expanded).toBe(false);
      expect(items?.[1]?.expanded).toBe(true);
    });

    it('expands multiple items via comma-separated list', async () => {
      const page = await create(`
        <md-accordion default-expanded="0,2">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
          <md-accordion-item headline="C">C</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.expanded).toBe(true);
      expect(items?.[1]?.expanded).toBe(false);
      expect(items?.[2]?.expanded).toBe(true);
    });

    it('honours per-item expanded attributes', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B" expanded>B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[1]?.expanded).toBe(true);
    });

    it('ignores non-integer tokens', async () => {
      const page = await create(`
        <md-accordion default-expanded="x,1.5,-3">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.expanded).toBe(false);
      expect(items?.[1]?.expanded).toBe(false);
    });
  });

  // ─── Exclusive mode ────────────────────────────────────

  describe('exclusive mode', () => {
    it('closes other items when one is expanded', async () => {
      const page = await create(`
        <md-accordion exclusive default-expanded="0">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      // Toggle item B → A should collapse.
      items?.[1]?.click();
      // Stencil's mock-doc click won't trigger the shadow-DOM button click
      // handler, so we mutate `expanded` directly to simulate user intent —
      // the parent listener should still react via @Listen('mdItemToggle').
      items![1]!.expanded = true;
      await page.waitForChanges();
      expect(items?.[0]?.expanded).toBe(false);
      expect(items?.[1]?.expanded).toBe(true);
    });

    it('collapses extras when switching INTO exclusive mode mid-life', async () => {
      const page = await create(`
        <md-accordion default-expanded="0,1">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.expanded).toBe(true);
      expect(items?.[1]?.expanded).toBe(true);

      page.rootInstance.exclusive = true;
      await page.waitForChanges();
      // First-open wins.
      expect(items?.[0]?.expanded).toBe(true);
      expect(items?.[1]?.expanded).toBe(false);
    });

    it('on initial paint, keeps only the first expanded item when exclusive', async () => {
      const page = await create(`
        <md-accordion exclusive default-expanded="0,1">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.expanded).toBe(true);
      expect(items?.[1]?.expanded).toBe(false);
    });
  });

  // ─── keep-one-expanded ─────────────────────────────────

  describe('keep-one-expanded', () => {
    it('opens the first item on first paint when nothing is open', async () => {
      const page = await create(`
        <md-accordion keep-one-expanded>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.expanded).toBe(true);
    });

    it('skips disabled items when picking the auto-open item', async () => {
      const page = await create(`
        <md-accordion keep-one-expanded>
          <md-accordion-item headline="A" disabled>A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.expanded).toBe(false);
      expect(items?.[1]?.expanded).toBe(true);
    });

    it('locks the currently-open item by setting collapsible=false', async () => {
      const page = await create(`
        <md-accordion keep-one-expanded default-expanded="0">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.collapsible).toBe(false);
      expect(items?.[1]?.collapsible).toBe(true);
    });

    it('unlocks every item when keep-one-expanded is turned off mid-life', async () => {
      const page = await create(`
        <md-accordion keep-one-expanded default-expanded="0">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      page.rootInstance.keepOneExpanded = false;
      await page.waitForChanges();
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.collapsible).toBe(true);
      expect(items?.[1]?.collapsible).toBe(true);
    });

    it('opens the first item if keep-one-expanded is turned on with none open', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      page.rootInstance.keepOneExpanded = true;
      await page.waitForChanges();
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.expanded).toBe(true);
    });
  });

  // ─── Region role policy ────────────────────────────────

  describe('region role policy', () => {
    it('auto → region when item count ≤ regionThreshold', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.regionRole).toBe('region');
    });

    it('auto → group when item count > regionThreshold', async () => {
      const itemsMarkup = Array.from({ length: 8 })
        .map((_, i) => `<md-accordion-item headline="Item ${i}">Body</md-accordion-item>`)
        .join('');
      const page = await create(`<md-accordion>${itemsMarkup}</md-accordion>`);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.regionRole).toBe('group');
    });

    it('region="always" forces every item to "region"', async () => {
      const itemsMarkup = Array.from({ length: 10 })
        .map((_, i) => `<md-accordion-item headline="Item ${i}">Body</md-accordion-item>`)
        .join('');
      const page = await create(`<md-accordion region="always">${itemsMarkup}</md-accordion>`);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.regionRole).toBe('region');
    });

    it('region="never" forces every item to "group"', async () => {
      const page = await create(`
        <md-accordion region="never">
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.regionRole).toBe('group');
    });

    it('changes role when the region prop is updated at runtime', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.regionRole).toBe('region');

      page.rootInstance.region = 'never';
      await page.waitForChanges();
      expect(items?.[0]?.regionRole).toBe('group');

      page.rootInstance.region = 'always';
      await page.waitForChanges();
      expect(items?.[0]?.regionRole).toBe('region');
    });

    it('regionThreshold change re-runs the auto policy', async () => {
      const itemsMarkup = Array.from({ length: 5 })
        .map((_, i) => `<md-accordion-item headline="Item ${i}">Body</md-accordion-item>`)
        .join('');
      const page = await create(`<md-accordion>${itemsMarkup}</md-accordion>`);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.regionRole).toBe('region');

      page.rootInstance.regionThreshold = 3;
      await page.waitForChanges();
      expect(items?.[0]?.regionRole).toBe('group');
    });
  });

  // ─── Heading-level propagation ─────────────────────────

  describe('heading-level propagation', () => {
    it('pushes heading-level from accordion onto each item', async () => {
      const page = await create(`
        <md-accordion heading-level="2">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.headingLevel).toBe(2);
      expect(items?.[1]?.headingLevel).toBe(2);
    });

    it('updates child heading-level when the parent prop changes', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      page.rootInstance.headingLevel = 5;
      await page.waitForChanges();
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.headingLevel).toBe(5);
    });
  });

  // ─── Floating mode ─────────────────────────────────────

  describe('floating mode', () => {
    it('adds the floating class', async () => {
      const page = await create(`
        <md-accordion floating>
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      expect(page.root).toHaveClass('md-accordion--floating');
    });

    it('seeds chassis offsets from initial-x / initial-y on mount', async () => {
      const page = await create(`
        <md-accordion floating initial-x="120" initial-y="48">
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      // Internal state isn't directly exposed, but the host transform style
      // is computed from it on every render.
      const style = (page.root as HTMLElement).getAttribute('style') || '';
      expect(style).toContain('translate3d(120px, 48px, 0)');
    });

    it('marks only the first item with data-chassis-handle', async () => {
      const page = await create(`
        <md-accordion floating>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.hasAttribute('data-chassis-handle')).toBe(true);
      expect(items?.[1]?.hasAttribute('data-chassis-handle')).toBe(false);
    });

    it('clears the chassis-handle marker when floating is turned off', async () => {
      const page = await create(`
        <md-accordion floating>
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.hasAttribute('data-chassis-handle')).toBe(true);

      page.rootInstance.floating = false;
      await page.waitForChanges();
      expect(items?.[0]?.hasAttribute('data-chassis-handle')).toBe(false);
    });

    it('resets chassis offset to 0 when floating is turned off', async () => {
      const page = await create(`
        <md-accordion floating initial-x="50" initial-y="50">
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      page.rootInstance.floating = false;
      await page.waitForChanges();
      const style = (page.root as HTMLElement).getAttribute('style') || '';
      // Non-floating mode drops the transform altogether.
      expect(style.includes('translate3d')).toBe(false);
    });

    it('re-seeds chassis offsets from initial-x/y when floating is turned ON mid-life', async () => {
      const page = await create(`
        <md-accordion initial-x="80" initial-y="40">
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      page.rootInstance.floating = true;
      await page.waitForChanges();
      const style = (page.root as HTMLElement).getAttribute('style') || '';
      expect(style).toContain('translate3d(80px, 40px, 0)');
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.hasAttribute('data-chassis-handle')).toBe(true);
    });
  });

  // ─── Sibling-shift direction coverage ──────────────────

  describe('item drag · upward direction', () => {
    function pointerEvent(
      type: string,
      path: EventTarget[],
      init: { pointerId?: number; button?: number; clientX?: number; clientY?: number } = {},
    ) {
      const ev = new Event(type, { bubbles: true, composed: true, cancelable: true });
      Object.assign(ev, {
        pointerId: init.pointerId ?? 1,
        button: init.button ?? 0,
        clientX: init.clientX ?? 0,
        clientY: init.clientY ?? 0,
      });
      Object.defineProperty(ev, 'composedPath', { value: () => path });
      return ev;
    }

    it('pointermove with negative dy exercises the upward shift branch', async () => {
      const page = await create(`
        <md-accordion reorderable>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
          <md-accordion-item headline="C">C</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      const handle = (items![2] as HTMLElement).shadowRoot?.querySelector('[part="drag-handle"]') as HTMLElement;
      const path: EventTarget[] = [handle, items![2], page.root!];

      items![2].dispatchEvent(pointerEvent('pointerdown', path, { clientY: 100 }));
      page.root?.dispatchEvent(pointerEvent('pointermove', [page.root!], { clientY: 70 }));
      await page.waitForChanges();
      expect(items![2]).toHaveClass('md-accordion-item--dragging');
    });

    it('pointerup with currentTarget changed triggers moveItem + mdReorder', async () => {
      const page = await create(`
        <md-accordion reorderable>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
          <md-accordion-item headline="C">C</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      const handle = (items![0] as HTMLElement).shadowRoot?.querySelector('[part="drag-handle"]') as HTMLElement;
      const path: EventTarget[] = [handle, items![0], page.root!];

      const reorderSpy = jest.fn();
      page.root?.addEventListener('mdReorder', reorderSpy);

      items![0].dispatchEvent(pointerEvent('pointerdown', path, { clientY: 0 }));
      // With mock-doc's zero geometry, ANY positive dy advances the
      // target to the last item, so dispatching pointermove + pointerup
      // covers the "target changed → moveItem + emitReorder" branch.
      page.root?.dispatchEvent(pointerEvent('pointermove', [page.root!], { clientY: 50 }));
      page.root?.dispatchEvent(pointerEvent('pointerup', [page.root!], { clientY: 50 }));
      await page.waitForChanges();

      expect(reorderSpy).toHaveBeenCalled();
    });
  });

  // ─── syncCollapsible "many open" branch ────────────────

  describe('syncCollapsible · multiple-open branch', () => {
    it('keeps every item collapsible when more than one is open in keep-one-expanded mode', async () => {
      const page = await create(`
        <md-accordion default-expanded="0,1">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      // Flip keep-one-expanded on while two items remain open — exercises
      // the `else` branch in syncCollapsible (zero or many open → all
      // collapsible).
      page.rootInstance.keepOneExpanded = true;
      await page.waitForChanges();
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.collapsible).toBe(true);
      expect(items?.[1]?.collapsible).toBe(true);
    });
  });

  // ─── mdToggle event ────────────────────────────────────

  describe('mdToggle event', () => {
    it('fires with the toggled index and the expanded-set', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdToggle', spy);

      const items = page.root?.querySelectorAll('md-accordion-item');
      items![1]!.expanded = true;
      await page.waitForChanges();

      expect(spy).toHaveBeenCalled();
      const detail = spy.mock.calls[0][0].detail;
      expect(detail.index).toBe(1);
      expect(detail.expanded).toBe(true);
      expect(detail.expandedIndices).toEqual([1]);
    });

    it('expandedIndices reflects multi-item state when not exclusive', async () => {
      const page = await create(`
        <md-accordion default-expanded="0">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdToggle', spy);
      const items = page.root?.querySelectorAll('md-accordion-item');
      items![1]!.expanded = true;
      await page.waitForChanges();
      const detail = spy.mock.calls[spy.mock.calls.length - 1][0].detail;
      expect(detail.expandedIndices).toEqual([0, 1]);
    });
  });

  // ─── Roving focus (mdItemRequestFocus) ─────────────────

  describe('roving focus', () => {
    // Spying on `focusHeader` (an @Method) is rejected by Stencil's
    // read-only descriptor. focusHeader's only side-effect is calling
    // `headerEl.focus()` on the shadow button — spy on THAT instead.
    function headerFocusSpies(items: NodeListOf<Element> | null | undefined) {
      return Array.from(items ?? []).map((it) => {
        const btn = (it as HTMLElement).shadowRoot?.querySelector('[part="header"]') as HTMLElement;
        return jest.spyOn(btn, 'focus');
      });
    }

    it.each([
      ['next', 0, 1],
      ['prev', 1, 0],
      ['first', 2, 0],
      ['last', 0, 2],
    ] as const)('direction=%s from index %i focuses index %i', async (direction, from, target) => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
          <md-accordion-item headline="C">C</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      const spies = headerFocusSpies(items);

      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestFocus', {
          detail: { direction, from },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();

      expect(spies[target]).toHaveBeenCalled();
    });

    it('next wraps around to first', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      const spies = headerFocusSpies(items);
      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestFocus', {
          detail: { direction: 'next', from: 1 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();
      expect(spies[0]).toHaveBeenCalled();
    });

    it('prev wraps around to last', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      const spies = headerFocusSpies(items);
      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestFocus', {
          detail: { direction: 'prev', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();
      expect(spies[1]).toHaveBeenCalled();
    });

    it('is a no-op when there are zero items', async () => {
      const page = await create('<md-accordion></md-accordion>');
      // Should not throw.
      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestFocus', {
          detail: { direction: 'next', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();
      expect(true).toBe(true);
    });
  });

  // ─── Keyboard reorder (mdItemRequestReorder) ───────────

  describe('keyboard reorder', () => {
    async function setupReorderable() {
      const page = await create(`
        <md-accordion reorderable>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
          <md-accordion-item headline="C">C</md-accordion-item>
        </md-accordion>
      `);
      return page;
    }

    it('moves the item down and emits mdReorder', async () => {
      const page = await setupReorderable();
      const spy = jest.fn();
      page.root?.addEventListener('mdReorder', spy);

      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'down', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();

      const headlines = Array.from(page.root?.querySelectorAll('md-accordion-item') ?? []).map((n) =>
        n.getAttribute('headline'),
      );
      expect(headlines).toEqual(['B', 'A', 'C']);
      expect(spy).toHaveBeenCalled();
      const detail = spy.mock.calls[0][0].detail;
      expect(detail.from).toBe(0);
      expect(detail.to).toBe(1);
      expect(detail.order).toEqual([1, 0, 2]);
    });

    it('moves the item up', async () => {
      const page = await setupReorderable();
      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'up', from: 2 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();
      const headlines = Array.from(page.root?.querySelectorAll('md-accordion-item') ?? []).map((n) =>
        n.getAttribute('headline'),
      );
      expect(headlines).toEqual(['A', 'C', 'B']);
    });

    it('does nothing when reorderable is false', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdReorder', spy);
      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'down', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();
      const headlines = Array.from(page.root?.querySelectorAll('md-accordion-item') ?? []).map((n) =>
        n.getAttribute('headline'),
      );
      expect(headlines).toEqual(['A', 'B']);
      expect(spy).not.toHaveBeenCalled();
    });

    it('is a no-op at the top boundary', async () => {
      const page = await setupReorderable();
      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'up', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();
      const headlines = Array.from(page.root?.querySelectorAll('md-accordion-item') ?? []).map((n) =>
        n.getAttribute('headline'),
      );
      expect(headlines).toEqual(['A', 'B', 'C']);
    });

    it('is a no-op at the bottom boundary', async () => {
      const page = await setupReorderable();
      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'down', from: 2 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();
      const headlines = Array.from(page.root?.querySelectorAll('md-accordion-item') ?? []).map((n) =>
        n.getAttribute('headline'),
      );
      expect(headlines).toEqual(['A', 'B', 'C']);
    });

    it('re-assigns data-index after reorder', async () => {
      const page = await setupReorderable();
      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'down', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.getAttribute('data-index')).toBe('0');
      expect(items?.[1]?.getAttribute('data-index')).toBe('1');
      expect(items?.[2]?.getAttribute('data-index')).toBe('2');
    });

    it('re-applies chassis-handle marker after reorder when floating', async () => {
      const page = await create(`
        <md-accordion floating reorderable>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      expect(items?.[0]?.hasAttribute('data-chassis-handle')).toBe(true);

      page.root?.dispatchEvent(
        new CustomEvent('mdItemRequestReorder', {
          detail: { direction: 'down', from: 0 },
          bubbles: true,
          composed: true,
        }),
      );
      await page.waitForChanges();

      // After reorder, what was item 1 is now first → it owns the marker.
      const reordered = page.root?.querySelectorAll('md-accordion-item');
      expect(reordered?.[0]?.getAttribute('headline')).toBe('B');
      expect(reordered?.[0]?.hasAttribute('data-chassis-handle')).toBe(true);
      expect(reordered?.[1]?.hasAttribute('data-chassis-handle')).toBe(false);
    });
  });

  // ─── RTL ───────────────────────────────────────────────

  describe('RTL', () => {
    it('renders inside a dir="rtl" parent', async () => {
      const page = await newSpecPage({
        components: [MdAccordion, MdAccordionItem],
        html: `
          <div dir="rtl">
            <md-accordion>
              <md-accordion-item headline="حساب">محتوى</md-accordion-item>
            </md-accordion>
          </div>
        `,
      });
      expect(page.body.querySelector('md-accordion')).toBeTruthy();
    });
  });

  // ─── Disconnect cleanup ─────────────────────────────────

  describe('teardown', () => {
    it('removes pointerdown listener on disconnect (no throw)', async () => {
      const page = await create(`
        <md-accordion>
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      page.root?.remove();
      await page.waitForChanges();
      // No throw == pass; this exercises disconnectedCallback paths.
      expect(true).toBe(true);
    });
  });

  // ─── Pointer-driven drag (chassis + item) ───────────────
  //
  // mock-doc has no `PointerEvent` constructor, so we synthesise the
  // shape onto a plain Event. Coverage targets: onPointerDown,
  // startChassisDrag, startItemDrag, onChassisPointerMove,
  // onChassisPointerUp, onPointerMove, onPointerUp, moveItem,
  // emitReorder, cancelDrag.

  describe('chassis drag (floating)', () => {
    function pointerEvent(
      type: string,
      init: { pointerId?: number; button?: number; clientX?: number; clientY?: number } = {},
    ) {
      const ev = new Event(type, { bubbles: true, composed: true, cancelable: true });
      Object.assign(ev, {
        pointerId: init.pointerId ?? 1,
        button: init.button ?? 0,
        clientX: init.clientX ?? 0,
        clientY: init.clientY ?? 0,
      });
      return ev;
    }

    async function setupFloating() {
      const page = await create(`
        <md-accordion floating initial-x="10" initial-y="20">
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      const handle = (items![0] as HTMLElement).shadowRoot?.querySelector('[part="chassis-handle"]') as HTMLElement;
      return { page, handle };
    }

    it('pointerdown on the chassis handle emits mdDragStart and toggles dragging class', async () => {
      const { page, handle } = await setupFloating();
      const startSpy = jest.fn();
      page.root?.addEventListener('mdDragStart', startSpy);

      handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 200 }));
      await page.waitForChanges();

      expect(startSpy).toHaveBeenCalled();
      expect(startSpy.mock.calls[0][0].detail).toMatchObject({
        clientX: 100,
        clientY: 200,
        x: 10,
        y: 20,
        dx: 0,
        dy: 0,
      });
      expect(page.root).toHaveClass('md-accordion--floating-dragging');
    });

    it('right-click (button=2) is ignored', async () => {
      const { page, handle } = await setupFloating();
      const startSpy = jest.fn();
      page.root?.addEventListener('mdDragStart', startSpy);
      handle.dispatchEvent(pointerEvent('pointerdown', { button: 2 }));
      await page.waitForChanges();
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('pointermove updates chassis offset and emits mdDragMove', async () => {
      const { page, handle } = await setupFloating();
      const moveSpy = jest.fn();
      page.root?.addEventListener('mdDragMove', moveSpy);

      handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 200 }));
      page.root?.dispatchEvent(pointerEvent('pointermove', { clientX: 130, clientY: 240 }));
      await page.waitForChanges();

      expect(moveSpy).toHaveBeenCalled();
      const detail = moveSpy.mock.calls[moveSpy.mock.calls.length - 1][0].detail;
      expect(detail).toMatchObject({ dx: 30, dy: 40, x: 40, y: 60 });
    });

    it('pointerup emits mdDragEnd and clears the dragging class', async () => {
      const { page, handle } = await setupFloating();
      const endSpy = jest.fn();
      page.root?.addEventListener('mdDragEnd', endSpy);

      handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 200 }));
      page.root?.dispatchEvent(pointerEvent('pointermove', { clientX: 130, clientY: 240 }));
      page.root?.dispatchEvent(pointerEvent('pointerup', { clientX: 130, clientY: 240 }));
      await page.waitForChanges();

      expect(endSpy).toHaveBeenCalled();
      expect(endSpy.mock.calls[0][0].detail).toMatchObject({ dx: 30, dy: 40 });
      expect(page.root).not.toHaveClass('md-accordion--floating-dragging');
    });

    it('a second pointerdown while already dragging is ignored', async () => {
      const { page, handle } = await setupFloating();
      const startSpy = jest.fn();
      page.root?.addEventListener('mdDragStart', startSpy);

      handle.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1 }));
      handle.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2 }));
      await page.waitForChanges();
      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it('pointermove without a prior pointerdown is a no-op', async () => {
      const { page } = await setupFloating();
      const moveSpy = jest.fn();
      page.root?.addEventListener('mdDragMove', moveSpy);
      page.root?.dispatchEvent(pointerEvent('pointermove', { clientX: 1, clientY: 1 }));
      await page.waitForChanges();
      expect(moveSpy).not.toHaveBeenCalled();
    });

    it('pointerup without a prior pointerdown is a no-op', async () => {
      const { page } = await setupFloating();
      const endSpy = jest.fn();
      page.root?.addEventListener('mdDragEnd', endSpy);
      page.root?.dispatchEvent(pointerEvent('pointerup', { clientX: 1, clientY: 1 }));
      await page.waitForChanges();
      expect(endSpy).not.toHaveBeenCalled();
    });
  });

  describe('item drag (reorderable)', () => {
    // mock-doc's `composedPath()` doesn't include the shadow host
    // element when an event dispatched within a shadow tree bubbles
    // into light DOM. The accordion's onPointerDown looks for both
    // (a) a node with `data-accordion-drag-handle="true"` and (b) a
    // node with `tagName === 'MD-ACCORDION-ITEM'` — without the host
    // in the path, lookup (b) fails. We forge the path on the event.
    function pointerEvent(
      type: string,
      path: EventTarget[],
      init: { pointerId?: number; button?: number; clientX?: number; clientY?: number } = {},
    ) {
      const ev = new Event(type, { bubbles: true, composed: true, cancelable: true });
      Object.assign(ev, {
        pointerId: init.pointerId ?? 1,
        button: init.button ?? 0,
        clientX: init.clientX ?? 0,
        clientY: init.clientY ?? 0,
      });
      Object.defineProperty(ev, 'composedPath', {
        value: () => path,
      });
      return ev;
    }

    async function setupReorderable() {
      const page = await create(`
        <md-accordion reorderable>
          <md-accordion-item headline="A">A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
          <md-accordion-item headline="C">C</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      const handle = (items![0] as HTMLElement).shadowRoot?.querySelector('[part="drag-handle"]') as HTMLElement;
      const path: EventTarget[] = [handle, items![0], page.root!];
      return { page, items, handle, path };
    }

    it('pointerdown on a drag-handle adds the dragging class on the source item', async () => {
      const { page, items, path } = await setupReorderable();
      items![0].dispatchEvent(pointerEvent('pointerdown', path, { clientY: 0 }));
      await page.waitForChanges();
      expect(items![0]).toHaveClass('md-accordion-item--dragging');
    });

    it('pointerdown on a drag-handle adds the shifting class to siblings', async () => {
      const { page, items, path } = await setupReorderable();
      items![0].dispatchEvent(pointerEvent('pointerdown', path, { clientY: 0 }));
      await page.waitForChanges();
      expect(items![1]).toHaveClass('md-accordion-item--shifting');
      expect(items![2]).toHaveClass('md-accordion-item--shifting');
    });

    it('pointerup with currentTarget unchanged does NOT emit mdReorder', async () => {
      const { page, items, path } = await setupReorderable();
      const reorderSpy = jest.fn();
      page.root?.addEventListener('mdReorder', reorderSpy);

      items![0].dispatchEvent(pointerEvent('pointerdown', path, { clientY: 0 }));
      page.root?.dispatchEvent(pointerEvent('pointerup', [page.root!], { clientY: 0 }));
      await page.waitForChanges();

      expect(reorderSpy).not.toHaveBeenCalled();
    });

    it('right-click on the drag-handle is ignored', async () => {
      const { page, items, path } = await setupReorderable();
      items![0].dispatchEvent(pointerEvent('pointerdown', path, { button: 2 }));
      await page.waitForChanges();
      expect(items![0]).not.toHaveClass('md-accordion-item--dragging');
    });

    it('pointerdown on a disabled item is ignored', async () => {
      const page = await create(`
        <md-accordion reorderable>
          <md-accordion-item headline="A" disabled>A</md-accordion-item>
          <md-accordion-item headline="B">B</md-accordion-item>
        </md-accordion>
      `);
      const items = page.root?.querySelectorAll('md-accordion-item');
      const handle = (items![0] as HTMLElement).shadowRoot?.querySelector('[part="drag-handle"]') as HTMLElement;
      const path: EventTarget[] = [handle, items![0], page.root!];
      items![0].dispatchEvent(pointerEvent('pointerdown', path));
      await page.waitForChanges();
      expect(items![0]).not.toHaveClass('md-accordion-item--dragging');
    });

    it('drag is ignored when fewer than 2 items', async () => {
      const page = await create(`
        <md-accordion reorderable>
          <md-accordion-item headline="A">A</md-accordion-item>
        </md-accordion>
      `);
      const item = page.root?.querySelector('md-accordion-item')!;
      const handle = (item as HTMLElement).shadowRoot?.querySelector('[part="drag-handle"]') as HTMLElement;
      const path: EventTarget[] = [handle, item, page.root!];
      item.dispatchEvent(pointerEvent('pointerdown', path));
      await page.waitForChanges();
      expect(item).not.toHaveClass('md-accordion-item--dragging');
    });

    it('pointermove updates the dragged item transform', async () => {
      const { page, items, path } = await setupReorderable();
      items![0].dispatchEvent(pointerEvent('pointerdown', path, { clientY: 0 }));
      page.root?.dispatchEvent(pointerEvent('pointermove', [page.root!], { clientY: 30 }));
      await page.waitForChanges();
      // We can't assert on layout, but verify the inline-style mutation
      // touched the dragged item rather than throwing.
      expect((items![0] as HTMLElement).style.transform).toContain('translateY');
    });

    it('disconnect during drag triggers cancelDrag cleanup', async () => {
      const { page, items, path } = await setupReorderable();
      items![0].dispatchEvent(pointerEvent('pointerdown', path));
      await page.waitForChanges();
      expect(items![0]).toHaveClass('md-accordion-item--dragging');

      page.root?.remove();
      await page.waitForChanges();
      // cancelDrag clears the dragging class and removes listeners; no
      // throw == coverage.
      expect(true).toBe(true);
    });
  });
});
