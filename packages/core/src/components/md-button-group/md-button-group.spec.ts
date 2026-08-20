import { newSpecPage } from '@stencil/core/testing';
import { MdButtonGroup } from './md-button-group';
import { MdButton } from '../md-button/md-button';
import { MdIconButton } from '../md-icon-button/md-icon-button';

describe('md-button-group', () => {
  // ── Rendering ───────────────────────────────────────────

  it('renders', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup],
      html: `<md-button-group></md-button-group>`,
    });
    expect(page.root).toBeTruthy();
  });

  it('applies default classes', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup],
      html: `<md-button-group></md-button-group>`,
    });
    const root = page.root!;
    expect(root.classList.contains('md-button-group')).toBe(true);
    expect(root.classList.contains('md-button-group--standard')).toBe(true);
    expect(root.classList.contains('md-button-group--sm')).toBe(true);
    expect(root.classList.contains('md-button-group--round')).toBe(true);
  });

  it('applies variant class', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup],
      html: `<md-button-group variant="connected"></md-button-group>`,
    });
    expect(page.root?.classList.contains('md-button-group--connected')).toBe(true);
  });

  it('applies size class for each size', async () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl']) {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group size="${size}"></md-button-group>`,
      });
      expect(page.root?.classList.contains(`md-button-group--${size}`)).toBe(true);
    }
  });

  it('applies shape class', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup],
      html: `<md-button-group shape="square"></md-button-group>`,
    });
    expect(page.root?.classList.contains('md-button-group--square')).toBe(true);
  });

  // ── full-width ──────────────────────────────────────────

  describe('full-width', () => {
    it('does not apply the full-width class by default', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group></md-button-group>`,
      });
      expect(page.root?.classList.contains('md-button-group--full-width')).toBe(false);
    });

    it('applies the full-width class when the attribute is set', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group full-width></md-button-group>`,
      });
      expect(page.root?.classList.contains('md-button-group--full-width')).toBe(true);
    });

    it('reflects the full-width prop back to the attribute', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group></md-button-group>`,
      });
      const root = page.root as HTMLElement & { fullWidth: boolean };
      root.fullWidth = true;
      await page.waitForChanges();
      expect(root.hasAttribute('full-width')).toBe(true);
      expect(root.classList.contains('md-button-group--full-width')).toBe(true);
    });

    it('toggles the full-width class when the prop changes at runtime', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group full-width></md-button-group>`,
      });
      const root = page.root as HTMLElement & { fullWidth: boolean };
      expect(root.classList.contains('md-button-group--full-width')).toBe(true);

      root.fullWidth = false;
      await page.waitForChanges();
      expect(root.classList.contains('md-button-group--full-width')).toBe(false);
    });

    it('accepts CSS custom property overrides for sizing', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group
          style="--md-button-group-width: 480px; --md-button-group-min-width: 200px; --md-button-group-max-width: 800px;"
        ></md-button-group>`,
      });
      // The custom properties are inherited by :host through the inline
      // style; the test just verifies the attribute is preserved.
      expect(page.root?.getAttribute('style')).toContain('--md-button-group-width');
      expect(page.root?.getAttribute('style')).toContain('--md-button-group-max-width');
    });

    it('accepts CSS custom property overrides for block-axis sizing', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group
          style="--md-button-group-height: 56px; --md-button-group-min-height: 40px; --md-button-group-max-height: 96px;"
        ></md-button-group>`,
      });
      const style = page.root?.getAttribute('style') ?? '';
      expect(style).toContain('--md-button-group-height');
      expect(style).toContain('--md-button-group-min-height');
      expect(style).toContain('--md-button-group-max-height');
    });
  });

  // ── Gap ─────────────────────────────────────────────────

  // The gap USED to be computed here and written as an inline style, and these
  // specs asserted that string. It now lives in CSS so that it can taper with
  // density and so the documented --md-button-group-gap override applies (an
  // inline style outranked it). The spec's job is therefore the contract that
  // selects the gap — the size and variant classes — not the px value, which
  // the mock DOM cannot compute anyway. The values themselves are verified in
  // the browser across 5 sizes x 2 variants x 3 density rungs.
  describe('gap contract (size/variant classes select the CSS gap)', () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl']) {
      it(`carries the size class for ${size} so CSS can select its gap`, async () => {
        const page = await newSpecPage({
          components: [MdButtonGroup],
          html: `<md-button-group variant="standard" size="${size}"></md-button-group>`,
        });
        expect(page.root?.classList.contains(`md-button-group--${size}`)).toBe(true);
        expect(page.root?.classList.contains('md-button-group--standard')).toBe(true);
        // No inline gap may come back: it would outrank the CSS and re-break
        // both the density taper and the public override.
        expect(page.root?.style.gap).toBeFalsy();
      });
    }
  });

  it('marks connected regardless of size, so the fused 2px seam applies', async () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl']) {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group variant="connected" size="${size}"></md-button-group>`,
      });
      expect(page.root?.classList.contains('md-button-group--connected')).toBe(true);
      expect(page.root?.style.gap).toBeFalsy();
    }
  });

  // ── Child syncing ───────────────────────────────────────

  it('sets toggle=true on child md-button', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group>
          <md-button value="a">A</md-button>
        </md-button-group>
      `,
    });
    const btn = page.root?.querySelector('md-button') as any;
    expect(btn?.toggle).toBe(true);
  });

  it('sets toggle=true on child md-icon-button', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdIconButton],
      html: `
        <md-button-group>
          <md-icon-button value="a" icon="star"></md-icon-button>
        </md-button-group>
      `,
    });
    const btn = page.root?.querySelector('md-icon-button') as any;
    expect(btn?.toggle).toBe(true);
  });

  it('propagates size to child buttons', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group size="lg">
          <md-button value="a">A</md-button>
        </md-button-group>
      `,
    });
    const btn = page.root?.querySelector('md-button') as any;
    expect(btn?.size).toBe('lg');
  });

  it('propagates shape to child buttons', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group shape="square">
          <md-button value="a">A</md-button>
        </md-button-group>
      `,
    });
    const btn = page.root?.querySelector('md-button') as any;
    expect(btn?.shape).toBe('square');
  });

  it('works with mixed md-button and md-icon-button children', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton, MdIconButton],
      html: `
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-icon-button value="b" icon="favorite"></md-icon-button>
        </md-button-group>
      `,
    });
    const children = page.root?.querySelectorAll('md-button, md-icon-button');
    expect(children?.length).toBe(2);
    expect((children?.[0] as any)?.toggle).toBe(true);
    expect((children?.[1] as any)?.toggle).toBe(true);
  });

  // ── @Watch reactivity ─────────────────────────────────

  it('re-syncs children when variant changes at runtime', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group variant="standard" size="sm">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
    expect(buttons[0]?.connectedRight).toBe(false);

    (page.root as any).variant = 'connected';
    await page.waitForChanges();

    expect(buttons[0]?.connectedRight).toBe(true);
    expect(buttons[1]?.connectedLeft).toBe(true);
  });

  it('re-syncs children when shape or size changes at runtime', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group shape="round" size="sm">
          <md-button value="a">A</md-button>
        </md-button-group>
      `,
    });
    const btn = page.root?.querySelector('md-button') as any;
    expect(btn?.shape).toBe('round');
    expect(btn?.size).toBe('sm');

    (page.root as any).shape = 'square';
    (page.root as any).size = 'lg';
    await page.waitForChanges();

    expect(btn?.shape).toBe('square');
    expect(btn?.size).toBe('lg');
  });

  // ── Standard variant (no connected flags) ───────

  it('does not set connected flags on standard children', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group variant="standard" size="sm">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
    expect(buttons[0]?.connectedLeft).toBe(false);
    expect(buttons[0]?.connectedRight).toBe(false);
    expect(buttons[1]?.connectedLeft).toBe(false);
    expect(buttons[1]?.connectedRight).toBe(false);
  });

  // ── Connected variant ──────────────────────────────────

  describe('connected variant', () => {
    // ── Gap ────────────────────────────────────────────────
    it('stays connected for all sizes (CSS pins the 2px seam)', async () => {
      for (const size of ['xs', 'sm', 'md', 'lg', 'xl']) {
        const page = await newSpecPage({
          components: [MdButtonGroup],
          html: `<md-button-group variant="connected" size="${size}"></md-button-group>`,
        });
        expect(page.root?.classList.contains('md-button-group--connected')).toBe(true);
        expect(page.root?.style.gap).toBeFalsy();
      }
    });

    // ── Connected flags on children ────────────────────────
    describe('connectedLeft / connectedRight flags', () => {
      it('three children: first=right, middle=both, last=left', async () => {
        const page = await newSpecPage({
          components: [MdButtonGroup, MdButton],
          html: `
            <md-button-group variant="connected" shape="round" size="sm">
              <md-button value="a">A</md-button>
              <md-button value="b">B</md-button>
              <md-button value="c">C</md-button>
            </md-button-group>
          `,
        });
        const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
        expect(buttons[0]?.connectedLeft).toBe(false);
        expect(buttons[0]?.connectedRight).toBe(true);
        expect(buttons[1]?.connectedLeft).toBe(true);
        expect(buttons[1]?.connectedRight).toBe(true);
        expect(buttons[2]?.connectedLeft).toBe(true);
        expect(buttons[2]?.connectedRight).toBe(false);
      });

      it('single child has neither flag set', async () => {
        const page = await newSpecPage({
          components: [MdButtonGroup, MdButton],
          html: `
            <md-button-group variant="connected" shape="round" size="sm">
              <md-button value="a">A</md-button>
            </md-button-group>
          `,
        });
        const btn = page.root?.querySelector('md-button') as any;
        expect(btn?.connectedLeft).toBe(false);
        expect(btn?.connectedRight).toBe(false);
      });

      it('two children: first=right-only, last=left-only', async () => {
        const page = await newSpecPage({
          components: [MdButtonGroup, MdButton],
          html: `
            <md-button-group variant="connected" shape="round" size="md">
              <md-button value="a">A</md-button>
              <md-button value="b">B</md-button>
            </md-button-group>
          `,
        });
        const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
        expect(buttons[0]?.connectedLeft).toBe(false);
        expect(buttons[0]?.connectedRight).toBe(true);
        expect(buttons[1]?.connectedLeft).toBe(true);
        expect(buttons[1]?.connectedRight).toBe(false);
      });

      it('keeps shapeMorph enabled on connected children', async () => {
        const page = await newSpecPage({
          components: [MdButtonGroup, MdButton],
          html: `
            <md-button-group variant="connected" size="sm">
              <md-button value="a">A</md-button>
              <md-button value="b">B</md-button>
            </md-button-group>
          `,
        });
        const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
        expect(buttons[0]?.shapeMorph).toBe(true);
        expect(buttons[1]?.shapeMorph).toBe(true);
      });

      it('works with icon buttons', async () => {
        const page = await newSpecPage({
          components: [MdButtonGroup, MdIconButton],
          html: `
            <md-button-group variant="connected" shape="round" size="sm">
              <md-icon-button value="a" icon="star"></md-icon-button>
              <md-icon-button value="b" icon="favorite"></md-icon-button>
              <md-icon-button value="c" icon="home"></md-icon-button>
            </md-button-group>
          `,
        });
        const buttons = page.root?.querySelectorAll('md-icon-button') as NodeListOf<any>;
        expect(buttons[0]?.connectedLeft).toBe(false);
        expect(buttons[0]?.connectedRight).toBe(true);
        expect(buttons[1]?.connectedLeft).toBe(true);
        expect(buttons[1]?.connectedRight).toBe(true);
        expect(buttons[2]?.connectedLeft).toBe(true);
        expect(buttons[2]?.connectedRight).toBe(false);
      });

      it('works with mixed button types', async () => {
        const page = await newSpecPage({
          components: [MdButtonGroup, MdButton, MdIconButton],
          html: `
            <md-button-group variant="connected" shape="round" size="sm">
              <md-button value="a">A</md-button>
              <md-icon-button value="b" icon="star"></md-icon-button>
              <md-button value="c">C</md-button>
            </md-button-group>
          `,
        });
        const children = page.root?.querySelectorAll('md-button, md-icon-button') as NodeListOf<any>;
        expect(children[0]?.connectedLeft).toBe(false);
        expect(children[0]?.connectedRight).toBe(true);
        expect(children[1]?.connectedLeft).toBe(true);
        expect(children[1]?.connectedRight).toBe(true);
        expect(children[2]?.connectedLeft).toBe(true);
        expect(children[2]?.connectedRight).toBe(false);
      });
    });

    // ── Selection still works in connected ────────────────
    it('single-select works in connected mode', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group variant="connected" selection-mode="single-select">
            <md-button value="a">A</md-button>
            <md-button value="b">B</md-button>
            <md-button value="c">C</md-button>
          </md-button-group>
        `,
      });
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

      buttons[0]?.click();
      await page.waitForChanges();
      expect(buttons[0]?.selected).toBe(true);
      expect(buttons[1]?.selected).toBe(false);

      buttons[2]?.click();
      await page.waitForChanges();
      expect(buttons[0]?.selected).toBe(false);
      expect(buttons[2]?.selected).toBe(true);
    });

    it('multi-select works in connected mode', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group variant="connected" selection-mode="multi-select">
            <md-button value="a">A</md-button>
            <md-button value="b">B</md-button>
          </md-button-group>
        `,
      });
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

      buttons[0]?.click();
      await page.waitForChanges();
      buttons[1]?.click();
      await page.waitForChanges();

      expect(buttons[0]?.selected).toBe(true);
      expect(buttons[1]?.selected).toBe(true);
    });

    it('required works in connected mode', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group variant="connected" selection-mode="single-select" required>
            <md-button value="a" selected>A</md-button>
            <md-button value="b">B</md-button>
          </md-button-group>
        `,
      });
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

      buttons[0]?.click();
      await page.waitForChanges();
      expect(buttons[0]?.selected).toBe(true);
    });

    // ── mdSelectionChange in connected ────────────────────────────
    it('emits mdSelectionChange in connected mode', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group variant="connected" selection-mode="single-select">
            <md-button value="x">X</md-button>
            <md-button value="y">Y</md-button>
          </md-button-group>
        `,
      });
      const spy = jest.fn();
      page.root?.addEventListener('mdSelectionChange', (e: any) => spy(e.detail));

      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
      buttons[1]?.click();
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].values).toEqual(['y']);
      expect(spy.mock.calls[0][0].added).toEqual(['y']);
      expect(spy.mock.calls[0][0].removed).toEqual([]);
    });

    // ── Syncs props ───────────────────────────────────────
    it('propagates size and shape to connected children', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group variant="connected" size="lg" shape="square">
            <md-button value="a">A</md-button>
          </md-button-group>
        `,
      });
      const btn = page.root?.querySelector('md-button') as any;
      expect(btn?.size).toBe('lg');
      expect(btn?.shape).toBe('square');
      expect(btn?.toggle).toBe(true);
    });
  });

  // ── Single-select ─────────────────────────────────────

  it('selects one at a time in single-select', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="single-select">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

    buttons[0]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(true);
    expect(buttons[1]?.selected).toBe(false);
    expect(buttons[2]?.selected).toBe(false);

    buttons[2]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(false);
    expect(buttons[1]?.selected).toBe(false);
    expect(buttons[2]?.selected).toBe(true);
  });

  it('deselects the active button on second click (single-select, no required)', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="single-select">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

    buttons[0]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(true);

    buttons[0]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(false);
    expect(buttons[1]?.selected).toBe(false);
  });

  // ── Multi-select ──────────────────────────────────────

  it('toggles each button independently in multi-select', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="multi-select">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

    buttons[0]?.click();
    await page.waitForChanges();
    buttons[2]?.click();
    await page.waitForChanges();

    expect(buttons[0]?.selected).toBe(true);
    expect(buttons[1]?.selected).toBe(false);
    expect(buttons[2]?.selected).toBe(true);

    buttons[0]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(false);
    expect(buttons[2]?.selected).toBe(true);
  });

  // ── Required ──────────────────────────────────────────

  it('prevents deselecting the last selected in single-select + required', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="single-select" required>
          <md-button value="a" selected>A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

    buttons[0]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(true);
  });

  it('allows switching selection in single-select + required', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="single-select" required>
          <md-button value="a" selected>A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

    buttons[1]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(false);
    expect(buttons[1]?.selected).toBe(true);
  });

  it('prevents deselecting the last selected in multi-select + required', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="multi-select" required>
          <md-button value="a" selected>A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

    buttons[0]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(true);
  });

  it('allows deselecting when others are still selected (multi-select + required)', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="multi-select" required>
          <md-button value="a" selected>A</md-button>
          <md-button value="b" selected>B</md-button>
        </md-button-group>
      `,
    });
    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;

    buttons[0]?.click();
    await page.waitForChanges();
    expect(buttons[0]?.selected).toBe(false);
    expect(buttons[1]?.selected).toBe(true);
  });

  // ── mdSelectionChange event ────────────────────────────────────

  it('emits mdSelectionChange with selected values on click', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="single-select">
          <md-button value="alpha">A</md-button>
          <md-button value="beta">B</md-button>
        </md-button-group>
      `,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSelectionChange', (e: any) => spy(e.detail));

    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
    buttons[0]?.click();
    await page.waitForChanges();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].values).toEqual(['alpha']);
    expect(spy.mock.calls[0][0].added).toEqual(['alpha']);
    expect(spy.mock.calls[0][0].removed).toEqual([]);
    expect(spy.mock.calls[0][0].originalEvent).toBeDefined();
  });

  it('emits mdSelectionChange with multiple values in multi-select and reports diff', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="multi-select">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSelectionChange', (e: any) => spy(e.detail));

    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
    buttons[0]?.click();
    await page.waitForChanges();
    buttons[2]?.click();
    await page.waitForChanges();

    expect(spy).toHaveBeenCalledTimes(2);
    const last = spy.mock.calls[1][0];
    expect(last.values).toEqual(['a', 'c']);
    expect(last.added).toEqual(['c']);
    expect(last.removed).toEqual([]);
  });

  it('emits empty values when all deselected and reports removed', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="single-select">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSelectionChange', (e: any) => spy(e.detail));

    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
    buttons[0]?.click();
    await page.waitForChanges();
    buttons[0]?.click();
    await page.waitForChanges();

    const last = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(last.values).toEqual([]);
    expect(last.added).toEqual([]);
    expect(last.removed).toEqual(['a']);
  });

  it('reports removed values when switching selection in single-select', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <md-button-group selection-mode="single-select">
          <md-button value="a" selected>A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSelectionChange', (e: any) => spy(e.detail));

    const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<any>;
    buttons[1]?.click();
    await page.waitForChanges();

    const last = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(last.values).toEqual(['b']);
    expect(last.added).toEqual(['b']);
    expect(last.removed).toEqual(['a']);
  });

  it('mdSelectionChange bubbles and is composed (escapes shadow tree)', async () => {
    const page = await newSpecPage({
      components: [MdButtonGroup, MdButton],
      html: `
        <div id="ancestor">
          <md-button-group selection-mode="single-select">
            <md-button value="a">A</md-button>
          </md-button-group>
        </div>
      `,
    });
    const ancestor = page.body.querySelector('#ancestor') as HTMLElement;
    const spy = jest.fn();
    ancestor.addEventListener('mdSelectionChange', spy);

    const btn = page.root?.querySelector('md-button') as any;
    btn?.click();
    await page.waitForChanges();

    expect(spy).toHaveBeenCalled();
  });

  // ── Accessibility ─────────────────────────────────────

  describe('accessibility', () => {
    it('has role=radiogroup for single-select', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group selection-mode="single-select"></md-button-group>`,
      });
      expect(page.root?.getAttribute('role')).toBe('radiogroup');
    });

    it('has role=group for multi-select', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group selection-mode="multi-select"></md-button-group>`,
      });
      expect(page.root?.getAttribute('role')).toBe('group');
    });

    it('child buttons have aria-pressed reflecting selected state', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group selection-mode="single-select">
            <md-button value="a">A</md-button>
            <md-button value="b">B</md-button>
          </md-button-group>
        `,
      });
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;

      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('false');
      expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');

      buttons[0]?.click();
      await page.waitForChanges();

      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
      expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');
    });

    it('child buttons have role=button', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group>
            <md-button value="a">A</md-button>
          </md-button-group>
        `,
      });
      const btn = page.root?.querySelector('md-button') as HTMLElement;
      expect(btn?.getAttribute('role')).toBe('button');
    });

    it('child buttons are focusable (tabindex=0)', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group>
            <md-button value="a">A</md-button>
          </md-button-group>
        `,
      });
      const btn = page.root?.querySelector('md-button') as HTMLElement;
      expect(btn?.getAttribute('tabindex')).toBe('0');
    });

    it('disabled child has tabindex=-1', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group>
            <md-button value="a" disabled>A</md-button>
          </md-button-group>
        `,
      });
      const btn = page.root?.querySelector('md-button') as HTMLElement;
      expect(btn?.getAttribute('tabindex')).toBe('-1');
    });

    it('icon button children have aria-pressed in group', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdIconButton],
        html: `
          <md-button-group selection-mode="single-select">
            <md-icon-button value="a" icon="star"></md-icon-button>
            <md-icon-button value="b" icon="favorite"></md-icon-button>
          </md-button-group>
        `,
      });
      const buttons = page.root?.querySelectorAll('md-icon-button') as NodeListOf<HTMLElement>;

      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('false');

      buttons[0]?.click();
      await page.waitForChanges();

      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
      expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');
    });

    it('single-select + required keeps at least one aria-pressed=true', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup, MdButton],
        html: `
          <md-button-group selection-mode="single-select" required>
            <md-button value="a" selected>A</md-button>
            <md-button value="b">B</md-button>
          </md-button-group>
        `,
      });
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;

      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');

      buttons[0]?.click();
      await page.waitForChanges();

      expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    });

    it('exposes aria-orientation=horizontal', async () => {
      const page = await newSpecPage({
        components: [MdButtonGroup],
        html: `<md-button-group></md-button-group>`,
      });
      expect(page.root?.getAttribute('aria-orientation')).toBe('horizontal');
    });
  });

  // ── Keyboard navigation (roving focus) ────────────────

  describe('keyboard navigation', () => {
    async function build(html: string) {
      return newSpecPage({
        components: [MdButtonGroup, MdButton, MdIconButton],
        html,
      });
    }

    function dispatchKey(target: HTMLElement, key: string) {
      const evt = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      target.dispatchEvent(evt);
      return evt;
    }

    it('ArrowRight moves focus to the next button in LTR', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      const focusSpy = jest.spyOn(buttons[1], 'focus').mockImplementation(() => {});

      dispatchKey(buttons[0], 'ArrowRight');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('ArrowLeft moves focus to the previous button in LTR', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      const focusSpy = jest.spyOn(buttons[0], 'focus').mockImplementation(() => {});

      dispatchKey(buttons[1], 'ArrowLeft');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('ArrowRight wraps from last to first', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      const focusSpy = jest.spyOn(buttons[0], 'focus').mockImplementation(() => {});

      dispatchKey(buttons[1], 'ArrowRight');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('Home jumps to the first button', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      const focusSpy = jest.spyOn(buttons[0], 'focus').mockImplementation(() => {});

      dispatchKey(buttons[2], 'Home');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('End jumps to the last button', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      const focusSpy = jest.spyOn(buttons[2], 'focus').mockImplementation(() => {});

      dispatchKey(buttons[0], 'End');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('skips disabled buttons during arrow navigation', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b" disabled>B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      const focusSpy = jest.spyOn(buttons[2], 'focus').mockImplementation(() => {});

      dispatchKey(buttons[0], 'ArrowRight');
      expect(focusSpy).toHaveBeenCalled();
    });

    it('reverses arrow semantics in RTL', async () => {
      const page = await build(`
        <div dir="rtl">
          <md-button-group>
            <md-button value="a">A</md-button>
            <md-button value="b">B</md-button>
          </md-button-group>
        </div>
      `);
      const buttons = page.body.querySelectorAll('md-button') as NodeListOf<HTMLElement>;

      // In RTL, ArrowLeft should go forward (to next sibling).
      const leftFocus = jest.spyOn(buttons[1], 'focus').mockImplementation(() => {});
      dispatchKey(buttons[0], 'ArrowLeft');
      expect(leftFocus).toHaveBeenCalled();

      // ArrowRight should go backward.
      const rightFocus = jest.spyOn(buttons[0], 'focus').mockImplementation(() => {});
      dispatchKey(buttons[1], 'ArrowRight');
      expect(rightFocus).toHaveBeenCalled();
    });

    it('ignores non-navigation keys', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      const focusSpy = jest.spyOn(buttons[1], 'focus').mockImplementation(() => {});

      dispatchKey(buttons[0], 'a');
      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('handles arrow key when focus is outside any child button', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      const firstFocus = jest.spyOn(buttons[0], 'focus').mockImplementation(() => {});

      dispatchKey(page.root as HTMLElement, 'ArrowRight');
      expect(firstFocus).toHaveBeenCalled();
    });

    it('does nothing when group is empty', async () => {
      const page = await build(`<md-button-group></md-button-group>`);
      // Should not throw.
      expect(() => dispatchKey(page.root as HTMLElement, 'ArrowRight')).not.toThrow();
    });
  });

  // ── Roving tabindex (single tab stop into the group) ───

  describe('roving tabindex', () => {
    async function build(html: string) {
      return newSpecPage({
        components: [MdButtonGroup, MdButton, MdIconButton],
        html,
      });
    }

    it('only the first non-disabled button is tabbable initially (multi-select)', async () => {
      const page = await build(`
        <md-button-group selection-mode="multi-select">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('-1');
    });

    it('the selected button is tabbable initially in single-select', async () => {
      const page = await build(`
        <md-button-group selection-mode="single-select">
          <md-button value="a">A</md-button>
          <md-button value="b" selected>B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      expect(buttons[0]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('-1');
    });

    it('first non-disabled button is tabbable when nothing is selected', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a" disabled>A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      // Disabled stays at -1, B becomes the active tab stop.
      expect(buttons[0]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('-1');
    });

    it('arrow navigation moves the tab stop to the focused button', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      jest.spyOn(buttons[1], 'focus').mockImplementation(() => {});

      const evt = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      buttons[0].dispatchEvent(evt);
      await page.waitForChanges();

      expect(buttons[0]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('-1');
    });

    it('clicking a button moves the tab stop to it', async () => {
      const page = await build(`
        <md-button-group selection-mode="multi-select">
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      buttons[2].click();
      await page.waitForChanges();

      expect(buttons[0]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('0');
    });

    it('focusin updates the tab stop', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      // Bubbling focusin from the button — its target is set naturally by mock-doc.
      buttons[2].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();

      expect(buttons[0]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('0');
    });

    it('disabled buttons remain at tabindex=-1 even when active candidate', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a" disabled>A</md-button>
          <md-button value="b" disabled>B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      expect(buttons[0]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('0');
    });

    it('icon buttons participate in roving tabindex too', async () => {
      const page = await build(`
        <md-button-group>
          <md-icon-button value="a" icon="star"></md-icon-button>
          <md-icon-button value="b" icon="favorite"></md-icon-button>
          <md-icon-button value="c" icon="bolt"></md-icon-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-icon-button') as NodeListOf<HTMLElement>;
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('-1');
    });

    it('re-syncs tab stop after the variant changes', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);
      const group = page.root as HTMLElement & { variant: string };
      group.variant = 'connected';
      await page.waitForChanges();

      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ── Press-motion engine (standard variant) ─────────────────
  //
  // The press-motion code (`onGroupPointerDown`, `onGroupKeyDown`, `runMotion`,
  // and the `MutationObserver` slot watcher) depends on three browser APIs
  // that Stencil's spec runtime / mock-doc does not implement:
  //
  //   1. `element.animate(...)` (Web Animations API)
  //   2. `getComputedStyle(...)` returning real metrics
  //   3. `MutationObserver` invoking its callback on slot mutation
  //
  // These tests stub all three at the test boundary so the spec can drive
  // `runMotion` end-to-end and assert the keyframes / cancel / branch behaviour
  // that previously only the (non-existent) E2E suite could touch.
  describe('press-motion (standard variant)', () => {
    interface AnimateCall {
      tag: string;
      keyframes: Keyframe[];
      options: KeyframeAnimationOptions;
    }

    let animateCalls: AnimateCall[] = [];
    let cancelCount = 0;
    let mutationCallbacks: MutationCallback[] = [];

    let originalAnimateDescriptor: PropertyDescriptor | undefined;
    let originalGetComputedStyle: typeof globalThis.getComputedStyle;
    let originalMutationObserver: typeof globalThis.MutationObserver;

    beforeEach(() => {
      animateCalls = [];
      cancelCount = 0;
      mutationCallbacks = [];

      // Stub Element.prototype.animate so runMotion's keyframe calls
      // record their arguments instead of throwing "is not a function".
      originalAnimateDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'animate',
      );
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        writable: true,
        value: function (
          this: HTMLElement,
          keyframes: Keyframe[],
          options: KeyframeAnimationOptions,
        ) {
          animateCalls.push({ tag: this.tagName, keyframes, options });
          return {
            cancel: () => {
              cancelCount++;
            },
            finish: () => undefined,
            play: () => undefined,
            pause: () => undefined,
            playState: 'running',
            currentTime: 0,
            startTime: null,
            effect: null,
            id: '',
            pending: false,
            ready: Promise.resolve(),
            finished: Promise.resolve(),
            onfinish: null,
            oncancel: null,
            onremove: null,
            replaceState: 'active',
            timeline: null,
            updatePlaybackRate: () => undefined,
            reverse: () => undefined,
            commitStyles: () => undefined,
            persist: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          } as unknown as Animation;
        },
      });

      // Stub getComputedStyle with believable per-tag metrics so the
      // md-button branch (paddingLeft / paddingRight) and the icon-button
      // branch (width) both produce non-zero peak keyframes.
      originalGetComputedStyle = globalThis.getComputedStyle;
      (globalThis as { getComputedStyle: typeof globalThis.getComputedStyle }).getComputedStyle = (
        el: Element,
      ) => {
        if ((el as HTMLElement).tagName === 'MD-ICON-BUTTON') {
          return {
            width: '40px',
            paddingLeft: '0px',
            paddingRight: '0px',
          } as unknown as CSSStyleDeclaration;
        }
        return {
          width: '64px',
          paddingLeft: '16px',
          paddingRight: '16px',
        } as unknown as CSSStyleDeclaration;
      };

      // Capture the MutationObserver callback so tests can fire it manually.
      originalMutationObserver = globalThis.MutationObserver;
      (globalThis as { MutationObserver: typeof globalThis.MutationObserver }).MutationObserver =
        class MockMutationObserver {
          private cb: MutationCallback;
          constructor(cb: MutationCallback) {
            this.cb = cb;
            mutationCallbacks.push(cb);
          }
          observe() { /* noop */ }
          disconnect() { /* noop */ }
          takeRecords(): MutationRecord[] { return []; }
        } as unknown as typeof globalThis.MutationObserver;
    });

    afterEach(() => {
      if (originalAnimateDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimateDescriptor);
      } else {
        delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
      }
      (globalThis as { getComputedStyle: typeof globalThis.getComputedStyle }).getComputedStyle =
        originalGetComputedStyle;
      (globalThis as { MutationObserver: typeof globalThis.MutationObserver }).MutationObserver =
        originalMutationObserver;
    });

    async function build(html: string) {
      return newSpecPage({
        components: [MdButtonGroup, MdButton, MdIconButton],
        html,
      });
    }

    function pointerdownOn(target: EventTarget) {
      target.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true }),
      );
    }

    function keydownOn(target: EventTarget, key: string) {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    }

    it('animates active button + both neighbors when middle button is pressed', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[1]);
      await page.waitForChanges();

      // 3 animate calls: left neighbor, active, right neighbor.
      expect(animateCalls).toHaveLength(3);
      // Each is on an md-button, all with the same 400ms duration.
      for (const call of animateCalls) {
        expect(call.tag).toBe('MD-BUTTON');
        expect(call.options.duration).toBe(400);
        expect(call.keyframes).toHaveLength(3);
      }
    });

    it('animates active + right neighbor only when first button is pressed', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[0]);
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(2);
    });

    it('animates active + left neighbor only when last button is pressed', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[2]);
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(2);
    });

    it('skips non-neighbor children via the continue branch', async () => {
      // 4-button group, press first → only [0] (active) and [1] (right
      // neighbor) animate; [2] and [3] hit the `continue` skip branch.
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
          <md-button value="d">D</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[0]);
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(2);
    });

    it('runs the icon-button width branch instead of the padding branch', async () => {
      const page = await build(`
        <md-button-group>
          <md-icon-button value="a" icon="star"></md-icon-button>
          <md-icon-button value="b" icon="favorite"></md-icon-button>
          <md-icon-button value="c" icon="bolt"></md-icon-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-icon-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[1]);
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(3);
      for (const call of animateCalls) {
        expect(call.tag).toBe('MD-ICON-BUTTON');
        // Icon-button branch uses `width` keyframes, not paddingLeft/Right.
        expect((call.keyframes[0] as Keyframe).width).toBeDefined();
        expect((call.keyframes[0] as Keyframe).paddingLeft).toBeUndefined();
      }
    });

    it('does not animate a single-child group (neighborCount === 0)', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[0]);
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(0);
    });

    it('cancels any in-flight animations on the next press', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[1]);
      await page.waitForChanges();
      expect(animateCalls).toHaveLength(3);
      expect(cancelCount).toBe(0);

      pointerdownOn(buttons[1]);
      await page.waitForChanges();
      // Each of the 3 stored animations from the first press is cancelled,
      // then 3 new animations are queued for the second press.
      expect(cancelCount).toBe(3);
      expect(animateCalls).toHaveLength(6);
    });

    it('ignores pointerdown when the variant is not standard', async () => {
      // Group starts as 'standard' so the listener is attached, then we
      // flip to 'connected' to exercise the early-return guard.
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const group = page.root as HTMLElement & { variant: string };
      group.variant = 'connected';
      await page.waitForChanges();

      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[1]);
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(0);
    });

    it('ignores pointerdown that does not resolve to a child button', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);
      // Dispatch directly on the group host — closest('md-button, md-icon-button')
      // returns null because the host is not itself a button.
      pointerdownOn(page.root!);
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(0);
    });

    it('triggers runMotion on Enter and Space keydown', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;

      keydownOn(buttons[1], 'Enter');
      await page.waitForChanges();
      expect(animateCalls).toHaveLength(3);

      keydownOn(buttons[1], ' ');
      await page.waitForChanges();
      expect(animateCalls).toHaveLength(6);
    });

    it('ignores non-activation keys', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;

      keydownOn(buttons[1], 'Tab');
      keydownOn(buttons[1], 'Escape');
      keydownOn(buttons[1], 'a');
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(0);
    });

    it('skips motion on a required + already-selected chip (shouldMotion guard)', async () => {
      const page = await build(`
        <md-button-group selection-mode="single-select" required>
          <md-button value="a" selected>A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;

      // The first button is selected AND the group is required — clicking
      // it must not de-select it, and `shouldMotion` returns false to
      // avoid playing a "press" animation for a no-op activation.
      pointerdownOn(buttons[0]);
      await page.waitForChanges();
      expect(animateCalls).toHaveLength(0);

      // A neighbor that is *not* selected still animates on press.
      pointerdownOn(buttons[1]);
      await page.waitForChanges();
      expect(animateCalls.length).toBeGreaterThan(0);
    });

    it('animates a selected chip when the group is not required', async () => {
      // Counter-test to the previous one: same selected state, but
      // required=false → shouldMotion returns true.
      const page = await build(`
        <md-button-group selection-mode="multi-select">
          <md-button value="a" selected>A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;

      pointerdownOn(buttons[0]);
      await page.waitForChanges();
      expect(animateCalls.length).toBeGreaterThan(0);
    });

    it('MutationObserver callback re-syncs children and roving tabindex', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);

      // observeSlot subscribed exactly one MutationCallback during
      // componentDidLoad.
      expect(mutationCallbacks).toHaveLength(1);

      // Simulate the user appending a new button after mount, then fire
      // the captured MutationObserver callback to mimic the browser.
      const fresh = page.doc.createElement('md-button') as HTMLElement & {
        groupTabindex?: number;
        toggle?: boolean;
      };
      fresh.setAttribute('value', 'c');
      page.root!.appendChild(fresh);

      mutationCallbacks[0]([], {} as MutationObserver);
      await page.waitForChanges();

      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      expect(buttons).toHaveLength(3);
      // syncChildren ran → toggle prop is true on the fresh child.
      expect((buttons[2] as HTMLElement & { toggle?: boolean }).toggle).toBe(true);
      // updateRovingTabindex ran → fresh child got tabindex=-1 (only one
      // child wins the tab stop, and the first child still has it).
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[2]?.getAttribute('tabindex')).toBe('-1');
    });

    it('observeSlot is a no-op when MutationObserver is undefined', async () => {
      // Drop MutationObserver from the global before building so the
      // component hits the early-return guard in observeSlot().
      const removed = globalThis.MutationObserver;
      // @ts-expect-error - intentionally clearing the global
      globalThis.MutationObserver = undefined;

      try {
        const page = await build(`
          <md-button-group>
            <md-button value="a">A</md-button>
          </md-button-group>
        `);
        // No callback was registered, but the group still rendered.
        expect(mutationCallbacks).toHaveLength(0);
        expect(page.root).toBeTruthy();
      } finally {
        (globalThis as { MutationObserver: typeof globalThis.MutationObserver }).MutationObserver =
          removed;
      }
    });

    it('disconnectedCallback disconnects the MutationObserver and removes listeners', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);

      // Tear the group out of the document, which fires disconnectedCallback.
      page.root!.remove();
      await page.waitForChanges();

      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      pointerdownOn(buttons[1]);
      await page.waitForChanges();

      // After disconnection both pointerdown and keydown listeners are
      // removed → no animate calls land even on the standard variant.
      expect(animateCalls).toHaveLength(0);
    });

    it('ignores Enter keydown when the variant is not standard', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);
      const group = page.root as HTMLElement & { variant: string };
      group.variant = 'connected';
      await page.waitForChanges();

      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      keydownOn(buttons[1], 'Enter');
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(0);
    });

    it('runMotion early-returns when the target is not in the group (index === -1)', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);

      // Foreign element that is *not* a child of the group.
      const foreign = page.doc.createElement('md-button') as HTMLElement;
      // Calling the private runMotion directly is the only way to reach
      // the index === -1 guard; pointerdown's `closest()` would never
      // resolve to a foreign node in normal use.
      (page.rootInstance as { runMotion(t: HTMLElement): void }).runMotion(foreign);
      await page.waitForChanges();

      expect(animateCalls).toHaveLength(0);
    });
  });

  // ── Edge-case branches in selection / arrow-nav ────────────
  describe('edge-case branches', () => {
    async function build(html: string) {
      return newSpecPage({
        components: [MdButtonGroup, MdButton, MdIconButton],
        html,
      });
    }

    it('onGroupClick early-returns when the click is not on a child button', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);
      const spy = jest.fn();
      page.root!.addEventListener('mdSelectionChange', spy);

      // Click directly on the host — closest('md-button, ...') returns null
      // and the handler bails before emitting.
      page.root!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it('emits an empty string for buttons that have no value attribute', async () => {
      const page = await build(`
        <md-button-group selection-mode="multi-select">
          <md-button>No value</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<
        HTMLElement & { selected: boolean }
      >;

      // Pre-select the value-less button so it's already in the snapshot
      // when the next click runs collectSelectedValues.
      buttons[0].selected = true;
      await page.waitForChanges();

      const spy = jest.fn();
      page.root!.addEventListener('mdSelectionChange', spy);

      // Click the second button. Multi-select keeps both selected, so the
      // emitted snapshot includes the value-less button via the `|| ''`
      // fallback in collectSelectedValues.
      buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await page.waitForChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      const detail = spy.mock.calls[0][0].detail;
      expect(detail.values).toContain('');
      expect(detail.values).toContain('b');
    });

    it('arrow-nav with no active button starts from edge based on direction', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);

      // Dispatch ArrowRight directly on the host so closest() can't resolve
      // an `active` child → currentIndex falls through to -1, then the
      // forward-from-edge branch picks index 0.
      page.root!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      );
      await page.waitForChanges();

      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      // ArrowRight + currentIndex<0 → forward branch picks first button.
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    });

    it('arrow-nav backward from no active button picks the last child', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
          <md-button value="c">C</md-button>
        </md-button-group>
      `);

      page.root!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          bubbles: true,
          cancelable: true,
        }),
      );
      await page.waitForChanges();

      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      // ArrowLeft + currentIndex<0 → backward branch picks last button.
      expect(buttons[2]?.getAttribute('tabindex')).toBe('0');
    });

    it('arrow-nav early-returns on an irrelevant key', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;

      buttons[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();

      // Tabindex layout is unchanged after an irrelevant key.
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
      expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
    });

    it('arrow-nav early-returns when every child is disabled', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a" disabled>A</md-button>
          <md-button value="b" disabled>B</md-button>
        </md-button-group>
      `);

      page.root!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
          cancelable: true,
        }),
      );
      await page.waitForChanges();

      // Nothing crashes, no focus moves — tabindex layout still reflects
      // the disabled-fallback (first child wins).
      expect(page.root).toBeTruthy();
    });

    it('focusin on a foreign element that is not a child is ignored', async () => {
      const page = await build(`
        <md-button-group>
          <md-button value="a">A</md-button>
          <md-button value="b">B</md-button>
        </md-button-group>
      `);

      // Foreign md-button injected outside the group — focusin still
      // bubbles up but the handler bails because it's not in children.
      const foreign = page.doc.createElement('md-button') as HTMLElement;
      page.root!.dispatchEvent(
        Object.assign(new FocusEvent('focusin', { bubbles: true }), { target: foreign }),
      );
      await page.waitForChanges();

      // First child still owns the tab stop.
      const buttons = page.root?.querySelectorAll('md-button') as NodeListOf<HTMLElement>;
      expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    });
  });
});
