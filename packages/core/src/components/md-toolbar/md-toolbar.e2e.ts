import { newE2EPage } from '@stencil/core/testing';

/**
 * Real-browser coverage for md-toolbar — the WAI-ARIA toolbar keyboard model
 * that the spec (JSDOM, no real focus/layout) cannot verify:
 *   • roving tabindex — a single Tab stop; arrows move within
 *   • arrow / Home / End movement with ACTUAL focus, incl. the custom-element
 *     (md-icon-button, groupTabindex) path, wrap, RTL, and vertical
 *   • the caret-hijack guard — arrows/Home/End are NOT stolen from a slotted
 *     text input, and modifier chords pass through
 *   • the FAB stays a separate Tab stop
 *   • layout-hidden controls are skipped
 */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

/** Identify the composed-tree focused element by a stable marker. */
async function activeId(page: E2EPage): Promise<string> {
  return page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    // climb to the nearest element carrying a data-id (the slotted control host)
    let el: Element | null = a;
    while (el && !el.getAttribute?.('data-id')) el = el.parentElement || (el.getRootNode() as ShadowRoot)?.host || null;
    return el?.getAttribute('data-id') ?? (a?.getAttribute?.('data-id') ?? a?.tagName ?? '');
  });
}

const ICONS = `
  <md-toolbar aria-label="Formatting">
    <md-icon-button data-id="a" icon="format_bold" aria-label="Bold"></md-icon-button>
    <md-icon-button data-id="b" icon="format_italic" aria-label="Italic"></md-icon-button>
    <md-icon-button data-id="c" icon="format_underlined" aria-label="Underline"></md-icon-button>
  </md-toolbar>`;

describe('md-toolbar (e2e)', () => {
  describe('roving tabindex', () => {
    it('exposes exactly one Tab stop across slotted md-icon-buttons', async () => {
      const page = await newE2EPage();
      await page.setContent(ICONS);
      await page.waitForChanges();
      const tabindexes = await page.evaluate(() =>
        Array.from(document.querySelectorAll('md-icon-button')).map((b) => b.getAttribute('tabindex')),
      );
      expect(tabindexes).toEqual(['0', '-1', '-1']);
    });

    it('Tab enters the toolbar to the active control, then leaves in one more Tab', async () => {
      const page = await newE2EPage();
      await page.setContent('<button data-id="before">before</button>' + ICONS + '<button data-id="after">after</button>');
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="before"]') as HTMLElement).focus());
      await page.keyboard.press('Tab'); // into toolbar
      expect(await activeId(page)).toBe('a');
      await page.keyboard.press('Tab'); // out of toolbar (roving = single stop)
      expect(await activeId(page)).toBe('after');
    });

    it('focusing a control makes it the new Tab stop', async () => {
      const page = await newE2EPage();
      await page.setContent(ICONS);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="c"]') as HTMLElement).focus());
      await page.waitForChanges();
      const tabindexes = await page.evaluate(() =>
        Array.from(document.querySelectorAll('md-icon-button')).map((b) => b.getAttribute('tabindex')),
      );
      expect(tabindexes).toEqual(['-1', '-1', '0']);
    });
  });

  describe('arrow navigation (real focus)', () => {
    it('ArrowRight / ArrowLeft move focus, distinct directions', async () => {
      const page = await newE2EPage();
      await page.setContent(ICONS);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="b"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('c');
      await page.keyboard.press('ArrowLeft');
      expect(await activeId(page)).toBe('b');
    });

    it('wraps last→first and first→last', async () => {
      const page = await newE2EPage();
      await page.setContent(ICONS);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="c"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('a');
      await page.keyboard.press('ArrowLeft');
      expect(await activeId(page)).toBe('c');
    });

    it('Home / End jump to first / last', async () => {
      const page = await newE2EPage();
      await page.setContent(ICONS);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="b"]') as HTMLElement).focus());
      await page.keyboard.press('End');
      expect(await activeId(page)).toBe('c');
      await page.keyboard.press('Home');
      expect(await activeId(page)).toBe('a');
    });

    it('skips a disabled control', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <md-icon-button data-id="a" icon="undo" aria-label="Undo"></md-icon-button>
          <md-icon-button data-id="b" icon="redo" aria-label="Redo" disabled></md-icon-button>
          <md-icon-button data-id="c" icon="save" aria-label="Save"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('c');
    });

    it('reaches a control wrapped in a non-focusable container', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <md-icon-button data-id="a" icon="undo" aria-label="Undo"></md-icon-button>
          <span class="wrap"><md-icon-button data-id="b" icon="redo" aria-label="Redo"></md-icon-button></span>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('b');
    });

    it('skips a display:none control (does not trap forward navigation)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <style>.hidden { display: none; }</style>
        <md-toolbar aria-label="T">
          <md-icon-button data-id="a" icon="undo" aria-label="Undo"></md-icon-button>
          <md-icon-button data-id="b" class="hidden" icon="redo" aria-label="Redo"></md-icon-button>
          <md-icon-button data-id="c" icon="save" aria-label="Save"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('c'); // not trapped on the hidden b
    });
  });

  describe('RTL + vertical', () => {
    it('RTL flips ArrowRight/ArrowLeft to follow reading direction', async () => {
      const page = await newE2EPage();
      await page.setContent('<div dir="rtl">' + ICONS + '</div>');
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="b"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight'); // RTL: visually leftward = previous
      expect(await activeId(page)).toBe('a');
      await page.keyboard.press('ArrowLeft');
      expect(await activeId(page)).toBe('b');
    });

    it('vertical floating toolbar navigates with ArrowUp / ArrowDown', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar variant="floating" layout="vertical" aria-label="Tools">
          <md-icon-button data-id="a" icon="brush" aria-label="Brush"></md-icon-button>
          <md-icon-button data-id="b" icon="eraser" aria-label="Eraser"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowDown');
      expect(await activeId(page)).toBe('b');
      await page.keyboard.press('ArrowUp');
      expect(await activeId(page)).toBe('a');
    });
  });

  describe('text-entry guard', () => {
    it('does NOT hijack arrows from a slotted text input — caret moves, focus stays', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="Search">
          <input data-id="q" type="text" value="hello world" />
          <md-icon-button data-id="go" icon="search" aria-label="Search"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => {
        const i = document.querySelector('[data-id="q"]') as HTMLInputElement;
        i.focus();
        i.setSelectionRange(5, 5); // caret after "hello"
      });
      await page.keyboard.press('ArrowRight');
      const state = await page.evaluate(() => {
        const i = document.querySelector('[data-id="q"]') as HTMLInputElement;
        return { caret: i.selectionStart, focused: document.activeElement === i };
      });
      expect(state.focused).toBe(true); // focus NOT stolen to the icon button
      expect(state.caret).toBe(6); // caret advanced one char
    });

    it('modifier chords (Shift+Arrow) pass through for text selection', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="Search">
          <input data-id="q" type="text" value="hello world" />
          <md-icon-button data-id="go" icon="search" aria-label="Search"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => {
        const i = document.querySelector('[data-id="q"]') as HTMLInputElement;
        i.focus();
        i.setSelectionRange(0, 0);
      });
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.up('Shift');
      const sel = await page.evaluate(() => {
        const i = document.querySelector('[data-id="q"]') as HTMLInputElement;
        return { start: i.selectionStart, end: i.selectionEnd, focused: document.activeElement === i };
      });
      expect(sel.focused).toBe(true);
      expect(sel.end).toBe(1); // one char selected, not a focus move
    });
  });

  describe('FAB', () => {
    it('keeps the paired FAB as a separate Tab stop (not in the roving set)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar variant="floating" aria-label="Actions">
          <md-icon-button data-id="a" icon="share" aria-label="Share"></md-icon-button>
          <md-icon-button data-id="b" icon="delete" aria-label="Delete"></md-icon-button>
          <md-fab data-id="fab" slot="fab" icon="add" aria-label="New"></md-fab>
        </md-toolbar>`);
      await page.waitForChanges();
      // roving only touches the two icon buttons; the FAB keeps its own tabindex=0
      const state = await page.evaluate(() => ({
        icons: Array.from(document.querySelectorAll('md-icon-button')).map((b) => b.getAttribute('tabindex')),
        fab: document.querySelector('md-fab')!.getAttribute('tabindex'),
      }));
      expect(state.icons).toEqual(['0', '-1']);
      expect(state.fab).toBe('0'); // untouched — separate stop, reachable by Tab after the toolbar
    });
  });

  // ───────────── color token map (guards the toolbar-only icon-button scheme) ─────────────
  describe('color scheme → slotted icon-button tokens', () => {
    it('vibrant tonal toggle: SELECTED gets a distinct container fill from UNSELECTED (not flattened)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar color="vibrant" aria-label="T">
          <md-icon-button data-id="off" variant="tonal" toggle icon="star" aria-label="Off"></md-icon-button>
          <md-icon-button data-id="on" variant="tonal" toggle selected icon="star" aria-label="On"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      const colors = await page.evaluate(() => {
        const read = (id: string) =>
          getComputedStyle(document.querySelector('[data-id="' + id + '"]')!).getPropertyValue('--md-icon-button-container-color').trim();
        return { off: read('off'), on: read('on') };
      });
      // the selected toggle must NOT look identical to the unselected one
      expect(colors.on).not.toBe('');
      expect(colors.off).not.toBe('');
      expect(colors.on).not.toBe(colors.off);
    });

    it('standard scheme tints a non-selected standard icon button (toolbar-only token map applies)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar color="standard" aria-label="T">
          <md-icon-button data-id="ib" variant="standard" icon="search" aria-label="Search"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      const tint = await page.evaluate(() =>
        getComputedStyle(document.querySelector('[data-id="ib"]')!).getPropertyValue('--md-icon-button-icon-color').trim());
      expect(tint).not.toBe(''); // the toolbar sets the icon ink token on the slotted button
    });
  });

  describe('setFocus()', () => {
    it('focuses the active roving control', async () => {
      const page = await newE2EPage();
      await page.setContent(ICONS);
      await page.waitForChanges();
      await page.evaluate(async () => {
        await (document.querySelector('md-toolbar') as HTMLElement & { setFocus: () => Promise<void> }).setFocus();
      });
      expect(await activeId(page)).toBe('a');
    });
  });

  // ───────────── BREAK-THE-FIX ROUND 2: adaptive roving (no keyboard traps) ─────────────
  describe('adaptive roving — text-entry + composites stay reachable', () => {
    it('a text field and its sibling buttons are BOTH keyboard-reachable (no roving dead-end)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <button data-id="before">before</button>
        <md-toolbar aria-label="Search">
          <input data-id="q" type="text" value="hi" />
          <md-icon-button data-id="go" icon="search" aria-label="Search"></md-icon-button>
          <md-icon-button data-id="clear" icon="clear" aria-label="Clear"></md-icon-button>
        </md-toolbar>
        <button data-id="after">after</button>`);
      await page.waitForChanges();
      // The input is its OWN tab stop (natural tabindex); the two icon buttons form the
      // roving group. Both must be reachable.
      const state = await page.evaluate(() => ({
        input: document.querySelector('[data-id="q"]')!.getAttribute('tabindex'),
        icons: Array.from(document.querySelectorAll('md-icon-button')).map((b) => b.getAttribute('tabindex')),
      }));
      expect(state.input).toBeNull(); // input NOT roved to -1 — keeps its natural stop
      expect(state.icons).toEqual(['0', '-1']); // buttons rove as one group
      // Tab: before → input → go (roving stop) → after. All reachable.
      await page.evaluate(() => (document.querySelector('[data-id="before"]') as HTMLElement).focus());
      await page.keyboard.press('Tab');
      expect(await activeId(page)).toBe('q');
      await page.keyboard.press('Tab');
      expect(await activeId(page)).toBe('go');
      // arrow within the roving group reaches the second button
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('clear');
    });

    it('a slotted md-button-group keeps its own arrows; trailing toolbar control stays reachable', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="Format">
          <md-button-group>
            <md-button data-id="g1">L</md-button>
            <md-button data-id="g2">R</md-button>
          </md-button-group>
          <md-icon-button data-id="x" icon="more_vert" aria-label="More"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      // The group is a composite (its own stop, self-manages arrows); only the trailing
      // icon button is in the toolbar roving group.
      const x = await page.evaluate(() => document.querySelector('[data-id="x"]')!.getAttribute('tabindex'));
      expect(x).toBe('0'); // reachable — NOT stranded behind the group
      // Focusing the trailing control and it's the roving stop
      await page.evaluate(() => (document.querySelector('[data-id="x"]') as HTMLElement).focus());
      expect(await activeId(page)).toBe('x');
    });

    it('does NOT hijack arrows from a slotted range input (value changes, focus stays)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="Zoom">
          <input data-id="r" type="range" min="0" max="10" value="5" />
          <md-icon-button data-id="fit" icon="fit_screen" aria-label="Fit"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="r"]') as HTMLInputElement).focus());
      await page.keyboard.press('ArrowRight');
      const state = await page.evaluate(() => {
        const r = document.querySelector('[data-id="r"]') as HTMLInputElement;
        return { value: r.value, focused: document.activeElement === r };
      });
      expect(state.focused).toBe(true); // focus not stolen
      expect(state.value).toBe('6'); // range value advanced
    });

    it('re-establishes roving + navigation after the toolbar is reparented', async () => {
      const page = await newE2EPage();
      await page.setContent('<div id="a">' + ICONS + '</div><div id="b"></div>');
      await page.waitForChanges();
      await page.evaluate(() => document.getElementById('b')!.appendChild(document.querySelector('md-toolbar')!));
      await page.waitForChanges();
      // roving still intact after the move
      const tabindexes = await page.evaluate(() =>
        Array.from(document.querySelectorAll('md-icon-button')).map((btn) => btn.getAttribute('tabindex')),
      );
      expect(tabindexes).toEqual(['0', '-1', '-1']);
      // and arrow navigation still works
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('b');
    });

    it('does NOT rove or hijack a contenteditable="plaintext-only" region', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="Editor">
          <div data-id="ed" contenteditable="plaintext-only" tabindex="0">hello world</div>
          <md-icon-button data-id="bold" icon="format_bold" aria-label="Bold"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      // the editable region is an independent stop; the icon button is the roving group
      const ed = await page.evaluate(() => document.querySelector('[data-id="ed"]')!.getAttribute('tabindex'));
      expect(ed).toBe('0'); // NOT forced to -1
      await page.evaluate(() => {
        const d = document.querySelector('[data-id="ed"]') as HTMLElement;
        d.focus();
        const r = document.createRange();
        r.setStart(d.firstChild!, 5);
        r.collapse(true);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(r);
      });
      await page.keyboard.press('ArrowRight');
      const stayed = await page.evaluate(() => document.activeElement === document.querySelector('[data-id="ed"]'));
      expect(stayed).toBe(true); // caret moved within the text; focus NOT stolen to the button
    });

    it('honors an author tabindex="-1" opt-out (not promoted to a roving Tab stop)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <button data-id="before">before</button>
        <md-toolbar aria-label="T">
          <span data-id="label" tabindex="-1">Label</span>
          <button data-id="a">A</button>
          <button data-id="b">B</button>
        </md-toolbar>`);
      await page.waitForChanges();
      const state = await page.evaluate(() => ({
        label: document.querySelector('[data-id="label"]')!.getAttribute('tabindex'),
        a: document.querySelector('[data-id="a"]')!.getAttribute('tabindex'),
      }));
      expect(state.label).toBe('-1'); // opt-out preserved, not promoted to 0
      expect(state.a).toBe('0'); // the real first control is the roving stop
      // Tab into the toolbar lands on A, not the inert label
      await page.evaluate(() => (document.querySelector('[data-id="before"]') as HTMLElement).focus());
      await page.keyboard.press('Tab');
      expect(await activeId(page)).toBe('a');
    });

    it('re-anchors the Tab stop when the active control is hidden via inline style', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <md-icon-button data-id="a" icon="undo" aria-label="Undo"></md-icon-button>
          <md-icon-button data-id="b" icon="redo" aria-label="Redo"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      // hide the active (first) control via inline style; the observer re-syncs roving
      await page.evaluate(() => ((document.querySelector('[data-id="a"]') as HTMLElement).style.display = 'none'));
      await new Promise((r) => setTimeout(r, 60)); // allow the coalesced rAF re-sync
      const bTab = await page.evaluate(() => document.querySelector('[data-id="b"]')!.getAttribute('tabindex'));
      expect(bTab).toBe('0'); // b promoted to the Tab stop — toolbar not stranded
    });

    it('keeps the floating pill padding intact (ring-bleed regression)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar variant="floating" layout="vertical" aria-label="Tools">
          <md-icon-button data-id="a" icon="brush" aria-label="Brush"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      const pad = await page.evaluate(() => {
        const c = document.querySelector('md-toolbar')!.shadowRoot!.querySelector('.md-toolbar__container')!;
        const s = getComputedStyle(c);
        return { block: s.paddingTop, inline: s.paddingLeft };
      });
      expect(pad.block).toBe('8px'); // pill padding preserved (was wiped to 0 / 4px)
      expect(pad.inline).toBe('8px');
    });

    it('vertical: ArrowDown and ArrowUp are direction-distinct (3-item)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar variant="floating" layout="vertical" aria-label="Tools">
          <md-icon-button data-id="a" icon="brush" aria-label="Brush"></md-icon-button>
          <md-icon-button data-id="b" icon="palette" aria-label="Palette"></md-icon-button>
          <md-icon-button data-id="c" icon="crop" aria-label="Crop"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="b"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowDown');
      expect(await activeId(page)).toBe('c');
      await page.keyboard.press('ArrowUp');
      expect(await activeId(page)).toBe('b');
      // off-axis arrows on a vertical toolbar do nothing
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('b');
    });

    it('off-axis arrows are ignored on a horizontal toolbar (do not steal focus)', async () => {
      const page = await newE2EPage();
      await page.setContent(ICONS);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowDown');
      expect(await activeId(page)).toBe('a'); // unchanged
      await page.keyboard.press('ArrowUp');
      expect(await activeId(page)).toBe('a');
    });

    it('honors tabindex="-1" on a real roving-eligible <button> (optedOut path)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <button data-id="opt" tabindex="-1">Opt out</button>
          <button data-id="a">A</button>
          <button data-id="b">B</button>
        </md-toolbar>`);
      await page.waitForChanges();
      const state = await page.evaluate(() => ({
        opt: document.querySelector('[data-id="opt"]')!.getAttribute('tabindex'),
        a: document.querySelector('[data-id="a"]')!.getAttribute('tabindex'),
      }));
      expect(state.opt).toBe('-1'); // opt-out preserved (not promoted to a roving stop)
      expect(state.a).toBe('0');
      // arrow nav never lands on the opted-out button
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('b');
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('a'); // wraps A↔B, skipping opt
    });

    it('@Watch(variant/layout): switching to vertical re-syncs the nav axis', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar variant="floating" aria-label="T">
          <md-icon-button data-id="a" icon="brush" aria-label="Brush"></md-icon-button>
          <md-icon-button data-id="b" icon="crop" aria-label="Crop"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      await page.evaluate(() => (document.querySelector('md-toolbar') as HTMLElement).setAttribute('layout', 'vertical'));
      await page.waitForChanges();
      expect(await page.evaluate(() => document.querySelector('md-toolbar')!.getAttribute('aria-orientation'))).toBe('vertical');
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowDown');
      expect(await activeId(page)).toBe('b'); // now navigates on the vertical axis
    });

    it('toggles the fab-container visibility as the fab slot is populated / emptied', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-toolbar aria-label="T"><md-icon-button icon="a" aria-label="a"></md-icon-button></md-toolbar>');
      await page.waitForChanges();
      const hiddenAt = () => page.evaluate(() =>
        document.querySelector('md-toolbar')!.shadowRoot!.querySelector('[part="fab-container"]')!.classList.contains('md-toolbar__fab-container--hidden'));
      expect(await hiddenAt()).toBe(true); // no fab → hidden
      await page.evaluate(() => {
        const fab = document.createElement('md-fab');
        fab.setAttribute('slot', 'fab');
        fab.setAttribute('icon', 'add');
        document.querySelector('md-toolbar')!.appendChild(fab);
      });
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 60));
      expect(await hiddenAt()).toBe(false); // fab added → shown
    });

    it('docked FAB sits at exactly --md-toolbar-fab-gap from the bar (no gap double-count)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar variant="docked" aria-label="T" style="--md-toolbar-fab-gap: 16px;">
          <md-icon-button data-id="a" icon="search" aria-label="Search"></md-icon-button>
          <md-fab data-id="fab" slot="fab" icon="add" aria-label="New"></md-fab>
        </md-toolbar>`);
      await page.waitForChanges();
      const gap = await page.evaluate(() => {
        const host = document.querySelector('md-toolbar')!;
        const container = host.shadowRoot!.querySelector('.md-toolbar__container')!.getBoundingClientRect();
        const fabWrap = host.shadowRoot!.querySelector('.md-toolbar__fab-container')!.getBoundingClientRect();
        return Math.round(fabWrap.left - container.right);
      });
      expect(gap).toBe(16); // exactly fab-gap, not 48 (host-gap + fab-gap)
    });

    it('a soft-disabled (aria-disabled) button is roved AND stays arrow-reachable (APG)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <md-icon-button data-id="a" icon="undo" aria-label="Undo"></md-icon-button>
          <md-icon-button data-id="b" icon="redo" aria-label="Redo" aria-disabled="true"></md-icon-button>
          <md-icon-button data-id="c" icon="save" aria-label="Save"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      // default Tab stop prefers the enabled control; the disabled one is roved to -1 (not a stray stop)
      const tabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('md-icon-button')).map((x) => x.getAttribute('tabindex')));
      expect(tabs).toEqual(['0', '-1', '-1']);
      // but arrows still LAND on the disabled control (focusable for discoverability)
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('b');
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('c');
    });

    it('a registered md-text-field is independent: its arrows are not stolen and buttons rove separately', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="Search">
          <md-text-field data-id="tf" label="Query" value="hello world"></md-text-field>
          <md-icon-button data-id="go" icon="search" aria-label="Search"></md-icon-button>
          <md-icon-button data-id="clear" icon="clear" aria-label="Clear"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      // md-text-field is NOT roved (keeps its own host — no toolbar tabindex stamp)
      const tfTab = await page.evaluate(() => document.querySelector('[data-id="tf"]')!.getAttribute('tabindex'));
      expect(tfTab).toBeNull();
      // the two icon buttons form the roving group
      const icons = await page.evaluate(() =>
        Array.from(document.querySelectorAll('md-icon-button')).map((x) => x.getAttribute('tabindex')));
      expect(icons).toEqual(['0', '-1']);
      // focus the inner input, move the caret with ArrowRight — focus must NOT jump to a button
      await page.evaluate(() => {
        const tf = document.querySelector('[data-id="tf"]') as HTMLElement;
        const input = tf.shadowRoot!.querySelector('input') as HTMLInputElement;
        input.focus();
        input.setSelectionRange(2, 2);
      });
      await page.keyboard.press('ArrowRight');
      const state = await page.evaluate(() => {
        const input = document.querySelector('[data-id="tf"]')!.shadowRoot!.querySelector('input') as HTMLInputElement;
        return { caret: input.selectionStart, focusedInField: document.activeElement === document.querySelector('[data-id="tf"]') };
      });
      expect(state.caret).toBe(3); // caret advanced — arrows not hijacked
      expect(state.focusedInField).toBe(true); // md-text-field kept focus (delegatesFocus)
    });

    it('a registered md-switch is its own Tab stop, never roved by the toolbar', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <md-icon-button data-id="a" icon="grid" aria-label="Grid"></md-icon-button>
          <md-switch data-id="sw"></md-switch>
        </md-toolbar>`);
      await page.waitForChanges();
      // toolbar only roves the icon button; the switch keeps its own host tabindex untouched
      expect(await page.evaluate(() => document.querySelector('[data-id="a"]')!.getAttribute('tabindex'))).toBe('0');
      const swHostTab = await page.evaluate(() => document.querySelector('[data-id="sw"]')!.getAttribute('tabindex'));
      // md-switch manages its own tabindex (not '-1' from the toolbar roving)
      expect(swHostTab).not.toBe('-1');
    });

    it('generic→toolbar at runtime re-arms role + roving and preserves the accessible name', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar container-semantics="generic" aria-label="Editor">
          <button data-id="a">A</button>
          <button data-id="b">B</button>
        </md-toolbar>`);
      await page.waitForChanges();
      // generic: no role, natural tab order
      expect(await page.evaluate(() => document.querySelector('md-toolbar')!.getAttribute('role'))).toBeNull();
      // flip to toolbar
      await page.evaluate(() => document.querySelector('md-toolbar')!.setAttribute('container-semantics', 'toolbar'));
      await page.waitForChanges();
      const after = await page.evaluate(() => ({
        role: document.querySelector('md-toolbar')!.getAttribute('role'),
        label: document.querySelector('md-toolbar')!.getAttribute('aria-label'),
        tabs: Array.from(document.querySelectorAll('button')).map((x) => x.getAttribute('tabindex')),
      }));
      expect(after.role).toBe('toolbar'); // role re-armed
      expect(after.label).toBe('Editor'); // author name preserved
      expect(after.tabs).toEqual(['0', '-1']); // roving re-established
    });

    it('switching containerSemantics toolbar→generic at runtime restores natural tab order', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <button data-id="a">A</button>
          <button data-id="b">B</button>
        </md-toolbar>`);
      await page.waitForChanges();
      let tabs = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((x) => x.getAttribute('tabindex')));
      expect(tabs).toEqual(['0', '-1']);
      await page.evaluate(() => ((document.querySelector('md-toolbar') as HTMLElement).setAttribute('container-semantics', 'generic')));
      await page.waitForChanges();
      tabs = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((x) => x.getAttribute('tabindex')));
      expect(tabs).toEqual([null, null]); // roving torn down — both are natural tab stops again
      expect(await page.evaluate(() => document.querySelector('md-toolbar')!.getAttribute('role'))).toBeNull();
    });
  });

  // ───────────── COLOR TOKEN MAP (measured, not assumed) ─────────────
  // The standard/vibrant schemes drive slotted md-icon-button ink/fill via ::slotted
  // custom-property overrides (CSS only — nothing to catch in spec). Measure the
  // computed colors on the icon-button HOST, which carries `color`/`background-color`.
  describe('color token map (measured)', () => {
    /** Computed ink + fill of the md-icon-button host matching a selector. */
    async function paint(page: E2EPage, selector: string) {
      return page.evaluate((sel: string) => {
        const s = getComputedStyle(document.querySelector(sel)!);
        return { ink: s.color, fill: s.backgroundColor };
      }, selector);
    }

    it('standard toolbar: slotted standard icon button gets on-surface-variant ink', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar color="standard" aria-label="T">
          <md-icon-button icon="search" aria-label="Search"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      expect((await paint(page, 'md-icon-button')).ink).toBe('rgb(73, 69, 79)'); // on-surface-variant
    });

    it('vibrant toolbar: slotted standard icon button gets on-surface ink (NOT the icon-button default)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar color="vibrant" aria-label="T">
          <md-icon-button icon="search" aria-label="Search"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      // on-surface — distinct from the md-icon-button standalone default (on-surface-variant),
      // so this proves the toolbar ::slotted override actually reached the button.
      expect((await paint(page, 'md-icon-button')).ink).toBe('rgb(28, 27, 31)');
    });

    it('vibrant tonal toggle: unselected recedes (surface-container), selected pops (secondary-container)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar color="vibrant" aria-label="T">
          <md-icon-button id="off" variant="tonal" toggle icon="bookmark" aria-label="Save"></md-icon-button>
          <md-icon-button id="on" variant="tonal" toggle selected icon="star" aria-label="Star"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      const off = await paint(page, '#off');
      const on = await paint(page, '#on');
      expect(off.fill).toBe('rgb(243, 237, 247)'); // surface-container — neutral on the tinted bar
      expect(off.ink).toBe('rgb(28, 27, 31)'); // on-surface
      expect(on.fill).toBe('rgb(232, 222, 248)'); // secondary-container — legible "on" state
      expect(on.ink).toBe('rgb(30, 25, 43)'); // on-secondary-container
      expect(on.fill).not.toBe(off.fill); // selected must never flatten into unselected
    });

    it('standard toolbar: a SELECTED standard toggle keeps its own selected ink (tint is non-selected only)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar color="standard" aria-label="T">
          <md-icon-button toggle selected icon="star" aria-label="Star"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      // primary — the icon button's own selected ink; the toolbar's neutral tint is scoped
      // to :not(--selected) so it must not erase the selected affordance.
      expect((await paint(page, 'md-icon-button')).ink).toBe('rgb(103, 80, 164)');
    });

    it('hex fallbacks carry the vibrant map for a token-less consumer (fallback arm forced)', async () => {
      // The e2e harness always loads the tokens globalStyle, so the var() fallbacks are
      // normally inert — every other color test passes via the token arm. Force the
      // fallback arm by declaring the sys tokens `initial` (guaranteed-invalid) on the
      // toolbar: the slotted buttons inherit that, so var(--md-sys-…, #hex) must resolve
      // to the hex. This is the ONLY guard that the fallbacks match the light tokens.
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar color="vibrant" aria-label="T" style="
            --md-sys-color-on-surface: initial;
            --md-sys-color-surface-container: initial;
            --md-sys-color-secondary-container: initial;
            --md-sys-color-on-secondary-container: initial;">
          <md-icon-button data-id="std" icon="search" aria-label="Search"></md-icon-button>
          <md-icon-button data-id="off" variant="tonal" toggle icon="bookmark" aria-label="Save"></md-icon-button>
          <md-icon-button data-id="on" variant="tonal" toggle selected icon="star" aria-label="Star"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      const std = await paint(page, '[data-id="std"]');
      const off = await paint(page, '[data-id="off"]');
      const on = await paint(page, '[data-id="on"]');
      expect(std.ink).toBe('rgb(28, 27, 31)'); // #1C1B1F fallback (icon-button default would be #49454F)
      expect(off.fill).toBe('rgb(243, 237, 247)'); // #F3EDF7 fallback (default would be transparent)
      expect(on.fill).toBe('rgb(232, 222, 248)'); // #E8DEF8 fallback
      expect(on.ink).toBe('rgb(30, 25, 43)'); // #1E192B fallback
    });
  });

  // ───────────── TOGGLE PARITY + SCROLLBAR OPT-OUT ─────────────
  describe('native toggle parity + scrollbar token', () => {
    it('a native checkbox keeps its own Tab stop; buttons rove around it', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <md-icon-button data-id="a" icon="undo" aria-label="Undo"></md-icon-button>
          <input data-id="cb" type="checkbox" />
          <md-icon-button data-id="b" icon="redo" aria-label="Redo"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      const state = await page.evaluate(() => ({
        cb: document.querySelector('[data-id="cb"]')!.getAttribute('tabindex'),
        icons: Array.from(document.querySelectorAll('md-icon-button')).map((b) => b.getAttribute('tabindex')),
      }));
      expect(state.cb).toBeNull(); // independent — same Tab semantics as md-checkbox
      expect(state.icons).toEqual(['0', '-1']); // buttons still one roving group
      // arrows from the roving group skip OVER the checkbox (a→b directly)
      await page.evaluate(() => (document.querySelector('[data-id="a"]') as HTMLElement).focus());
      await page.keyboard.press('ArrowRight');
      expect(await activeId(page)).toBe('b');
    });

    it('re-syncs when a roved button is upgraded to role="checkbox" at runtime (no stranded tabindex)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T">
          <button data-id="a">A</button>
          <button data-id="b">B</button>
        </md-toolbar>`);
      await page.waitForChanges();
      // b holds the toolbar's roving stamp (tabindex="-1")
      expect(await page.evaluate(() => document.querySelector('[data-id="b"]')!.getAttribute('tabindex'))).toBe('-1');
      // upgrade b to a toggle at runtime — it reclassifies as independent, and the
      // observer (which watches `role`) must RESTORE its tabindex, not strand it at -1
      await page.evaluate(() => document.querySelector('[data-id="b"]')!.setAttribute('role', 'checkbox'));
      await new Promise((r) => setTimeout(r, 60)); // coalesced rAF re-sync
      const state = await page.evaluate(() => ({
        b: document.querySelector('[data-id="b"]')!.getAttribute('tabindex'),
        a: document.querySelector('[data-id="a"]')!.getAttribute('tabindex'),
      }));
      expect(state.b).toBeNull(); // stamp restored — b is its own natural Tab stop again
      expect(state.a).toBe('0'); // a remains the (only) roving stop
    });

    it('full-width recipe: sized host + ::part(container) flex fills; default pill still hugs content', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <style>
          #full md-toolbar { margin: 0; }
          #full md-toolbar::part(container) { flex: 1; }
        </style>
        <div id="full" style="width: 600px;">
          <md-toolbar variant="floating" style="width: 100%;" aria-label="Editor">
            <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
            <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
            <md-icon-button icon="format_underlined" aria-label="Underline"></md-icon-button>
          </md-toolbar>
        </div>
        <div id="plain" style="width: 600px;">
          <md-toolbar variant="floating" aria-label="Plain">
            <md-icon-button icon="format_bold" aria-label="Bold"></md-icon-button>
            <md-icon-button icon="format_italic" aria-label="Italic"></md-icon-button>
            <md-icon-button icon="format_underlined" aria-label="Underline"></md-icon-button>
          </md-toolbar>
        </div>`);
      await page.waitForChanges();
      const geo = await page.evaluate(() => {
        const measure = (wrapId: string) => {
          const wrap = document.getElementById(wrapId)!;
          const host = wrap.querySelector('md-toolbar')!;
          const container = host.shadowRoot!.querySelector('.md-toolbar__container')!;
          return {
            wrap: wrap.getBoundingClientRect().width,
            pill: Math.round(container.getBoundingClientRect().width),
            offset: Math.round(container.getBoundingClientRect().left - wrap.getBoundingClientRect().left),
          };
        };
        return { full: measure('full'), plain: measure('plain') };
      });
      // Recipe: pill spans the wrapper edge-to-edge (was 144px content-width, offset 16).
      expect(geo.full.pill).toBe(600);
      expect(geo.full.offset).toBe(0);
      // Default MD3 free-placed pill is untouched: hugs content (3×40 + 2×4 gap + 16 padding).
      expect(geo.plain.pill).toBe(144);
    });

    it('scrollbar-width follows --md-toolbar-scrollbar-width (restores ::-webkit-scrollbar styling)', async () => {
      const page = await newE2EPage();
      await page.setContent(`
        <md-toolbar aria-label="T" style="--md-toolbar-scrollbar-width: auto;">
          <md-icon-button icon="search" aria-label="Search"></md-icon-button>
        </md-toolbar>
        <md-toolbar id="default" aria-label="T2">
          <md-icon-button icon="star" aria-label="Star"></md-icon-button>
        </md-toolbar>`);
      await page.waitForChanges();
      const widths = await page.evaluate(() =>
        Array.from(document.querySelectorAll('md-toolbar')).map(
          (t) => getComputedStyle(t.shadowRoot!.querySelector('.md-toolbar__container')!).scrollbarWidth,
        ),
      );
      expect(widths).toEqual(['auto', 'thin']); // overridden vs default
    });
  });
});
