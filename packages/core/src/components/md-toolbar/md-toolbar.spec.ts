import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdToolbar } from './md-toolbar';

describe('md-toolbar', () => {
  async function create(html: string): Promise<SpecPage> {
    return newSpecPage({ components: [MdToolbar], html });
  }

  // ─── Rendering ───────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-toolbar');
    });

    it('renders container part', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('renders fab-container part', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.shadowRoot?.querySelector('[part="fab-container"]')).toBeTruthy();
    });

    it('renders default slot', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.shadowRoot?.querySelector('slot:not([name])')).toBeTruthy();
    });

    it('renders leading slot', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.shadowRoot?.querySelector('slot[name="leading"]')).toBeTruthy();
    });

    it('renders trailing slot', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.shadowRoot?.querySelector('slot[name="trailing"]')).toBeTruthy();
    });

    it('renders fab slot', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.shadowRoot?.querySelector('slot[name="fab"]')).toBeTruthy();
    });
  });

  // ─── Variants ────────────────────────────────────────────

  describe('variants', () => {
    it('defaults to docked', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--docked');
    });

    it('applies floating variant', async () => {
      const page = await create('<md-toolbar variant="floating"></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--floating');
    });

    it('applies docked variant', async () => {
      const page = await create('<md-toolbar variant="docked"></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--docked');
    });
  });

  // ─── Color ──────────────────────────────────────────────

  describe('color', () => {
    it('defaults to standard', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--standard');
    });

    it('applies vibrant color', async () => {
      const page = await create('<md-toolbar color="vibrant"></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--vibrant');
    });
  });

  // ─── Layout ─────────────────────────────────────────────

  describe('layout', () => {
    it('defaults to horizontal', async () => {
      const page = await create('<md-toolbar variant="floating"></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--horizontal');
    });

    it('applies vertical layout on floating', async () => {
      const page = await create('<md-toolbar variant="floating" layout="vertical"></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--vertical');
    });
  });

  // ─── Alignment ──────────────────────────────────────────

  describe('alignment', () => {
    it('defaults to start alignment', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--align-start');
    });

    it('applies start alignment', async () => {
      const page = await create('<md-toolbar alignment="start"></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--align-start');
    });

    it('applies space-between alignment', async () => {
      const page = await create('<md-toolbar alignment="space-between"></md-toolbar>');
      expect(page.root).toHaveClass('md-toolbar--align-space-between');
    });
  });

  // ─── Props ───────────────────────────────────────────────

  describe('props', () => {
    it('reflects variant attribute', async () => {
      const page = await create('<md-toolbar variant="floating"></md-toolbar>');
      expect(page.root?.getAttribute('variant')).toBe('floating');
    });

    it('reflects color attribute', async () => {
      const page = await create('<md-toolbar color="vibrant"></md-toolbar>');
      expect(page.root?.getAttribute('color')).toBe('vibrant');
    });

    it('reflects layout attribute', async () => {
      const page = await create('<md-toolbar variant="floating" layout="vertical"></md-toolbar>');
      expect(page.root?.getAttribute('layout')).toBe('vertical');
    });
  });

  // ─── Accessibility ──────────────────────────────────────

  describe('accessibility', () => {
    it('has role="toolbar"', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.getAttribute('role')).toBe('toolbar');
    });

    it('omits aria-label by default (no meaningless "toolbar" accessible name)', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      // role="toolbar" without a name is valid ARIA; the old literal "toolbar"
      // default was redundant with the role and non-localizable.
      expect(page.root?.getAttribute('aria-label')).toBeNull();
    });

    it('trims a whitespace-only aria-label to no accessible name', async () => {
      const page = await create('<md-toolbar aria-label="   "></md-toolbar>');
      expect(page.root?.getAttribute('aria-label')).toBeNull();
    });

    it('accepts custom aria-label', async () => {
      const page = await create('<md-toolbar aria-label="Formatting actions"></md-toolbar>');
      expect(page.root?.getAttribute('aria-label')).toBe('Formatting actions');
    });

    it('uses aria-labelledby and omits aria-label when labelledby is set', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<div>
          <span id="tb-lbl">Actions</span>
          <md-toolbar aria-labelledby="tb-lbl"></md-toolbar>
        </div>`,
      });
      const tb = page.body.querySelector('md-toolbar');
      expect(tb?.getAttribute('aria-labelledby')).toBe('tb-lbl');
      expect(tb?.getAttribute('aria-label')).toBeNull();
    });

    it('sets aria-orientation="horizontal" by default', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('sets aria-orientation="vertical" for vertical floating', async () => {
      const page = await create('<md-toolbar variant="floating" layout="vertical"></md-toolbar>');
      expect(page.root?.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('omits toolbar role and ARIA when containerSemantics is generic', async () => {
      const page = await create('<md-toolbar container-semantics="generic"></md-toolbar>');
      expect(page.root?.getAttribute('role')).toBeNull();
      expect(page.root?.getAttribute('aria-label')).toBeNull();
      expect(page.root?.getAttribute('aria-orientation')).toBeNull();
    });
  });

  describe('keyboard', () => {
    // Fixture with three distinct controls so direction and wrap are
    // distinguishable (a 2-button fixture can't tell ArrowRight from ArrowLeft
    // when both wrap to the same neighbor).
    const THREE = `<md-toolbar aria-label="Test">
      <button type="button">A</button>
      <button type="button">B</button>
      <button type="button">C</button>
    </md-toolbar>`;

    async function threeBar() {
      const page = await newSpecPage({ components: [MdToolbar], html: THREE });
      await page.waitForChanges();
      const buttons = Array.from(page.root!.querySelectorAll('button')) as HTMLButtonElement[];
      return { page, buttons };
    }

    /** Dispatch a keydown from a control and return which sibling got focus(). */
    function press(from: HTMLElement, all: HTMLElement[], key: string, mods: Partial<KeyboardEventInit> = {}) {
      const spies = all.map((b) => jest.spyOn(b, 'focus'));
      from.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
      const idx = spies.findIndex((s) => s.mock.calls.length > 0);
      spies.forEach((s) => s.mockRestore());
      return idx;
    }

    it('ArrowRight moves to the next control; ArrowLeft to the previous (direction-distinct)', async () => {
      const { buttons } = await threeBar();
      expect(press(buttons[1], buttons, 'ArrowRight')).toBe(2); // B → C
      expect(press(buttons[1], buttons, 'ArrowLeft')).toBe(0); // B → A
    });

    it('ArrowRight wraps last→first; ArrowLeft wraps first→last', async () => {
      const { buttons } = await threeBar();
      expect(press(buttons[2], buttons, 'ArrowRight')).toBe(0); // C → A
      expect(press(buttons[0], buttons, 'ArrowLeft')).toBe(2); // A → C
    });

    it('Home focuses the first control, End the last', async () => {
      const { buttons } = await threeBar();
      expect(press(buttons[2], buttons, 'Home')).toBe(0);
      expect(press(buttons[0], buttons, 'End')).toBe(2);
    });

    it('skips a disabled control during arrow navigation', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <button type="button">A</button>
          <button type="button" disabled>B</button>
          <button type="button">C</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const buttons = Array.from(page.root!.querySelectorAll('button')) as HTMLButtonElement[];
      // A → ArrowRight should land on C (B disabled, excluded from the set entirely)
      expect(press(buttons[0], buttons, 'ArrowRight')).toBe(2);
    });

    it('arrows REACH an aria-disabled (soft-disabled) control — discoverable, per APG', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <button type="button">A</button>
          <button type="button" aria-disabled="true">B</button>
          <button type="button">C</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const buttons = Array.from(page.root!.querySelectorAll('button')) as HTMLButtonElement[];
      // Unlike hard-disabled, a soft-disabled control stays in the arrow order so
      // keyboard users can discover it (activation is blocked by the control itself).
      expect(press(buttons[0], buttons, 'ArrowRight')).toBe(1);
    });

    it('does NOT hijack arrows on a modifier chord (Shift/Ctrl select or word-jump pass through)', async () => {
      const { buttons } = await threeBar();
      expect(press(buttons[1], buttons, 'ArrowRight', { shiftKey: true })).toBe(-1);
      expect(press(buttons[1], buttons, 'ArrowRight', { ctrlKey: true })).toBe(-1);
    });

    it('does NOT hijack arrows when focus is on a slotted text input (caret keeps working)', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Search">
          <input type="text" value="hello" />
          <button type="button">Go</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const input = page.root!.querySelector('input') as HTMLInputElement;
      const btn = page.root!.querySelector('button') as HTMLButtonElement;
      const btnFocus = jest.spyOn(btn, 'focus');
      const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      input.dispatchEvent(ev);
      expect(btnFocus).not.toHaveBeenCalled(); // focus stayed in the input
      expect(ev.defaultPrevented).toBe(false); // caret movement not preventDefault-ed
      btnFocus.mockRestore();
    });

    it('reaches a control wrapped in a non-focusable container', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <button type="button">A</button>
          <div class="group"><button type="button">B</button></div>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const buttons = Array.from(page.root!.querySelectorAll('button')) as HTMLButtonElement[];
      // A → ArrowRight finds the wrapped B (direct-children-only scan used to miss it)
      expect(press(buttons[0], buttons, 'ArrowRight')).toBe(1);
    });

    it('does not navigate in generic mode', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar container-semantics="generic">
          <button type="button">A</button>
          <button type="button">B</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const buttons = Array.from(page.root!.querySelectorAll('button')) as HTMLButtonElement[];
      expect(press(buttons[0], buttons, 'ArrowRight')).toBe(-1);
    });
  });

  // ─── Roving tabindex ────────────────────────────────────
  describe('roving tabindex', () => {
    it('makes exactly one control the tab stop (first by default)', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <button type="button">A</button>
          <button type="button">B</button>
          <button type="button">C</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const buttons = Array.from(page.root!.querySelectorAll('button')) as HTMLButtonElement[];
      expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    });

    it('does not rove in generic mode (controls keep their natural tab order)', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar container-semantics="generic">
          <button type="button">A</button>
          <button type="button">B</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const buttons = Array.from(page.root!.querySelectorAll('button')) as HTMLButtonElement[];
      expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual([null, null]);
    });

    it('excludes the FAB from the roving set (it stays its own tab stop)', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <button type="button" id="a">A</button>
          <button type="button" slot="fab" id="fab">F</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const a = page.root!.querySelector('#a')!;
      const fab = page.root!.querySelector('#fab')!;
      expect(a.getAttribute('tabindex')).toBe('0');
      expect(fab.getAttribute('tabindex')).toBeNull(); // untouched by roving
    });

    it('roves a soft-disabled (aria-disabled) member to -1 so it is not a stray extra Tab stop', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <button type="button" id="a">A</button>
          <button type="button" id="b" aria-disabled="true">B</button>
          <button type="button" id="c">C</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      const tabs = ['#a', '#b', '#c'].map((s) => page.root!.querySelector(s)!.getAttribute('tabindex'));
      // a is the active stop; the soft-disabled b is a MEMBER roved to -1 (not left at 0);
      // c is a non-active member at -1.
      expect(tabs).toEqual(['0', '-1', '-1']);
    });

    it('leaves md-switch / md-checkbox as their own Tab stops (not roved)', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <button type="button" id="a">A</button>
          <md-switch id="sw"></md-switch>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      // the button roves; md-switch is independent (never touched by roving)
      expect(page.root!.querySelector('#a')!.getAttribute('tabindex')).toBe('0');
      expect(page.root!.querySelector('#sw')!.getAttribute('tabindex')).toBeNull();
    });

    it('leaves a native <input type="checkbox"> as its own Tab stop (toggle parity with md-checkbox)', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <button type="button" id="a">A</button>
          <input type="checkbox" id="cb" />
          <button type="button" id="b">B</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      // Native and md-* toggles get the same Tab semantics: the checkbox is independent
      // (untouched), only the two buttons form the roving group.
      expect(page.root!.querySelector('#cb')!.getAttribute('tabindex')).toBeNull();
      expect(page.root!.querySelector('#a')!.getAttribute('tabindex')).toBe('0');
      expect(page.root!.querySelector('#b')!.getAttribute('tabindex')).toBe('-1');
    });

    it('leaves a [role="checkbox"] element as its own Tab stop (not roved)', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Test">
          <div id="cb" role="checkbox" aria-checked="false" tabindex="0">agree</div>
          <button type="button" id="a">A</button>
        </md-toolbar>`,
      });
      await page.waitForChanges();
      // author tabindex preserved — the ARIA checkbox is independent, the button roves
      expect(page.root!.querySelector('#cb')!.getAttribute('tabindex')).toBe('0');
      expect(page.root!.querySelector('#a')!.getAttribute('tabindex')).toBe('0');
    });
  });

  // ─── dev warning ────────────────────────────────────────
  describe('accessible-name dev warning', () => {
    it('warns when a toolbar has role but no accessible name', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      await newSpecPage({ components: [MdToolbar], html: `<md-toolbar><button>A</button></md-toolbar>` });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('accessible name'));
      warn.mockRestore();
    });

    it('does NOT warn when an accessible name is provided', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      await newSpecPage({ components: [MdToolbar], html: `<md-toolbar aria-label="Actions"><button>A</button></md-toolbar>` });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('does NOT warn in generic mode', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      await newSpecPage({ components: [MdToolbar], html: `<md-toolbar container-semantics="generic"><button>A</button></md-toolbar>` });
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('warns that a name on a generic container is ignored by AT (not a silent surprise)', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar container-semantics="generic" aria-label="Actions"><button>A</button></md-toolbar>`,
      });
      // the author's attribute is left as written (naming attrs are author-owned)…
      expect(page.root?.getAttribute('aria-label')).toBe('Actions');
      // …and the author is told in dev mode that AT will ignore it on a generic container
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('generic'));
      warn.mockRestore();
    });

    it('warns on a RUNTIME switch to generic with a name set (not only at load)', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Actions"><button>A</button></md-toolbar>`,
      });
      expect(warn).not.toHaveBeenCalled(); // named toolbar loads clean
      (page.root! as HTMLElement & { containerSemantics: string }).containerSemantics = 'generic';
      await page.waitForChanges();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('generic'));
      warn.mockRestore();
    });

    it('a runtime toolbar→generic switch does not destroy the author label; re-arming restores the managed name', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<md-toolbar aria-label="Actions"><button>A</button></md-toolbar>`,
      });
      const host = page.root! as HTMLElement & { containerSemantics: string };
      host.containerSemantics = 'generic';
      await page.waitForChanges();
      expect(host.getAttribute('aria-label')).toBe('Actions'); // author attribute survives
      host.containerSemantics = 'toolbar';
      await page.waitForChanges();
      expect(host.getAttribute('aria-label')).toBe('Actions'); // managed name back with role
      expect(host.getAttribute('role')).toBe('toolbar');
    });

    it('BOTH naming attributes survive a toolbar→generic→toolbar round trip (labelledby wins via ARIA precedence)', async () => {
      // Regression: the naming attrs are rendered as a pure function of their props in
      // both modes. A mode-dependent render used to let the vdom take ownership of
      // aria-label in generic mode and then diff it away on the switch back — silently
      // destroying the author's fallback name.
      const page = await newSpecPage({
        components: [MdToolbar],
        html: `<div>
          <span id="ttl">Formatting</span>
          <md-toolbar aria-label="Formatting" aria-labelledby="ttl"><button>A</button></md-toolbar>
        </div>`,
      });
      const host = page.body.querySelector('md-toolbar')! as HTMLElement & { containerSemantics: string };
      expect(host.getAttribute('aria-label')).toBe('Formatting'); // kept — accname prefers labelledby anyway
      expect(host.getAttribute('aria-labelledby')).toBe('ttl');
      host.containerSemantics = 'generic';
      await page.waitForChanges();
      host.containerSemantics = 'toolbar';
      await page.waitForChanges();
      expect(host.getAttribute('aria-label')).toBe('Formatting'); // NOT destroyed by the round trip
      expect(host.getAttribute('aria-labelledby')).toBe('ttl');
    });
  });

  // ─── Parts ──────────────────────────────────────────────

  describe('parts', () => {
    it('exposes container part', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('exposes fab-container part', async () => {
      const page = await create('<md-toolbar></md-toolbar>');
      expect(page.root?.shadowRoot?.querySelector('[part="fab-container"]')).toBeTruthy();
    });
  });

  // ─── RTL ────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdToolbar],
        html: '<div dir="rtl"><md-toolbar></md-toolbar></div>',
      });
      expect(page.root).toBeTruthy();
    });
  });
});
