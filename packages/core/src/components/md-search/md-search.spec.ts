import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdList } from '../md-list/md-list';
import { MdListItem } from '../md-list-item/md-list-item';
import { MdSearch } from './md-search';

describe('md-search', () => {
  // ─────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────

  /** Default bar-bearing instance (docked) unless layout/trigger is already set. */
  function resolveSearchHtml(html: string, bare = false): string {
    if (bare || /\blayout=|\btrigger=/.test(html)) return html;
    return html.replace(/<md-search\b/, '<md-search layout="docked"');
  }

  async function create(html: string, bare = false) {
    return newSpecPage({
      components: [MdSearch],
      html: resolveSearchHtml(html, bare),
    });
  }

  /** Preserve the component's prop defaults (full-screen + icon trigger). */
  async function createBare(html: string) {
    return create(html, true);
  }

  /** md-list + md-list-item are required for roving-tabindex result navigation tests. */
  async function createWithListResults(html: string) {
    return newSpecPage({
      components: [MdSearch, MdList, MdListItem],
      html: resolveSearchHtml(html),
    });
  }

  /** Install a minimal Web Speech API mock on global + spec-page windows. */
  function installSpeechRecognition(
    page?: { win: Window },
    options: { startThrows?: boolean; stopThrows?: boolean } = {},
  ) {
    const instances: MockRecognition[] = [];

    class MockRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start = jest.fn(function (this: MockRecognition) {
        if (options.startThrows) throw new Error('SpeechRecognition already started');
        instances.push(this);
      });
      stop = jest.fn(function (this: MockRecognition) {
        if (options.stopThrows) throw new Error('SpeechRecognition not started');
      });
      abort = jest.fn();
    }

    const assign = (w: Window) => {
      const target = w as unknown as {
        SpeechRecognition?: typeof MockRecognition;
        webkitSpeechRecognition?: typeof MockRecognition;
      };
      target.SpeechRecognition = MockRecognition;
      target.webkitSpeechRecognition = MockRecognition;
    };

    assign(window);
    if (page?.win && page.win !== window) assign(page.win);

    return {
      instances,
      last: () => instances[instances.length - 1],
      /** Force a re-render so `isVoiceSupported()` re-evaluates after install. */
      async rerenderVoice(pageToUpdate: {
        rootInstance?: MdSearch;
        waitForChanges: () => Promise<void>;
      }) {
        if (!pageToUpdate.rootInstance) return;
        (pageToUpdate.rootInstance as { placeholder: string }).placeholder = 'Search';
        await pageToUpdate.waitForChanges();
      },
      cleanup: () => {
        const targets = [window, page?.win].filter(Boolean) as Window[];
        for (const w of targets) {
          const target = w as unknown as {
            SpeechRecognition?: typeof MockRecognition;
            webkitSpeechRecognition?: typeof MockRecognition;
          };
          delete target.SpeechRecognition;
          delete target.webkitSpeechRecognition;
        }
      },
    };
  }

  /** Flush one animation frame (open-focus, loading morph, etc.). */
  async function flushRaf() {
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'undefined') {
        resolve();
        return;
      }
      requestAnimationFrame(() => resolve());
    });
  }

  /** Dispatch slotchange with a mocked assignedElements list. */
  async function dispatchSlotChange(
    page: Awaited<ReturnType<typeof create>>,
    slotName: 'leading' | 'trailing' | 'results',
    assigned: Element[],
  ) {
    const slot = page.root?.shadowRoot?.querySelector(
      `slot[name="${slotName}"]`,
    ) as HTMLSlotElement | null;
    expect(slot).toBeTruthy();
    jest.spyOn(slot!, 'assignedElements').mockReturnValue(assigned as HTMLElement[]);
    slot!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
  }

  /** Install a ResizeObserver mock that exposes the callback for manual firing. */
  function installResizeObserverMock() {
    let callback: (() => void) | null = null;
    const Original = global.ResizeObserver;
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        callback = () => cb([], this as unknown as ResizeObserver);
      }
      observe = jest.fn();
      disconnect = jest.fn();
    }
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    return {
      fire: () => callback?.(),
      restore: () => {
        global.ResizeObserver = Original;
        callback = null;
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await createBare('<md-search></md-search>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-search');
      expect(page.root).toHaveClass('md-search--contained');
      expect(page.root).toHaveClass('md-search--full-screen');
      expect(page.root).toHaveClass('md-search--closed');
    });

    it('renders the panel part (no scrim — full-screen is a plain fade)', async () => {
      const page = await createBare('<md-search></md-search>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="panel"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="scrim"]')).toBeNull();
    });

    it('defaults full-screen to an icon trigger when closed', async () => {
      const page = await create('<md-search layout="full-screen"></md-search>');
      expect(page.root).toHaveClass('md-search--trigger-icon');
      expect(page.root?.shadowRoot?.querySelector('[part="trigger"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="bar"]')).toBeNull();
      expect(
        page.root?.shadowRoot?.querySelector('[part="trigger-button"]'),
      ).toBeTruthy();
    });

    it('renders the resting bar for docked layout', async () => {
      const page = await create('<md-search layout="docked"></md-search>');
      expect(page.root).toHaveClass('md-search--trigger-bar');
      expect(page.root?.shadowRoot?.querySelector('[part="bar"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="trigger"]')).toBeNull();
    });

    it('allows trigger="bar" on full-screen for a resting search bar', async () => {
      const page = await create(
        '<md-search layout="full-screen" trigger="bar"></md-search>',
      );
      expect(page.root).toHaveClass('md-search--trigger-bar');
      expect(page.root?.shadowRoot?.querySelector('[part="bar"]')).toBeTruthy();
    });

    it('does not render the divider when open without results chrome', async () => {
      const page = await create('<md-search open variant="divided"></md-search>');
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="divider"]')).toBeNull();
      expect(page.root).not.toHaveClass('md-search--panel-content');
    });

    it('renders the divider when open with an empty-state query', async () => {
      const page = await create(
        '<md-search open variant="divided" value="cats"></md-search>',
      );
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="divider"]')).toBeTruthy();
      expect(page.root).toHaveClass('md-search--panel-content');
    });

    it('never renders a divider on the contained variant', async () => {
      const page = await create('<md-search variant="contained" open></md-search>');
      expect(page.root?.shadowRoot?.querySelector('[part="divider"]')).toBeNull();
    });

    it('renders the divider for divided only when results chrome is visible', async () => {
      const closed = await create('<md-search variant="divided"></md-search>');
      expect(closed.root?.shadowRoot?.querySelector('[part="divider"]')).toBeNull();

      const openEmpty = await create('<md-search variant="divided" open></md-search>');
      expect(openEmpty.root?.shadowRoot?.querySelector('[part="divider"]')).toBeNull();

      const withResults = await create(
        `<md-search variant="divided" open value="a">
           <md-list-item slot="results">One</md-list-item>
         </md-search>`,
      );
      await withResults.waitForChanges();
      expect(withResults.root?.shadowRoot?.querySelector('[part="divider"]')).toBeTruthy();
    });

    it('renders the results scroll viewport around the results slot by default', async () => {
      const page = await create('<md-search></md-search>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      const scroll = panel?.querySelector('.md-search__results-scroll');
      const slot = scroll?.querySelector('slot[name="results"]');
      expect(scroll).toBeTruthy();
      expect(slot).toBeTruthy();
    });

    it('renders a plain results scroll region', async () => {
      const page = await create('<md-search></md-search>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.querySelector('.md-search__results-scroll')).toBeTruthy();
    });

    it('renders the leading and trailing parts', async () => {
      const page = await create('<md-search></md-search>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="leading"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="trailing"]')).toBeTruthy();
    });

    it('renders the input as a combobox (APG popup search pattern)', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input).toBeTruthy();
      expect(input?.getAttribute('role')).toBe('combobox');
      expect(input?.getAttribute('type')).toBe('search');
      expect(input?.getAttribute('aria-autocomplete')).toBe('list');
      expect(input?.getAttribute('aria-controls')).toBe('md-search-panel');
    });

    it('sets aria-hidden on the panel when closed', async () => {
      const page = await create('<md-search></md-search>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('aria-hidden')).toBe('true');
    });

    it('exposes a panel element matching aria-controls', async () => {
      const page = await create('<md-search></md-search>');
      expect(page.root?.shadowRoot?.querySelector('#md-search-panel')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Variant axis
  // ─────────────────────────────────────────────────────────────────────

  describe('variant', () => {
    it('defaults to contained', async () => {
      const page = await create('<md-search></md-search>');
      expect(page.root).toHaveClass('md-search--contained');
      expect(page.root).not.toHaveClass('md-search--divided');
    });

    it('applies the divided class when variant="divided"', async () => {
      const page = await create('<md-search variant="divided"></md-search>');
      expect(page.root).toHaveClass('md-search--divided');
      expect(page.root).not.toHaveClass('md-search--contained');
    });

    it('reflects the variant attribute', async () => {
      const page = await create('<md-search variant="divided"></md-search>');
      expect(page.root?.getAttribute('variant')).toBe('divided');
    });

    it('combines contained with full-screen open (full-bleed bar chrome)', async () => {
      const page = await create(
        '<md-search variant="contained" layout="full-screen" open></md-search>',
      );
      expect(page.root).toHaveClass('md-search--contained');
      expect(page.root).toHaveClass('md-search--full-screen');
      expect(page.root).toHaveClass('md-search--open');
      expect(
        page.root?.shadowRoot?.querySelector('.md-search__panel--full-screen'),
      ).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Layout axis
  // ─────────────────────────────────────────────────────────────────────

  describe('layout', () => {
    it('defaults to full-screen', async () => {
      const page = await createBare('<md-search></md-search>');
      expect(page.root).toHaveClass('md-search--full-screen');
    });

    it('applies the docked class when layout="docked"', async () => {
      const page = await create('<md-search layout="docked"></md-search>');
      expect(page.root).toHaveClass('md-search--docked');
      expect(page.root).not.toHaveClass('md-search--full-screen');
    });

    it('never renders a scrim part (full-screen open is a plain fade, no dimmer)', async () => {
      const fullScreen = await create('<md-search layout="full-screen"></md-search>');
      expect(fullScreen.root?.shadowRoot?.querySelector('[part="scrim"]')).toBeNull();

      const docked = await create('<md-search layout="docked"></md-search>');
      expect(docked.root?.shadowRoot?.querySelector('[part="scrim"]')).toBeNull();
    });

    it('reflects the layout attribute', async () => {
      const page = await create('<md-search layout="docked"></md-search>');
      expect(page.root?.getAttribute('layout')).toBe('docked');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Full-width (opt-in edge-to-edge bar + drawer)
  // ─────────────────────────────────────────────────────────────────────

  describe('full-width', () => {
    it('does not apply the full-width class by default', async () => {
      const page = await create('<md-search layout="docked"></md-search>');
      expect(page.root).not.toHaveClass('md-search--full-width');
    });

    it('applies the full-width class when full-width is set', async () => {
      const page = await create('<md-search layout="docked" full-width></md-search>');
      expect(page.root).toHaveClass('md-search--full-width');
    });

    it('reflects the full-width attribute', async () => {
      const page = await create('<md-search layout="docked" full-width></md-search>');
      expect(page.root?.getAttribute('full-width')).not.toBeNull();
    });

    it('composes with the unified expansion model (no parallel mechanism)', async () => {
      // full-width simply zeroes both expand insets via the host class — the
      // bar still renders through the normal docked path (no extra wrappers).
      const page = await create('<md-search layout="docked" full-width></md-search>');
      expect(page.root).toHaveClass('md-search--docked');
      expect(page.root).toHaveClass('md-search--full-width');
      expect(page.root?.shadowRoot?.querySelector('.md-search__bar')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Open / close lifecycle
  // ─────────────────────────────────────────────────────────────────────

  describe('open / close', () => {
    it('starts closed', async () => {
      const page = await create('<md-search></md-search>');
      expect(page.rootInstance.open).toBe(false);
      expect(page.root).toHaveClass('md-search--closed');
    });

    it('opens via the show() method', async () => {
      const page = await create('<md-search></md-search>');
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(page.root).toHaveClass('md-search--open');
    });

    it('opens from the icon trigger on full-screen', async () => {
      const page = await createBare('<md-search layout="full-screen"></md-search>');
      const trigger = page.root?.shadowRoot?.querySelector(
        '[part="trigger-button"]',
      ) as HTMLElement;
      expect(trigger).toBeTruthy();
      trigger.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(page.root?.shadowRoot?.querySelector('[part="bar"]')).toBeTruthy();
    });

    it('hides the icon trigger and reveals bar + panel when full-screen open on load', async () => {
      const page = await createBare(
        `<md-search layout="full-screen" trigger="icon" open value="Eli">
           <md-list-item slot="results" headline="One"></md-list-item>
         </md-search>`,
      );
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-search--open');
      expect(
        page.root?.shadowRoot?.querySelector('[part="trigger-button"]'),
      ).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('[part="bar"]')).toBeTruthy();
      const panel = page.root?.shadowRoot?.querySelector(
        '.md-search__panel--full-screen',
      );
      expect(panel?.classList.contains('md-search__panel--open')).toBe(true);
    });

    it('reveals the full-screen panel surface on load before slotted results', async () => {
      const page = await createBare(
        '<md-search layout="full-screen" trigger="icon" open></md-search>',
      );
      await page.waitForChanges();
      const panel = page.root?.shadowRoot?.querySelector(
        '.md-search__panel--full-screen',
      );
      expect(panel?.classList.contains('md-search__panel--open')).toBe(true);
      expect(page.root).toHaveClass('md-search--panel-content');
    });

    it('opens from an external trigger resolved by trigger-for', async () => {
      const page = await createBare(
        `<button id="open-search">Search</button>
         <md-search layout="full-screen" trigger-for="#open-search"></md-search>`,
      );
      const btn = page.doc.querySelector('#open-search') as HTMLElement;
      expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
      expect(btn.getAttribute('aria-expanded')).toBe('false');

      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      expect(page.root?.shadowRoot?.querySelector('[part="bar"]')).toBeTruthy();
    });

    it('renders no built-in trigger while an external one is wired', async () => {
      const page = await createBare(
        `<button id="ext">Search</button>
         <md-search layout="docked" trigger-for="#ext"></md-search>`,
      );
      expect(page.root?.shadowRoot?.querySelector('[part="trigger"]')).toBeNull();
      // The resting bar stands down too — the external button is the only
      // affordance until the view opens.
      expect(page.root?.shadowRoot?.querySelector('[part="bar"]')).toBeNull();
    });

    it('closes from the external trigger when the view is already open', async () => {
      const page = await createBare(
        `<button id="ext">Search</button>
         <md-search layout="full-screen" trigger-for="#ext" open></md-search>`,
      );
      const btn = page.doc.querySelector('#ext') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('does not close on the external trigger mousedown (no close-then-reopen)', async () => {
      const page = await createBare(
        `<button id="ext">Search</button>
         <md-search layout="docked" trigger-for="#ext" open></md-search>`,
      );
      const btn = page.doc.querySelector('#ext') as HTMLElement;
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('wires an external trigger passed as an element', async () => {
      const page = await createBare('<md-search layout="full-screen"></md-search>');
      const btn = page.doc.createElement('button');
      page.body.appendChild(btn);
      (page.root as HTMLElement & { triggerElement?: HTMLElement }).triggerElement = btn;
      await page.waitForChanges();

      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('stops driving the external trigger once disconnected', async () => {
      const page = await createBare(
        `<button id="ext">Search</button>
         <md-search layout="full-screen" trigger-for="#ext"></md-search>`,
      );
      const btn = page.doc.querySelector('#ext') as HTMLElement;
      page.root?.remove();
      await page.waitForChanges();

      expect(btn.hasAttribute('aria-expanded')).toBe(false);
      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('ignores external-trigger clicks while disabled', async () => {
      const page = await createBare(
        `<button id="ext">Search</button>
         <md-search layout="full-screen" trigger-for="#ext" disabled></md-search>`,
      );
      const btn = page.doc.querySelector('#ext') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('exposes aria-label on the built-in icon trigger', async () => {
      const page = await create(
        '<md-search layout="full-screen" placeholder="Find items"></md-search>',
      );
      const trigger = page.root?.shadowRoot?.querySelector(
        '[part="trigger-button"]',
      ) as HTMLElement;
      expect(trigger?.getAttribute('aria-label')).toBe('Find items');
    });

    it('closes via the close() method', async () => {
      const page = await create('<md-search open></md-search>');
      await page.rootInstance.close();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('toggles via the toggle() method', async () => {
      const page = await create('<md-search></md-search>');
      await page.rootInstance.toggle();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      await page.rootInstance.toggle();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('does not re-run open side effects when open is set to the same value', async () => {
      const page = await create('<md-search open></md-search>');
      const openSpy = jest.fn();
      const closeSpy = jest.fn();
      page.root?.addEventListener('mdOpen', openSpy);
      page.root?.addEventListener('mdClose', closeSpy);
      page.rootInstance.open = true;
      await page.waitForChanges();
      expect(openSpy).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('emits mdOpen when opened', async () => {
      const page = await create('<md-search></md-search>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('emits mdClose when closed', async () => {
      const page = await create('<md-search open></md-search>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);
      await page.rootInstance.close();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Bar interactions
  // ─────────────────────────────────────────────────────────────────────

  describe('bar interactions', () => {
    it('opens when the bar is clicked', async () => {
      const page = await create('<md-search></md-search>');
      const bar = page.root?.shadowRoot?.querySelector('[part="bar"]') as HTMLElement;
      bar.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('does not open when the disabled bar is clicked', async () => {
      const page = await create('<md-search disabled></md-search>');
      const bar = page.root?.shadowRoot?.querySelector('[part="bar"]') as HTMLElement;
      bar.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('does not open when clicking inside the trailing cluster while closed', async () => {
      const page = await create('<md-search value="hi"></md-search>');
      const trailing = page.root?.shadowRoot?.querySelector(
        '[part="trailing"]',
      ) as HTMLElement;
      trailing.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('shows the close button when open in full-screen', async () => {
      const page = await create('<md-search open layout="full-screen"></md-search>');
      const closeBtn = page.root?.shadowRoot?.querySelector(
        '.md-search__leading--button button',
      );
      expect(closeBtn).toBeTruthy();
      expect(closeBtn?.getAttribute('aria-label')).toBe('Close search');
    });

    it('also flips the leading wrapper to the close-button modifier in docked when open', async () => {
      const page = await create('<md-search open layout="docked"></md-search>');
      const leading = page.root?.shadowRoot?.querySelector('.md-search__leading');
      expect(leading?.classList.contains('md-search__leading--button')).toBe(true);
      const btn = leading?.querySelector('button.md-search__leading-button');
      expect(btn).toBeTruthy();
      expect(btn?.getAttribute('aria-label')).toBe('Close search');
    });

    it('closes when the leading close button is clicked (full-screen)', async () => {
      const page = await create('<md-search open layout="full-screen"></md-search>');
      const closeBtn = page.root?.shadowRoot?.querySelector(
        '.md-search__leading--button button',
      ) as HTMLElement;
      closeBtn.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('closes when the leading close button is clicked (docked)', async () => {
      const page = await create('<md-search open layout="docked"></md-search>');
      const closeBtn = page.root?.shadowRoot?.querySelector(
        '.md-search__leading--button button',
      ) as HTMLElement;
      closeBtn.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Input behaviour
  // ─────────────────────────────────────────────────────────────────────

  describe('input behaviour', () => {
    it('reflects the value prop into the <input>', async () => {
      const page = await create('<md-search value="hello"></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('hello');
    });

    it('uses the placeholder prop on the <input>', async () => {
      const page = await create('<md-search placeholder="Find anything"></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('placeholder')).toBe('Find anything');
    });

    it('emits mdInput when the input changes', async () => {
      const page = await create('<md-search></md-search>');
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.value = 'kittens';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ value: 'kittens' });
      expect(page.rootInstance.value).toBe('kittens');
    });

    it('emits mdSubmit on Enter when open', async () => {
      const page = await create('<md-search open value="cats"></md-search>');
      const spy = jest.fn();
      page.root?.addEventListener('mdSubmit', spy);
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ value: 'cats' });
    });

    it('does NOT open when the input merely gains focus (Tab)', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
      expect(page.rootInstance.focused).toBe(true);
    });

    it('activates (opens) on Enter / Space while closed instead of submitting', async () => {
      const page = await create('<md-search></md-search>');
      const submitSpy = jest.fn();
      page.root?.addEventListener('mdSubmit', submitSpy);
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(submitSpy).not.toHaveBeenCalled();
    });

    it('opens on Space while closed', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('emits mdChange on blur when the value changed since focus', async () => {
      const page = await create('<md-search value="hello"></md-search>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.dispatchEvent(new FocusEvent('focus'));
      input.value = 'hello world';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      input.dispatchEvent(new FocusEvent('blur'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ value: 'hello world' });
    });

    it('does not emit mdChange on blur when the value is unchanged', async () => {
      const page = await create('<md-search value="same"></md-search>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.dispatchEvent(new FocusEvent('focus'));
      input.dispatchEvent(new FocusEvent('blur'));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('opens when the user starts typing', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.value = 'k';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Clear button
  // ─────────────────────────────────────────────────────────────────────

  describe('clear button', () => {
    it('does not render when the input is empty', async () => {
      const page = await create('<md-search></md-search>');
      const clear = page.root?.shadowRoot?.querySelector('[part="clear-button"]');
      expect(clear).toBeNull();
    });

    it('renders when the input has a value', async () => {
      const page = await create('<md-search value="hi"></md-search>');
      const clear = page.root?.shadowRoot?.querySelector('[part="clear-button"]');
      expect(clear).toBeTruthy();
    });

    it('does not render when show-clear-button="false"', async () => {
      const page = await create(
        '<md-search value="hi" show-clear-button="false"></md-search>',
      );
      const clear = page.root?.shadowRoot?.querySelector('[part="clear-button"]');
      expect(clear).toBeNull();
    });

    it('clears the value and emits mdClear when clicked', async () => {
      const page = await create('<md-search value="hi"></md-search>');
      const inputSpy = jest.fn();
      const clearSpy = jest.fn();
      page.root?.addEventListener('mdInput', inputSpy);
      page.root?.addEventListener('mdClear', clearSpy);

      const clear = page.root?.shadowRoot?.querySelector(
        '[part="clear-button"]',
      ) as HTMLElement;
      clear.click();
      await page.waitForChanges();

      expect(page.rootInstance.value).toBe('');
      expect(inputSpy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { value: '' } }),
      );
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Icon click events
  // ─────────────────────────────────────────────────────────────────────

  describe('icon click events', () => {
    describe('mdLeadingIconClick', () => {
      it('emits (with open state) when the leading back button is clicked while open', async () => {
        const page = await create('<md-search open></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdLeadingIconClick', spy);

        const leading = page.root?.shadowRoot?.querySelector(
          '[part="leading"]',
        ) as HTMLElement;
        leading.click();
        await page.waitForChanges();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].detail).toEqual({ value: '', open: true });
        // The default back button still dismisses the panel (additive event).
        expect(page.rootInstance.open).toBe(false);
      });

      it('does not emit when closed (resting search glyph is not a click target)', async () => {
        const page = await create('<md-search></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdLeadingIconClick', spy);

        const leading = page.root?.shadowRoot?.querySelector(
          '[part="leading"]',
        ) as HTMLElement;
        leading.click();
        await page.waitForChanges();

        expect(spy).not.toHaveBeenCalled();
      });

      it('does not emit when disabled', async () => {
        const page = await create('<md-search open disabled></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdLeadingIconClick', spy);

        const leading = page.root?.shadowRoot?.querySelector(
          '[part="leading"]',
        ) as HTMLElement;
        leading.click();
        await page.waitForChanges();

        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('mdTrailingIconClick', () => {
      it('emits (with open state) when a slotted trailing affordance is clicked', async () => {
        const page = await create(
          `<md-search open><button slot="trailing" class="fav">★</button></md-search>`,
        );
        const slotted = page.root?.querySelector('[slot="trailing"]') as HTMLElement;
        const instance = page.rootInstance as unknown as {
          hasSlottedTrailing: boolean;
          trailingSlotEl: { assignedElements: () => Element[] };
          handleTrailingClick: (e: unknown) => void;
        };
        instance.hasSlottedTrailing = true;
        instance.trailingSlotEl = { assignedElements: () => [slotted] };
        await page.waitForChanges();

        const spy = jest.fn();
        page.root?.addEventListener('mdTrailingIconClick', spy);
        instance.handleTrailingClick({
          composedPath: () => [slotted],
          target: slotted,
          stopPropagation: () => {},
        });
        await page.waitForChanges();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].detail).toEqual({ value: '', open: true });
      });

      it('does not emit for the built-in clear / voice buttons', async () => {
        const page = await create('<md-search value="hi"></md-search>');
        const instance = page.rootInstance as unknown as {
          hasSlottedTrailing: boolean;
          handleTrailingClick: (e: unknown) => void;
        };
        instance.hasSlottedTrailing = true;
        const clearLike = {
          classList: { contains: (c: string) => c === 'md-search__clear' },
        };
        const spy = jest.fn();
        page.root?.addEventListener('mdTrailingIconClick', spy);
        instance.handleTrailingClick({
          composedPath: () => [clearLike],
          target: clearLike,
        });
        await page.waitForChanges();

        expect(spy).not.toHaveBeenCalled();
      });

      it('does not emit when no slotted trailing content is present', async () => {
        const page = await create('<md-search></md-search>');
        const instance = page.rootInstance as unknown as {
          handleTrailingClick: (e: unknown) => void;
        };
        const el = page.doc.createElement('span');
        const spy = jest.fn();
        page.root?.addEventListener('mdTrailingIconClick', spy);
        instance.handleTrailingClick({ composedPath: () => [el], target: el });
        await page.waitForChanges();

        expect(spy).not.toHaveBeenCalled();
      });

      it('does not emit when disabled', async () => {
        const page = await create('<md-search disabled></md-search>');
        const slotted = page.doc.createElement('button');
        const instance = page.rootInstance as unknown as {
          hasSlottedTrailing: boolean;
          trailingSlotEl: { assignedElements: () => Element[] };
          handleTrailingClick: (e: unknown) => void;
        };
        instance.hasSlottedTrailing = true;
        instance.trailingSlotEl = { assignedElements: () => [slotted] };
        const spy = jest.fn();
        page.root?.addEventListener('mdTrailingIconClick', spy);
        instance.handleTrailingClick({
          composedPath: () => [slotted],
          target: slotted,
        });
        await page.waitForChanges();

        expect(spy).not.toHaveBeenCalled();
      });

      it('emits using the event target when composedPath is unavailable', async () => {
        const page = await create(
          `<md-search open><button slot="trailing" class="fav">★</button></md-search>`,
        );
        const slotted = page.root?.querySelector('[slot="trailing"]') as HTMLElement;
        const instance = page.rootInstance as unknown as {
          trailingSlotEl: { assignedElements: () => Element[] };
          handleTrailingClick: (e: unknown) => void;
        };
        instance.trailingSlotEl = { assignedElements: () => [slotted] };
        const spy = jest.fn();
        page.root?.addEventListener('mdTrailingIconClick', spy);
        instance.handleTrailingClick({
          composedPath: undefined,
          target: slotted,
          stopPropagation: () => {},
        });
        await page.waitForChanges();
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Slots
  // ─────────────────────────────────────────────────────────────────────

  describe('slots', () => {
    it('renders three named slots: leading, trailing, results', async () => {
      const page = await create('<md-search></md-search>');
      const slots = page.root?.shadowRoot?.querySelectorAll('slot');
      const names = Array.from(slots ?? []).map((s) => s.getAttribute('name'));
      expect(names).toEqual(expect.arrayContaining(['leading', 'trailing', 'results']));
    });

    it('renders consumer-supplied trailing content', async () => {
      const page = await create(
        `<md-search><md-icon-button slot="trailing" icon="mic"></md-icon-button></md-search>`,
      );
      const trailing = page.root?.querySelector('[slot="trailing"]');
      expect(trailing).toBeTruthy();
    });

    it('renders consumer-supplied results content', async () => {
      const page = await create(
        `<md-search><div slot="results">No results</div></md-search>`,
      );
      const results = page.root?.querySelector('[slot="results"]');
      expect(results?.textContent).toBe('No results');
    });

    it('updates has-slotted-leading when the leading slot fires slotchange', async () => {
      const page = await create('<md-search></md-search>');
      const leading = page.doc.createElement('button');
      leading.setAttribute('slot', 'leading');
      page.root?.appendChild(leading);
      await dispatchSlotChange(page, 'leading', [leading]);
      expect(page.root).toHaveClass('md-search--has-slotted-leading');
    });

    it('updates has-slotted-trailing when the trailing slot fires slotchange', async () => {
      const page = await create('<md-search></md-search>');
      const trailing = page.doc.createElement('button');
      trailing.setAttribute('slot', 'trailing');
      page.root?.appendChild(trailing);
      await dispatchSlotChange(page, 'trailing', [trailing]);
      expect(page.root).toHaveClass('md-search--has-slotted-trailing');
    });

    it('recomputes the results announcement when the results slot changes', async () => {
      const page = await create('<md-search open value="cats"></md-search>');
      await dispatchSlotChange(page, 'results', []);
      const status = page.root?.shadowRoot?.querySelector('[part="status"]');
      const empty = page.root?.shadowRoot?.querySelector('[part="empty"]');
      expect(status?.textContent).toBe('');
      expect(empty?.textContent).toBe('No results available');

      const row = page.doc.createElement('li');
      row.setAttribute('slot', 'results');
      page.root?.appendChild(row);
      await dispatchSlotChange(page, 'results', [row]);
      expect(status?.textContent).toBe('1 results available');
      expect(page.root?.shadowRoot?.querySelector('[part="empty"]')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Ripple extend + ResizeObserver
  // ─────────────────────────────────────────────────────────────────────

  describe('ripple extend', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    function measureRipple(page: Awaited<ReturnType<typeof create>>) {
      (page.rootInstance as unknown as { measureRippleExtend: () => void }).measureRippleExtend();
    }

    it('sets ripple extend from the inset probe on docked layout', async () => {
      const page = await create('<md-search layout="docked"></md-search>');
      const probe = page.root?.shadowRoot?.querySelector(
        '.md-search__inset-probe',
      ) as HTMLElement;
      jest.spyOn(probe, 'getBoundingClientRect').mockReturnValue({ width: 24 } as DOMRect);
      measureRipple(page);
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple') as HTMLElement;
      expect(ripple.style.getPropertyValue('--md-ripple-extend-inline')).toBe('24px');
    });

    it('clears ripple extend when the probe width is zero', async () => {
      const page = await create('<md-search layout="docked"></md-search>');
      const probe = page.root?.shadowRoot?.querySelector(
        '.md-search__inset-probe',
      ) as HTMLElement;
      jest.spyOn(probe, 'getBoundingClientRect').mockReturnValue({ width: 0 } as DOMRect);
      measureRipple(page);
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple') as HTMLElement;
      expect(ripple.style.getPropertyValue('--md-ripple-extend-inline')).toBe('');
    });

    it('inflates ripple extend for a resting full-screen bar', async () => {
      const page = await create(
        '<md-search layout="full-screen" trigger="bar"></md-search>',
      );
      const bar = page.root?.shadowRoot?.querySelector('.md-search__bar') as HTMLElement;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
      jest.spyOn(bar, 'getBoundingClientRect').mockReturnValue({ width: 720 } as DOMRect);
      measureRipple(page);
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple') as HTMLElement;
      expect(ripple.style.getPropertyValue('--md-ripple-extend-inline')).toBe('280px');
    });

    it('uses the inset probe when full-screen bar growth delta is negligible', async () => {
      const page = await create(
        '<md-search layout="full-screen" trigger="bar"></md-search>',
      );
      const bar = page.root?.shadowRoot?.querySelector('.md-search__bar') as HTMLElement;
      const probe = page.root?.shadowRoot?.querySelector(
        '.md-search__inset-probe',
      ) as HTMLElement;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
      jest.spyOn(bar, 'getBoundingClientRect').mockReturnValue({ width: 799 } as DOMRect);
      jest.spyOn(probe, 'getBoundingClientRect').mockReturnValue({ width: 32 } as DOMRect);
      measureRipple(page);
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple') as HTMLElement;
      expect(ripple.style.getPropertyValue('--md-ripple-extend-inline')).toBe('32px');
    });

    it('clears ripple extend when the inset probe width is non-finite', async () => {
      const page = await create('<md-search layout="docked"></md-search>');
      const probe = page.root?.shadowRoot?.querySelector(
        '.md-search__inset-probe',
      ) as HTMLElement;
      jest.spyOn(probe, 'getBoundingClientRect').mockReturnValue({ width: NaN } as DOMRect);
      measureRipple(page);
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple') as HTMLElement;
      expect(ripple.style.getPropertyValue('--md-ripple-extend-inline')).toBe('');
    });

    it('re-measures ripple on host resize while the bar is resting', async () => {
      const ro = installResizeObserverMock();
      try {
        const page = await create('<md-search layout="docked"></md-search>');
        const probe = page.root?.shadowRoot?.querySelector(
          '.md-search__inset-probe',
        ) as HTMLElement;
        jest.spyOn(probe, 'getBoundingClientRect').mockReturnValue({ width: 16 } as DOMRect);
        ro.fire();
        const ripple = page.root?.shadowRoot?.querySelector('md-ripple') as HTMLElement;
        expect(ripple.style.getPropertyValue('--md-ripple-extend-inline')).toBe('16px');
      } finally {
        ro.restore();
      }
    });

    it('skips ripple re-measure while the bar is expanded', async () => {
      const ro = installResizeObserverMock();
      try {
        const page = await create('<md-search open layout="docked"></md-search>');
        const probe = page.root?.shadowRoot?.querySelector(
          '.md-search__inset-probe',
        ) as HTMLElement;
        const ripple = page.root?.shadowRoot?.querySelector('md-ripple') as HTMLElement;
        ripple.style.setProperty('--md-ripple-extend-inline', '99px');
        jest.spyOn(probe, 'getBoundingClientRect').mockReturnValue({ width: 8 } as DOMRect);
        ro.fire();
        expect(ripple.style.getPropertyValue('--md-ripple-extend-inline')).toBe('99px');
      } finally {
        ro.restore();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Full-screen open / close lifecycle
  // ─────────────────────────────────────────────────────────────────────

  describe('full-screen lifecycle', () => {
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-inline-end');
    });

    it('does not reveal docked panel chrome until there is content', async () => {
      const page = await create('<md-search layout="docked"></md-search>');
      await page.rootInstance.show();
      await page.waitForChanges();
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.classList.contains('md-search__panel--open')).toBe(false);
      expect(page.root).not.toHaveClass('md-search--panel-content');
    });

    it('reveals docked panel chrome when open with results', async () => {
      const page = await create(
        `<md-search layout="docked" open>
           <md-list-item slot="results">One</md-list-item>
         </md-search>`,
      );
      await page.waitForChanges();
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.classList.contains('md-search__panel--open')).toBe(true);
      expect(page.root).toHaveClass('md-search--panel-content');
    });

    it('defers full-screen panelVisible until after layout paint', async () => {
      const page = await create('<md-search layout="full-screen"></md-search>');
      await page.rootInstance.show();
      await page.waitForChanges();

      const instance = page.rootInstance as unknown as { panelVisible: boolean };
      expect(instance.panelVisible).toBe(false);

      await flushRaf();
      await flushRaf();
      await page.waitForChanges();
      expect(instance.panelVisible).toBe(true);
    });

    it('skips full-screen panel reveal when closed before the reveal animation frame', async () => {
      const page = await create('<md-search layout="full-screen"></md-search>');
      const rafCbs: FrameRequestCallback[] = [];
      const spy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCbs.push(cb);
        return rafCbs.length;
      });

      await page.rootInstance.show();
      await page.waitForChanges();
      page.rootInstance.open = false;
      for (const cb of rafCbs) cb(0);

      expect(
        (page.rootInstance as unknown as { panelVisible: boolean }).panelVisible,
      ).toBe(false);
      spy.mockRestore();
    });

    it('reveals full-screen panel synchronously when requestAnimationFrame is unavailable in componentDidRender', async () => {
      const page = await create('<md-search layout="full-screen"></md-search>');
      const instance = page.rootInstance as unknown as {
        pendingFullScreenReveal: boolean;
        open: boolean;
        panelVisible: boolean;
        componentDidRender: () => void;
      };
      instance.open = true;
      instance.pendingFullScreenReveal = true;

      const raf = global.requestAnimationFrame;
      const caf = global.cancelAnimationFrame;
       
      delete (global as any).requestAnimationFrame;
       
      delete (global as any).cancelAnimationFrame;
      try {
        instance.componentDidRender();
        expect(instance.panelVisible).toBe(true);
      } finally {
        global.requestAnimationFrame = raf;
        global.cancelAnimationFrame = caf;
      }
    });

    it('compensates for scrollbar width when opening full-screen', async () => {
      const page = await create('<md-search layout="full-screen"></md-search>');
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        value: 1008,
      });

      await page.rootInstance.show();
      await page.waitForChanges();

      expect(document.body.style.paddingInlineEnd).toBe('16px');
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('skips scrollbar padding compensation when no scrollbar is present', async () => {
      const page = await create('<md-search layout="full-screen"></md-search>');
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        value: 1024,
      });

      await page.rootInstance.show();
      await page.waitForChanges();

      expect(document.body.style.paddingInlineEnd).toBe('');
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('collapses the bar and clears scroll lock after the close fade', async () => {
      const page = await create('<md-search open layout="full-screen"></md-search>');
      document.body.style.paddingInlineEnd = '16px';
      document.body.style.overflow = 'hidden';
      jest.useFakeTimers();
      try {
        page.rootInstance.open = false;
        jest.advanceTimersByTime(300);
        const instance = page.rootInstance as unknown as { barExpanded: boolean };
        expect(instance.barExpanded).toBe(false);
        expect(document.body.style.paddingInlineEnd).toBe('');
        expect(document.body.style.overflow).toBe('');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Accessibility
  // ─────────────────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('uses role="dialog" on the panel', async () => {
      const page = await create('<md-search></md-search>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('role')).toBe('dialog');
    });

    it('sets aria-modal="true" on the panel when full-screen is open', async () => {
      const fsOpen = await createBare('<md-search open layout="full-screen"></md-search>');
      expect(
        fsOpen.root?.shadowRoot
          ?.querySelector('[part="panel"]')
          ?.getAttribute('aria-modal'),
      ).toBe('true');

      const fsWithResults = await createBare(
        `<md-search open layout="full-screen" value="cats">
           <md-list-item slot="results">One</md-list-item>
         </md-search>`,
      );
      expect(
        fsWithResults.root?.shadowRoot
          ?.querySelector('[part="panel"]')
          ?.getAttribute('aria-modal'),
      ).toBe('true');

      const docked = await create('<md-search open layout="docked" value="cats"></md-search>');
      expect(
        docked.root?.shadowRoot
          ?.querySelector('[part="panel"]')
          ?.getAttribute('aria-modal'),
      ).toBe('false');
    });

    it('exposes aria-expanded on the input', async () => {
      const closed = await create('<md-search></md-search>');
      const closedInput = closed.root?.shadowRoot?.querySelector('input');
      expect(closedInput?.getAttribute('aria-expanded')).toBe('false');

      const open = await create('<md-search open></md-search>');
      const openInput = open.root?.shadowRoot?.querySelector('input');
      expect(openInput?.getAttribute('aria-expanded')).toBe('true');
    });

    it('uses the inputAriaLabel prop as the input aria-label', async () => {
      const page = await create('<md-search input-aria-label="Find a contact"></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.getAttribute('aria-label')).toBe('Find a contact');
    });

    it('falls back to the placeholder (hinted text) as the accessible label', async () => {
      const page = await create('<md-search placeholder="Search messages"></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.getAttribute('aria-label')).toBe('Search messages');
    });

    it('labels the panel for screen readers', async () => {
      const page = await create('<md-search input-aria-label="Find people"></md-search>');
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('aria-label')).toBe('Find people');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Autosuggest live region
  // ─────────────────────────────────────────────────────────────────────

  describe('autosuggest announcements', () => {
    it('renders a polite live region', async () => {
      const page = await create('<md-search></md-search>');
      const status = page.root?.shadowRoot?.querySelector('[part="status"]');
      expect(status).toBeTruthy();
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.getAttribute('aria-live')).toBe('polite');
    });

    it('announces the result count when open', async () => {
      const page = await create(
        `<md-search open>
           <md-list slot="results">
             <md-list-item>One</md-list-item>
             <md-list-item>Two</md-list-item>
             <md-list-item>Three</md-list-item>
           </md-list>
         </md-search>`,
      );
      await page.waitForChanges();
      const status = page.root?.shadowRoot?.querySelector('[part="status"]');
      expect(status?.textContent).toBe('3 results available');
    });

    it('supports a custom results-label template', async () => {
      const page = await create(
        `<md-search open results-label="{count} matches">
           <ul slot="results"><li>a</li><li>b</li></ul>
         </md-search>`,
      );
      await page.waitForChanges();
      const status = page.root?.shadowRoot?.querySelector('[part="status"]');
      expect(status?.textContent).toBe('2 matches');
    });

    it('stays silent when closed', async () => {
      const page = await create(
        `<md-search>
           <md-list slot="results"><md-list-item>One</md-list-item></md-list>
         </md-search>`,
      );
      await page.waitForChanges();
      const status = page.root?.shadowRoot?.querySelector('[part="status"]');
      expect(status?.textContent).toBe('');
    });

    it('stays silent when announce-results="false" even while open', async () => {
      const page = await create(
        `<md-search open announce-results="false" value="cats">
           <md-list slot="results"><md-list-item>One</md-list-item></md-list>
         </md-search>`,
      );
      await page.waitForChanges();
      const status = page.root?.shadowRoot?.querySelector('[part="status"]');
      expect(status?.textContent).toBe('');
    });

    it('uses a custom no-results-label when open with a query and empty list', async () => {
      const page = await create(
        '<md-search open value="zzz" no-results-label="Nothing matched"></md-search>',
      );
      await page.waitForChanges();
      const empty = page.root?.shadowRoot?.querySelector('[part="empty"]');
      const status = page.root?.shadowRoot?.querySelector('[part="status"]');
      expect(empty?.textContent).toBe('Nothing matched');
      expect(status?.textContent).toBe('');
    });

    it('announces no results when open with a query and empty list', async () => {
      const page = await create(
        '<md-search open value="zzz"></md-search>',
      );
      await page.waitForChanges();
      const empty = page.root?.shadowRoot?.querySelector('[part="empty"]');
      const status = page.root?.shadowRoot?.querySelector('[part="status"]');
      expect(empty?.textContent).toBe('No results available');
      expect(status?.textContent).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Empty state (visible no-results message)
  // ─────────────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows the default message when open with a query and no results', async () => {
      const page = await create('<md-search open value="cats"></md-search>');
      await page.waitForChanges();
      const empty = page.root?.shadowRoot?.querySelector('[part="empty"]');
      expect(empty).toBeTruthy();
      expect(empty?.textContent).toBe('No results available');
      expect(empty?.getAttribute('role')).toBe('status');
    });

    it('shows a custom no-results-label in the visible empty state', async () => {
      const page = await create(
        '<md-search open value="q" no-results-label="Nothing matched"></md-search>',
      );
      await page.waitForChanges();
      expect(
        page.root?.shadowRoot?.querySelector('[part="empty"]')?.textContent,
      ).toBe('Nothing matched');
    });

    it('hides the empty state when results are present', async () => {
      const page = await create(
        `<md-search open value="cats">
           <md-list-item slot="results">One</md-list-item>
         </md-search>`,
      );
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="empty"]')).toBeNull();
    });

    it('hides the empty state when the panel is closed', async () => {
      const page = await create('<md-search value="cats"></md-search>');
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="empty"]')).toBeNull();
    });

    it('hides the empty state while loading', async () => {
      const page = await create(
        '<md-search open value="cats" loading></md-search>',
      );
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="empty"]')).toBeNull();
    });

    it('hides the empty state when open with no query yet', async () => {
      const page = await create('<md-search open></md-search>');
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="empty"]')).toBeNull();
    });

    it('keeps the docked panel closed when open with no query and no results', async () => {
      const page = await create('<md-search layout="docked" open></md-search>');
      await page.waitForChanges();
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.classList.contains('md-search__panel--open')).toBe(false);
      expect(page.root).not.toHaveClass('md-search--panel-content');
    });

    it('opens the docked panel chrome for the visible empty state', async () => {
      const page = await create('<md-search layout="docked" open value="cats"></md-search>');
      await page.waitForChanges();
      const panel = page.root?.shadowRoot?.querySelector('[part="panel"]');
      expect(panel?.classList.contains('md-search__panel--open')).toBe(true);
      expect(page.root).toHaveClass('md-search--panel-content');
    });

    it('does not duplicate no-results copy in the hidden live region', async () => {
      const page = await create('<md-search open value="cats"></md-search>');
      await page.waitForChanges();
      expect(
        page.root?.shadowRoot?.querySelector('[part="status"]')?.textContent,
      ).toBe('');
      expect(
        page.root?.shadowRoot?.querySelector('[part="empty"]')?.textContent,
      ).toBe('No results available');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Initial focus
  // ─────────────────────────────────────────────────────────────────────

  describe('initial focus', () => {
    it('defaults initialFocus to "auto"', async () => {
      const page = await create('<md-search></md-search>');
      expect(page.rootInstance.initialFocus).toBe('auto');
    });

    it('reflects the initial-focus attribute', async () => {
      const page = await create('<md-search initial-focus="leading"></md-search>');
      expect(page.rootInstance.initialFocus).toBe('leading');
    });

    it('keeps an interactive slotted leading icon first in tab order', async () => {
      const page = await create(
        `<md-search>
           <md-icon-button slot="leading" icon="menu" aria-label="Menu"></md-icon-button>
         </md-search>`,
      );
      await page.waitForChanges();
      const slottedLeading = page.root?.querySelector('[slot="leading"]');
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(slottedLeading).toBeTruthy();
      expect(input?.getAttribute('role')).toBe('combobox');
    });

    it('built-in leading button is not in tab order while closed', async () => {
      const page = await create('<md-search></md-search>');
      const btn = page.root?.shadowRoot?.querySelector('.md-search__leading-button');
      expect(btn?.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // RTL
  // ─────────────────────────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders inside a dir="rtl" parent', async () => {
      const page = await newSpecPage({
        components: [MdSearch],
        html: '<div dir="rtl"><md-search></md-search></div>',
      });
      expect(page.root).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Disabled
  // ─────────────────────────────────────────────────────────────────────

  describe('disabled', () => {
    it('reflects the disabled attribute', async () => {
      const page = await create('<md-search disabled></md-search>');
      expect(page.root?.hasAttribute('disabled')).toBe(true);
      expect(page.root).toHaveClass('md-search--disabled');
    });

    it('does not render an md-ripple when disabled', async () => {
      const page = await create('<md-search disabled></md-search>');
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
      expect(ripple).toBeNull();
    });

    it('disables the underlying <input>', async () => {
      const page = await create('<md-search disabled></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────────

  describe('public methods', () => {
    it('focusInput() focuses the underlying input', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      const focusSpy = jest.spyOn(input, 'focus');
      await page.rootInstance.focusInput();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Outside click dismiss
  // ─────────────────────────────────────────────────────────────────────

  describe('outside click dismiss', () => {
    it('closes when clicking outside the host (default)', async () => {
      const page = await create('<md-search open></md-search>');
      const outside = page.doc.createElement('div');
      page.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('does not close on outside click when dismiss-on-outside-click="false"', async () => {
      const page = await create(
        '<md-search open dismiss-on-outside-click="false"></md-search>',
      );
      const outside = page.doc.createElement('div');
      page.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('ignores outside clicks on the host itself', async () => {
      const page = await create('<md-search open></md-search>');
      page.root?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('ignores outside clicks when composedPath includes the host', async () => {
      const page = await create('<md-search open></md-search>');
      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'composedPath', {
        value: () => [page.root],
      });
      document.dispatchEvent(event);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('ignores outside clicks on slotted light-DOM descendants', async () => {
      const page = await create(
        `<md-search open>
           <button slot="trailing" id="trail">Filter</button>
         </md-search>`,
      );
      const trail = page.root?.querySelector('#trail') as HTMLElement;
      trail.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('ignores outside clicks with a null event target', async () => {
      const page = await create('<md-search open></md-search>');
      await page.waitForChanges();
      const handler = (page.rootInstance as unknown as {
        outsideClickHandler?: (e: MouseEvent) => void;
      }).outsideClickHandler;
      handler?.({ target: null, composedPath: undefined } as unknown as MouseEvent);
      expect(page.rootInstance.open).toBe(true);
    });

    it('closes on outside clicks when composedPath is unavailable', async () => {
      const page = await create('<md-search open></md-search>');
      await page.waitForChanges();
      const outside = page.doc.createElement('div');
      const handler = (page.rootInstance as unknown as {
        outsideClickHandler?: (e: MouseEvent) => void;
      }).outsideClickHandler;
      handler?.({
        target: outside,
        composedPath: undefined,
      } as unknown as MouseEvent);
      expect(page.rootInstance.open).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Focus management on open / close
  // ─────────────────────────────────────────────────────────────────────

  describe('focus management', () => {
    afterEach(() => jest.useRealTimers());

    it('focuses the input by default when opened', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      const focusSpy = jest.spyOn(input, 'focus');
      await page.rootInstance.show();
      await page.waitForChanges();
      await flushRaf();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('focuses the input synchronously when requestAnimationFrame is unavailable on open', async () => {
      const raf = global.requestAnimationFrame;
      const caf = global.cancelAnimationFrame;
       
      delete (global as any).requestAnimationFrame;
       
      delete (global as any).cancelAnimationFrame;
      try {
        const page = await create('<md-search></md-search>');
        const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
        const focusSpy = jest.spyOn(input, 'focus');
        await page.rootInstance.show();
        await page.waitForChanges();
        expect(focusSpy).toHaveBeenCalled();
        focusSpy.mockRestore();
      } finally {
        global.requestAnimationFrame = raf;
        global.cancelAnimationFrame = caf;
      }
    });

    it('focuses the slotted leading control when initial-focus="leading"', async () => {
      const page = await create(
        `<md-search initial-focus="leading">
           <button slot="leading" id="menu">Menu</button>
         </md-search>`,
      );
      const menu = page.root?.querySelector('#menu') as HTMLButtonElement;
      const focusSpy = jest.spyOn(menu, 'focus');
      await page.rootInstance.show();
      await page.waitForChanges();
      await flushRaf();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('focuses an inner focusable within a slotted leading wrapper', async () => {
      const page = await create(
        `<md-search open initial-focus="leading">
           <span slot="leading"><button id="inner">Menu</button></span>
         </md-search>`,
      );
      const inner = page.root?.querySelector('#inner') as HTMLButtonElement;
      const focusSpy = jest.spyOn(inner, 'focus');
      await page.waitForChanges();
      await flushRaf();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('focuses the built-in leading button when initial-focus="leading" and open', async () => {
      const page = await create('<md-search open initial-focus="leading"></md-search>');
      const btn = page.root?.shadowRoot?.querySelector(
        '.md-search__leading-button',
      ) as HTMLButtonElement;
      const focusSpy = jest.spyOn(btn, 'focus');
      await page.waitForChanges();
      await flushRaf();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('does not treat the built-in leading button as a focus target while closed', async () => {
      const page = await create('<md-search initial-focus="leading"></md-search>');
      const btn = page.root?.shadowRoot?.querySelector('.md-search__leading-button');
      expect(btn?.getAttribute('tabindex')).toBe('-1');
      const instance = page.rootInstance as unknown as {
        leadingFocusTarget: () => HTMLElement | undefined;
      };
      expect(instance.leadingFocusTarget()).toBeUndefined();
    });

    it('returns a slotted leading button directly as the focus target', async () => {
      const page = await create(
        `<md-search open initial-focus="leading">
           <button slot="leading" id="menu">Menu</button>
         </md-search>`,
      );
      const instance = page.rootInstance as unknown as {
        leadingFocusTarget: () => HTMLElement | undefined;
      };
      expect(instance.leadingFocusTarget()?.id).toBe('menu');
    });

    it('focuses an inner button inside a slotted leading wrapper with tabindex="-1"', async () => {
      const page = await create(
        `<md-search open initial-focus="leading">
           <span slot="leading" tabindex="-1"><button id="inner">Menu</button></span>
         </md-search>`,
      );
      const inner = page.root?.querySelector('#inner') as HTMLButtonElement;
      const focusSpy = jest.spyOn(inner, 'focus');
      await page.waitForChanges();
      await flushRaf();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('falls back to a non-interactive slotted leading wrapper', async () => {
      const page = await create(
        `<md-search open initial-focus="leading">
           <span slot="leading" id="wrap">Menu</span>
         </md-search>`,
      );
      const wrap = page.root?.querySelector('#wrap') as HTMLElement;
      const focusSpy = jest.spyOn(wrap, 'focus');
      await page.waitForChanges();
      await flushRaf();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('restores focus to the previously focused element after close', async () => {
      const page = await create('<md-search open></md-search>');
      const trigger = page.doc.createElement('button');
      const restoreSpy = jest.spyOn(trigger, 'focus');

      const instance = page.rootInstance as unknown as {
        previousFocus: HTMLElement | null;
        finishCloseSideEffects: () => void;
      };
      instance.previousFocus = trigger;
      instance.finishCloseSideEffects();

      expect(restoreSpy).toHaveBeenCalled();
      expect(instance.previousFocus).toBeNull();
      restoreSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Keyboard modality / focus ring
  // ─────────────────────────────────────────────────────────────────────

  describe('keyboard focus ring', () => {
    it('shows the focus ring class after keyboard focus', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      const bar = page.root?.shadowRoot?.querySelector('.md-search__bar');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      input.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();

      expect(bar?.classList.contains('md-search__bar--focus-ring')).toBe(true);
    });

    it('hides the focus ring after pointer interaction', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      const bar = page.root?.shadowRoot?.querySelector('.md-search__bar');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      input.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(bar?.classList.contains('md-search__bar--focus-ring')).toBe(true);

      document.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true }),
      );
      (page.rootInstance as unknown as { trackPointerModality: () => void }).trackPointerModality();
      input.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(bar?.classList.contains('md-search__bar--focus-ring')).toBe(false);
    });

    it('clears the focus ring on blur', async () => {
      const page = await create('<md-search></md-search>');
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      const bar = page.root?.shadowRoot?.querySelector('.md-search__bar');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      input.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      input.dispatchEvent(new FocusEvent('blur'));
      await page.waitForChanges();

      expect(bar?.classList.contains('md-search__bar--focus-ring')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Keyboard (Escape)
  // ─────────────────────────────────────────────────────────────────────

  describe('keyboard', () => {
    afterEach(() => {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => document.body,
      });
    });

    it('closes on Escape when escape-closes is true (default)', async () => {
      const page = await create('<md-search open></md-search>');
      const evt = new KeyboardEvent('keydown', { key: 'Escape' });
      page.win.dispatchEvent(evt);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('does not close on Escape when escape-closes="false"', async () => {
      const page = await create('<md-search open escape-closes="false"></md-search>');
      const evt = new KeyboardEvent('keydown', { key: 'Escape' });
      page.win.dispatchEvent(evt);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('ArrowDown moves into the first result item (roving tabindex)', async () => {
      const page = await create(
        `<md-search open>
           <md-list slot="results">
             <md-list-item id="r1">One</md-list-item>
             <md-list-item id="r2">Two</md-list-item>
           </md-list>
         </md-search>`,
      );
      await page.waitForChanges();
      const first = page.root?.querySelector('#r1');
      expect(first?.getAttribute('tabindex')).toBeNull();
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await page.waitForChanges();
      // The first row is made programmatically focusable so focus can land on it.
      expect(first?.getAttribute('tabindex')).toBe('-1');
    });

    it('ArrowDown from the first item moves focus to the second item', async () => {
      const page = await create(
        `<md-search open>
           <ul slot="results">
             <li id="r1">One</li>
             <li id="r2">Two</li>
           </ul>
         </md-search>`,
      );
      await page.waitForChanges();
      const first = page.root?.querySelector('#r1') as HTMLElement;
      const second = page.root?.querySelector('#r2') as HTMLElement;
      first.setAttribute('tabindex', '-1');

      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => first,
      });
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await page.waitForChanges();
      expect(second.getAttribute('tabindex')).toBe('-1');
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => document.body,
      });
    });

    /**
     * md-search steps focus; it does NOT own `tabbable`. That belongs to
     * md-list's roving tabindex, which only rotates on real focus events —
     * mock-doc's `.focus()` dispatches none, and md-list marks the first row
     * tabbable at init, so asserting on `tabbable` here passed for the wrong
     * reason and then failed the moment focus was supposed to move. Assert the
     * focus calls md-search itself makes.
     */
    const spyFocus = (el: HTMLElement) => {
      if (typeof el.focus !== 'function') {
        (el as { focus?: () => void }).focus = () => undefined;
      }
      return jest.spyOn(el, 'focus');
    };

    const setActiveElement = (el: HTMLElement | null) =>
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => el,
      });

    const arrow = (page: SpecPage, key: 'ArrowDown' | 'ArrowUp') =>
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    it('ArrowDown steps through each md-list-item without skipping (3 items)', async () => {
      const page = await createWithListResults(
        `<md-search open>
           <md-list slot="results">
             <md-list-item id="r1" type="button" headline="One"></md-list-item>
             <md-list-item id="r2" type="button" headline="Two"></md-list-item>
             <md-list-item id="r3" type="button" headline="Three"></md-list-item>
           </md-list>
         </md-search>`,
      );
      await page.waitForChanges();

      const r1 = page.root?.querySelector('#r1') as HTMLElement;
      const r2 = page.root?.querySelector('#r2') as HTMLElement;
      const r3 = page.root?.querySelector('#r3') as HTMLElement;
      const [f1, f2, f3] = [r1, r2, r3].map(spyFocus);

      // From the input: land on the first row.
      arrow(page, 'ArrowDown');
      await page.waitForChanges();
      expect(f1).toHaveBeenCalled();
      // Made programmatically focusable so focus can land on it.
      expect(r1.getAttribute('tabindex')).toBe('-1');

      setActiveElement(r1);
      arrow(page, 'ArrowDown');
      await page.waitForChanges();
      expect(f2).toHaveBeenCalled();
      expect(f3).not.toHaveBeenCalled(); // stepped one row, did not skip

      setActiveElement(r2);
      arrow(page, 'ArrowDown');
      await page.waitForChanges();
      expect(f3).toHaveBeenCalled();

      [f1, f2, f3].forEach((s) => s.mockRestore());
      setActiveElement(document.body);
    });

    it('ArrowUp steps back through each md-list-item to the input (3 items)', async () => {
      const page = await createWithListResults(
        `<md-search open value="cats">
           <md-list slot="results">
             <md-list-item id="r1" type="button" headline="One"></md-list-item>
             <md-list-item id="r2" type="button" headline="Two"></md-list-item>
             <md-list-item id="r3" type="button" headline="Three"></md-list-item>
           </md-list>
         </md-search>`,
      );
      await page.waitForChanges();

      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      const r1 = page.root?.querySelector('#r1') as HTMLElement;
      const r2 = page.root?.querySelector('#r2') as HTMLElement;
      const r3 = page.root?.querySelector('#r3') as HTMLElement;
      const [f1, f2, f3] = [r1, r2, r3].map(spyFocus);
      const inputSpy = jest.spyOn(input, 'focus');

      // Start on the last row.
      setActiveElement(r3);
      arrow(page, 'ArrowUp');
      await page.waitForChanges();
      expect(f2).toHaveBeenCalled();
      expect(f1).not.toHaveBeenCalled(); // stepped one row, did not jump

      setActiveElement(r2);
      arrow(page, 'ArrowUp');
      await page.waitForChanges();
      expect(f1).toHaveBeenCalled();

      // Stepping up past the first row returns to the input.
      setActiveElement(r1);
      arrow(page, 'ArrowUp');
      await page.waitForChanges();
      expect(inputSpy).toHaveBeenCalled();

      [f1, f2, f3, inputSpy].forEach((s) => s.mockRestore());
      setActiveElement(document.body);
    });

    it('ArrowUp from the first result returns focus to the input', async () => {
      const page = await create(
        `<md-search open value="cats">
           <md-list slot="results">
             <md-list-item id="r1">One</md-list-item>
             <md-list-item id="r2">Two</md-list-item>
           </md-list>
         </md-search>`,
      );
      await page.waitForChanges();
      const input = page.root?.shadowRoot?.querySelector('input') as HTMLInputElement;
      const focusSpy = jest.spyOn(input, 'focus');
      input.focus();
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await page.waitForChanges();
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('ArrowUp from a middle result moves to the previous item', async () => {
      const page = await create(
        `<md-search open>
           <ul slot="results">
             <li id="r1">One</li>
             <li id="r2">Two</li>
             <li id="r3">Three</li>
           </ul>
         </md-search>`,
      );
      await page.waitForChanges();
      const first = page.root?.querySelector('#r1') as HTMLElement;
      const second = page.root?.querySelector('#r2') as HTMLElement;
      second.setAttribute('tabindex', '-1');

      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => second,
      });
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      await page.waitForChanges();
      expect(first.getAttribute('tabindex')).toBe('-1');
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => document.body,
      });
    });

    it('wraps Tab from the last focusable to the first in full-screen', async () => {
      const page = await create(
        `<md-search open layout="full-screen" value="hi">
           <button slot="trailing" id="trail">Filter</button>
         </md-search>`,
      );
      await page.waitForChanges();
      const first = page.root?.shadowRoot?.querySelector(
        '.md-search__leading-button',
      ) as HTMLElement;
      const last = page.root?.querySelector('#trail') as HTMLElement;
      const focusSpy = jest.spyOn(first, 'focus');

      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => last,
      });
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => document.body,
      });
    });

    it('wraps Shift+Tab from the first focusable to the last in full-screen', async () => {
      const page = await create(
        `<md-search open layout="full-screen" value="hi">
           <button slot="trailing" id="trail">Filter</button>
         </md-search>`,
      );
      await page.waitForChanges();
      const first = page.root?.shadowRoot?.querySelector(
        '.md-search__leading-button',
      ) as HTMLElement;
      const last = page.root?.querySelector('#trail') as HTMLElement;
      const focusSpy = jest.spyOn(last, 'focus');

      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => first,
      });
      page.win.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }),
      );
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => document.body,
      });
    });

    it('does not trap Tab in docked layout', async () => {
      const page = await create(
        `<md-search open layout="docked" value="hi">
           <button slot="trailing" id="trail">Filter</button>
         </md-search>`,
      );
      await page.waitForChanges();
      const outside = page.doc.createElement('button');
      outside.id = 'outside';
      page.body.appendChild(outside);
      outside.focus();
      const before = page.doc.activeElement;
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      await page.waitForChanges();
      expect(page.doc.activeElement).toBe(before);
    });

    it('ignores arrow keys while closed', async () => {
      const page = await create(
        `<md-search>
           <md-list slot="results"><md-list-item id="r1">One</md-list-item></md-list>
         </md-search>`,
      );
      await page.waitForChanges();
      page.win.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await page.waitForChanges();
      expect(page.root?.querySelector('#r1')?.getAttribute('tabindex')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Icons
  // ─────────────────────────────────────────────────────────────────────

  describe('icons', () => {
    // Both glyphs are always stacked inside the leading button so the
    // resting → open change can morph as a single icon. Tests therefore
    // assert against the explicit `--resting` / `--open` classes rather
    // than a generic `.md-search__icon` selector that would now match
    // both nodes ambiguously.

    it('renders the default leading icon (search) when closed', async () => {
      const page = await create('<md-search></md-search>');
      const icon = page.root?.shadowRoot?.querySelector(
        '.md-search__leading .md-search__icon--resting',
      );
      expect(icon?.textContent?.trim()).toBe('search');
    });

    it('renders a custom leading-icon prop', async () => {
      const page = await create('<md-search leading-icon="travel_explore"></md-search>');
      const icon = page.root?.shadowRoot?.querySelector(
        '.md-search__leading .md-search__icon--resting',
      );
      expect(icon?.textContent?.trim()).toBe('travel_explore');
    });

    it('renders chevron_left when contained + open (Expressive default)', async () => {
      // The contained pill uses a caret rather than the chunky arrow_back so
      // the open glyph echoes the bar's softer silhouette.
      const page = await create('<md-search open variant="contained"></md-search>');
      const icon = page.root?.shadowRoot?.querySelector(
        '.md-search__leading--button .md-search__icon--open',
      );
      expect(icon?.textContent?.trim()).toBe('chevron_left');
    });

    it('renders chevron_left in docked + open as well (morph applies in both layouts)', async () => {
      const page = await create('<md-search open variant="contained" layout="docked"></md-search>');
      const icon = page.root?.shadowRoot?.querySelector(
        '.md-search__leading--button .md-search__icon--open',
      );
      expect(icon?.textContent?.trim()).toBe('chevron_left');
    });

    it('renders arrow_back when divided + open (baseline keeps the spec-canonical glyph)', async () => {
      const page = await create('<md-search open variant="divided"></md-search>');
      const icon = page.root?.shadowRoot?.querySelector(
        '.md-search__leading--button .md-search__icon--open',
      );
      expect(icon?.textContent?.trim()).toBe('arrow_back');
    });

    it('respects open-leading-icon prop overriding both variant defaults', async () => {
      const containedOverride = await create(
        '<md-search open variant="contained" open-leading-icon="close"></md-search>',
      );
      expect(
        containedOverride.root?.shadowRoot
          ?.querySelector('.md-search__leading--button .md-search__icon--open')
          ?.textContent?.trim(),
      ).toBe('close');

      const dividedOverride = await create(
        '<md-search open variant="divided" open-leading-icon="close"></md-search>',
      );
      expect(
        dividedOverride.root?.shadowRoot
          ?.querySelector('.md-search__leading--button .md-search__icon--open')
          ?.textContent?.trim(),
      ).toBe('close');
    });

    it('keeps both resting and open glyphs in the DOM at all times for the morph', async () => {
      const closed = await create('<md-search></md-search>');
      expect(
        closed.root?.shadowRoot?.querySelector('.md-search__icon--resting'),
      ).toBeTruthy();
      expect(
        closed.root?.shadowRoot?.querySelector('.md-search__icon--open'),
      ).toBeTruthy();

      const open = await create('<md-search open></md-search>');
      expect(
        open.root?.shadowRoot?.querySelector('.md-search__icon--resting'),
      ).toBeTruthy();
      expect(
        open.root?.shadowRoot?.querySelector('.md-search__icon--open'),
      ).toBeTruthy();
    });
  });

  describe('scrollable results', () => {
    it('reflects scroll-shadow on the host', async () => {
      const page = await create('<md-search></md-search>');
      expect(page.root?.hasAttribute('scroll-shadow')).toBe(true);
    });

    it('exposes the results viewport part', async () => {
      const page = await create('<md-search></md-search>');
      const scroll = page.root?.shadowRoot?.querySelector(
        '.md-search__results-scroll',
      );
      expect(scroll?.getAttribute('part')).toContain('results-viewport');
    });

    it('exposes panel-body part', async () => {
      const page = await create('<md-search></md-search>');
      expect(
        page.root?.shadowRoot?.querySelector('[part="panel-body"]'),
      ).toBeTruthy();
    });

    it('applies max-block-size from attribute to host style', async () => {
      const page = await create('<md-search max-block-size="400px"></md-search>');
      expect(page.root?.style.getPropertyValue('--_max-block-size')).toBe('400px');
    });

    it('does not inline --_max-block-size when unset (so the docked panel cap applies)', async () => {
      // Regression: a literal inline/default `none` would swallow the docked
      // panel's `var(--_max-block-size, --_panel-max-block-size)` fallback,
      // leaving the panel uncapped and unable to scroll.
      const page = await create('<md-search layout="docked"></md-search>');
      expect(page.root?.style.getPropertyValue('--_max-block-size')).toBe('');
    });

    it('renders a compact docked panel body when few results are slotted', async () => {
      const page = await create(
        `<md-search layout="docked" open>
           <md-list-item slot="results">One</md-list-item>
           <md-list-item slot="results">Two</md-list-item>
         </md-search>`,
      );
      await page.waitForChanges();
      const panel = page.root?.shadowRoot?.querySelector('.md-search__panel--docked');
      const scroll = page.root?.shadowRoot?.querySelector('.md-search__results-scroll');
      expect(panel).toBeTruthy();
      expect(scroll).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('[part="empty"]')).toBeNull();
    });

    it('keeps the results scroll viewport inside results-host for the scroll flex chain', async () => {
      const page = await create(
        `<md-search layout="docked" open>
           ${Array.from({ length: 6 }, (_, i) => `<md-list-item slot="results">Row ${i + 1}</md-list-item>`).join('')}
         </md-search>`,
      );
      await page.waitForChanges();

      const resultsHost = page.root?.shadowRoot?.querySelector(
        '.md-search__results-host',
      );
      const scroll = page.root?.shadowRoot?.querySelector('.md-search__results-scroll');
      expect(resultsHost).toBeTruthy();
      expect(scroll).toBeTruthy();
      expect(resultsHost?.contains(scroll as Node)).toBe(true);
      expect(
        page.root?.shadowRoot?.querySelector('.md-search__panel--docked'),
      ).toBeTruthy();
    });
  });

  describe('elevation', () => {
    it('defaults to elevation level 0 (no shadow)', async () => {
      const page = await create('<md-search></md-search>');
      expect(page.root).toHaveClass('md-search--elevation-0');
      expect(page.root?.getAttribute('elevation')).toBe('0');
    });

    it('applies the elevation level class for levels 1–5', async () => {
      for (const level of [1, 2, 3, 4, 5]) {
        const page = await create(`<md-search elevation="${level}"></md-search>`);
        expect(page.root).toHaveClass(`md-search--elevation-${level}`);
      }
    });

    it('reflects the elevation attribute', async () => {
      const page = await create('<md-search elevation="3"></md-search>');
      expect(page.root?.getAttribute('elevation')).toBe('3');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Async results — mdSearch (debounce / throttle / distinct) + loading
  // ─────────────────────────────────────────────────────────────────────

  describe('async / loading', () => {
    function typeValue(page: any, value: string) {
      const input = page.root.shadowRoot.querySelector('input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    describe('mdSearch (distinct-until-changed)', () => {
      it('emits mdSearch immediately when debounce/throttle are 0', async () => {
        const page = await create('<md-search></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdSearch', spy);
        typeValue(page, 'cat');
        await page.waitForChanges();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].detail).toEqual({ value: 'cat' });
      });

      it('does not re-emit for an unchanged trimmed query', async () => {
        const page = await create('<md-search></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdSearch', spy);
        typeValue(page, 'cat');
        typeValue(page, 'cat');
        typeValue(page, '  cat  ');
        await page.waitForChanges();
        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('emits the trimmed query value', async () => {
        const page = await create('<md-search></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdSearch', spy);
        typeValue(page, '  dogs ');
        await page.waitForChanges();
        expect(spy.mock.calls[0][0].detail).toEqual({ value: 'dogs' });
      });

      it('does not re-fetch a seeded initial value on mount', async () => {
        const page = await create('<md-search value="seeded"></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdSearch', spy);
        typeValue(page, 'seeded');
        await page.waitForChanges();
        expect(spy).not.toHaveBeenCalled();
      });

      it('emits an empty query when the clear button is pressed', async () => {
        const page = await create('<md-search value="cats" open></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdSearch', spy);
        const clear = page.root?.shadowRoot?.querySelector(
          '[part="clear-button"]',
        ) as HTMLButtonElement;
        clear.click();
        await page.waitForChanges();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].detail).toEqual({ value: '' });
      });
    });

    describe('debounce + throttle', () => {
      // NOTE: fake timers are installed AFTER create() — installing them before
      // would deadlock Stencil's own waitForChanges() (it awaits real timers).
      // The mdSearch emit is a synchronous dispatchEvent fired from the timer
      // callback, so no waitForChanges() is needed to observe the spy.
      afterEach(() => jest.useRealTimers());

      it('debounces mdSearch until typing pauses', async () => {
        const page = await create('<md-search debounce="300"></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdSearch', spy);
        jest.useFakeTimers();
        typeValue(page, 'c');
        typeValue(page, 'ca');
        typeValue(page, 'cat');
        jest.advanceTimersByTime(299);
        expect(spy).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].detail).toEqual({ value: 'cat' });
      });

      it('forces an emit via throttle maxWait during sustained typing', async () => {
        const page = await create(
          '<md-search debounce="300" throttle="500"></md-search>',
        );
        const spy = jest.fn();
        page.root?.addEventListener('mdSearch', spy);
        jest.useFakeTimers();
        // Reset the debounce every 200ms so it never settles before maxWait.
        typeValue(page, 'a');
        jest.advanceTimersByTime(200);
        typeValue(page, 'ab');
        jest.advanceTimersByTime(200);
        typeValue(page, 'abc');
        jest.advanceTimersByTime(100); // total 500ms → throttle fires
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].detail).toEqual({ value: 'abc' });
      });

      it('flushes the pending debounced query immediately on Enter', async () => {
        const page = await create('<md-search open debounce="300"></md-search>');
        const spy = jest.fn();
        page.root?.addEventListener('mdSearch', spy);
        jest.useFakeTimers();
        typeValue(page, 'cat');
        const input = page.root?.shadowRoot?.querySelector(
          'input',
        ) as HTMLInputElement;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        // Flushed synchronously by the Enter handler, no timer advance needed.
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].detail).toEqual({ value: 'cat' });
      });
    });

    describe('loading indicator', () => {
      it('renders md-loading-indicator in the trailing cluster when loading', async () => {
        const page = await create('<md-search loading></md-search>');
        const trailing = page.root?.shadowRoot?.querySelector('[part="trailing"]');
        expect(trailing?.querySelector('[part="loading"]')).toBeTruthy();
        expect(trailing?.querySelector('md-loading-indicator')).toBeTruthy();
      });

      it('does not render the loading indicator when not loading', async () => {
        const page = await create('<md-search></md-search>');
        expect(page.root?.shadowRoot?.querySelector('[part="loading"]')).toBeFalsy();
      });

      it('morphs the clear button away while loading (stays mounted for the cross-fade)', async () => {
        const page = await create('<md-search loading value="cats"></md-search>');
        const shadow = page.root?.shadowRoot;
        expect(shadow?.querySelector('[part="loading"]')).toBeTruthy();
        // The clear button stays in the DOM so the swap can cross-fade in both
        // directions; the morph box carries the loading state that visually
        // hides it via CSS (opacity/scale/rotate).
        const morph = shadow?.querySelector('.md-search__trailing-morph');
        expect(morph).toBeTruthy();
        expect(morph?.classList.contains('md-search__trailing-morph--loading')).toBe(true);
        expect(shadow?.querySelector('[part="clear-button"]')).toBeTruthy();
      });

      it('passes loadingLabel to the indicator', async () => {
        const page = await create(
          '<md-search loading loading-label="Fetching"></md-search>',
        );
        const indicator = page.root?.shadowRoot?.querySelector(
          'md-loading-indicator',
        );
        // The un-upgraded nested element receives `label` as an attribute.
        expect(indicator?.getAttribute('label')).toBe('Fetching');
      });

      it('reflects the loading attribute', async () => {
        const page = await create('<md-search loading></md-search>');
        expect(page.root?.getAttribute('loading')).not.toBeNull();
      });

      it('announces the searching state while open + loading', async () => {
        const page = await create('<md-search open loading></md-search>');
        const status = page.root?.shadowRoot?.querySelector('[part="status"]');
        expect(status?.textContent).toContain('Searching');
      });

      it('keeps the clear button mounted through a loading transition', async () => {
        const page = await create('<md-search value="cats"></md-search>');
        page.rootInstance.loading = true;
        await page.waitForChanges();
        expect(
          page.root?.shadowRoot?.querySelector('[part="clear-button"]'),
        ).toBeTruthy();
        page.rootInstance.loading = false;
        await page.waitForChanges();
        expect(
          page.root?.shadowRoot?.querySelector('.md-search__trailing-morph'),
        ).toBeTruthy();
      });

      it('commits loading visibility on the next animation frame', async () => {
        const page = await create('<md-search value="cats"></md-search>');
        page.rootInstance.loading = true;
        await page.waitForChanges();
        expect(
          (page.rootInstance as unknown as { loadingMorphMounted: boolean }).loadingMorphMounted,
        ).toBe(true);
        expect(
          (page.rootInstance as unknown as { loadingMorphIn: boolean }).loadingMorphIn,
        ).toBe(false);

        await flushRaf();
        await page.waitForChanges();
        expect(
          (page.rootInstance as unknown as { loadingMorphIn: boolean }).loadingMorphIn,
        ).toBe(true);
      });

      it('does not commit loading morph in when loading clears before the animation frame', async () => {
        const rafCbs: FrameRequestCallback[] = [];
        const spy = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
          rafCbs.push(cb);
          return rafCbs.length;
        });
        const page = await create('<md-search value="cats"></md-search>');
        page.rootInstance.loading = true;
        page.rootInstance.loading = false;
        for (const cb of rafCbs) cb(0);
        expect(
          (page.rootInstance as unknown as { loadingMorphIn: boolean }).loadingMorphIn,
        ).toBe(false);
        spy.mockRestore();
      });

      it('commits loading morph immediately when requestAnimationFrame is unavailable', async () => {
        const raf = global.requestAnimationFrame;
        const caf = global.cancelAnimationFrame;
         
        delete (global as any).requestAnimationFrame;
         
        delete (global as any).cancelAnimationFrame;
        try {
          const page = await create('<md-search value="cats"></md-search>');
          page.rootInstance.loading = true;
          await page.waitForChanges();
          expect(
            (page.rootInstance as unknown as { loadingMorphIn: boolean }).loadingMorphIn,
          ).toBe(true);
        } finally {
          global.requestAnimationFrame = raf;
          global.cancelAnimationFrame = caf;
        }
      });

      it('unmounts the loading morph after the morph duration elapses', async () => {
        const page = await create('<md-search value="cats"></md-search>');
        jest.useFakeTimers();
        try {
          page.rootInstance.loading = true;
          page.rootInstance.loading = false;
          jest.advanceTimersByTime(300);
          const instance = page.rootInstance as unknown as { loadingMorphMounted: boolean };
          expect(instance.loadingMorphMounted).toBe(false);
        } finally {
          jest.useRealTimers();
        }
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Voice search (Web Speech API)
  // ─────────────────────────────────────────────────────────────────────

  describe('voice search', () => {
    it('does not render the mic when voice-search is off', async () => {
      const page = await create('<md-search></md-search>');
      expect(
        page.root?.shadowRoot?.querySelector('[part="voice-button"]'),
      ).toBeFalsy();
    });

    it('stays a no-op (no mic) when the Web Speech API is unavailable', async () => {
      // The spec environment exposes no SpeechRecognition global, so an opted-in
      // mic must degrade gracefully and render nothing.
      const page = await create('<md-search voice-search></md-search>');
      expect(
        page.root?.shadowRoot?.querySelector('[part="voice-button"]'),
      ).toBeFalsy();
    });

    it('renders the mic when voice-search is on and the API is available', async () => {
      const page = await create('<md-search voice-search placeholder="Find"></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        await speech.rerenderVoice(page);
        const mic = page.root?.shadowRoot?.querySelector('[part="voice-button"]');
        expect(mic).toBeTruthy();
        expect(mic?.getAttribute('aria-label')).toBe('Search by voice');
        expect(mic?.getAttribute('aria-pressed')).toBe('false');
      } finally {
        speech.cleanup();
      }
    });

    it('startVoice() opens the view and marks the mic as pressed', async () => {
      const page = await create('<md-search voice-search></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();
        expect(page.rootInstance.open).toBe(true);
        expect(speech.last()?.start).toHaveBeenCalled();
        const mic = page.root?.shadowRoot?.querySelector('[part="voice-button"]');
        expect(mic?.getAttribute('aria-pressed')).toBe('true');
      } finally {
        speech.cleanup();
      }
    });

    it('stopVoice() ends the session and resets aria-pressed', async () => {
      const page = await create('<md-search voice-search open></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();
        await page.rootInstance.stopVoice();
        await page.waitForChanges();
        expect(speech.last()?.stop).toHaveBeenCalled();
        const mic = page.root?.shadowRoot?.querySelector('[part="voice-button"]');
        expect(mic?.getAttribute('aria-pressed')).toBe('false');
      } finally {
        speech.cleanup();
      }
    });

    it('emits mdVoice and mdInput when recognition returns a transcript', async () => {
      const page = await create('<md-search voice-search></md-search>');
      const speech = installSpeechRecognition(page);
      const voiceSpy = jest.fn();
      const inputSpy = jest.fn();
      page.root?.addEventListener('mdVoice', voiceSpy);
      page.root?.addEventListener('mdInput', inputSpy);
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();

        speech.last()?.onresult?.({
          results: [
            { 0: { transcript: ' kittens' }, isFinal: false, length: 1 },
          ],
          length: 1,
        });
        await page.waitForChanges();

        expect(page.rootInstance.value).toBe('kittens');
        expect(inputSpy).toHaveBeenCalledWith(
          expect.objectContaining({ detail: { value: 'kittens' } }),
        );
        expect(voiceSpy).toHaveBeenCalledWith(
          expect.objectContaining({ detail: { value: 'kittens', final: false } }),
        );
      } finally {
        speech.cleanup();
      }
    });

    it('stops listening when the mic button is clicked while active', async () => {
      const page = await create('<md-search voice-search open></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();
        const mic = page.root?.shadowRoot?.querySelector(
          '[part="voice-button"]',
        ) as HTMLButtonElement;
        mic.click();
        await page.waitForChanges();
        expect(speech.last()?.stop).toHaveBeenCalled();
        expect(mic.getAttribute('aria-pressed')).toBe('false');
      } finally {
        speech.cleanup();
      }
    });

    it('handleVoiceClick starts capture when idle', async () => {
      const page = await create('<md-search voice-search placeholder="Search"></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        const instance = page.rootInstance as unknown as {
          handleVoiceClick: (e: MouseEvent) => void;
        };
        instance.handleVoiceClick({ stopPropagation: () => {} } as MouseEvent);
        expect(speech.last()?.start).toHaveBeenCalled();
        expect(page.rootInstance.open).toBe(true);
      } finally {
        speech.cleanup();
      }
    });

    it('handleVoiceClick is a no-op when disabled', async () => {
      const page = await create(
        '<md-search voice-search disabled placeholder="Search"></md-search>',
      );
      const speech = installSpeechRecognition(page);
      try {
        const instance = page.rootInstance as unknown as {
          handleVoiceClick: (e: MouseEvent) => void;
        };
        instance.handleVoiceClick({ stopPropagation: () => {} } as MouseEvent);
        expect(speech.instances.length).toBe(0);
      } finally {
        speech.cleanup();
      }
    });

    it('resets listening state when recognition.start() throws', async () => {
      const page = await create('<md-search voice-search></md-search>');
      const speech = installSpeechRecognition(page, { startThrows: true });
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();
        const mic = page.root?.shadowRoot?.querySelector('[part="voice-button"]');
        expect(mic?.getAttribute('aria-pressed')).toBe('false');
      } finally {
        speech.cleanup();
      }
    });

    it('aborts a stale recognition object before starting a new session', async () => {
      const page = await create('<md-search voice-search></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        await speech.rerenderVoice(page);
        const stale = { abort: jest.fn(), stop: jest.fn() };
        const instance = page.rootInstance as unknown as {
          recognition: { abort: jest.Mock; stop: jest.Mock } | undefined;
          listening: boolean;
        };
        instance.recognition = stale;
        instance.listening = false;
        await page.rootInstance.startVoice();
        expect(stale.abort).toHaveBeenCalled();
        expect(speech.last()?.start).toHaveBeenCalled();
      } finally {
        speech.cleanup();
      }
    });

    it('uses the host lang attribute for recognition', async () => {
      const page = await create('<md-search voice-search lang="fr-FR"></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        expect(speech.last()?.lang).toBe('fr-FR');
      } finally {
        speech.cleanup();
      }
    });

    it('flushes mdSearch and stops on a final transcript', async () => {
      const page = await create('<md-search voice-search></md-search>');
      const speech = installSpeechRecognition(page);
      const searchSpy = jest.fn();
      page.root?.addEventListener('mdSearch', searchSpy);
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();

        speech.last()?.onresult?.({
          results: [{ 0: { transcript: 'cats' }, isFinal: true, length: 1 }],
          length: 1,
        });
        await page.waitForChanges();

        expect(searchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ detail: { value: 'cats' } }),
        );
        expect(speech.last()?.stop).toHaveBeenCalled();
        const mic = page.root?.shadowRoot?.querySelector('[part="voice-button"]');
        expect(mic?.getAttribute('aria-pressed')).toBe('false');
      } finally {
        speech.cleanup();
      }
    });

    it('clears listening state when recognition ends', async () => {
      const page = await create('<md-search voice-search open></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();
        speech.last()?.onend?.();
        await page.waitForChanges();
        const mic = page.root?.shadowRoot?.querySelector('[part="voice-button"]');
        expect(mic?.getAttribute('aria-pressed')).toBe('false');
      } finally {
        speech.cleanup();
      }
    });

    it('clears listening state when recognition errors', async () => {
      const page = await create('<md-search voice-search open></md-search>');
      const speech = installSpeechRecognition(page);
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();
        speech.last()?.onerror?.({ error: 'network' });
        await page.waitForChanges();
        const mic = page.root?.shadowRoot?.querySelector('[part="voice-button"]');
        expect(mic?.getAttribute('aria-pressed')).toBe('false');
      } finally {
        speech.cleanup();
      }
    });

    it('tolerates stop() throwing on an inactive session', async () => {
      const page = await create('<md-search voice-search open></md-search>');
      const speech = installSpeechRecognition(page, { stopThrows: true });
      try {
        await speech.rerenderVoice(page);
        await page.rootInstance.startVoice();
        await page.waitForChanges();
        await expect(page.rootInstance.stopVoice()).resolves.toBeUndefined();
      } finally {
        speech.cleanup();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Conditional rendering — no empty wrappers
  // ─────────────────────────────────────────────────────────────────────

  describe('conditional rendering (no empty wrappers)', () => {
    it('omits the clear button when there is no value', async () => {
      const page = await create('<md-search></md-search>');
      expect(
        page.root?.shadowRoot?.querySelector('[part="clear-button"]'),
      ).toBeFalsy();
    });

    it('omits the trailing morph box when idle (no value, not loading)', async () => {
      const page = await create('<md-search></md-search>');
      expect(
        page.root?.shadowRoot?.querySelector('.md-search__trailing-morph'),
      ).toBeFalsy();
    });

    it('omits the loading indicator when not loading', async () => {
      const page = await create('<md-search value="x"></md-search>');
      expect(
        page.root?.shadowRoot?.querySelector('[part="loading"]'),
      ).toBeFalsy();
    });
  });
});
