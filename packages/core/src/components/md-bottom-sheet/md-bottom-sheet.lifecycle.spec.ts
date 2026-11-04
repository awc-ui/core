import { newSpecPage } from '@stencil/core/testing';
import { MdBottomSheet } from './md-bottom-sheet';

describe('md-bottom-sheet lifecycle parity', () => {
  const mounted: MdBottomSheet[] = [];
  const create = async (html = '<md-bottom-sheet></md-bottom-sheet>') => {
    const page = await newSpecPage({ components: [MdBottomSheet], html });
    mounted.push(page.rootInstance);
    return page;
  };
  afterEach(() => {
    document.querySelectorAll('md-bottom-sheet').forEach(el => el.remove());
    mounted.splice(0).forEach(sheet => sheet.disconnectedCallback());
  });
  const tick = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const pointer = (target: Element, type: string, clientY: number, pointerId = 1, button = 0) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button });
    Object.defineProperties(event, { clientY: { value: clientY }, pointerId: { value: pointerId } });
    target.dispatchEvent(event);
  };

  it('renders a headline slot without requiring a fallback headline property', async () => {
    const page = await create('<md-bottom-sheet><strong slot="headline">Authored title</strong></md-bottom-sheet>');
    const title = page.root!.shadowRoot!.querySelector('[part="headline"]')!;
    expect(title).toBeTruthy();
    expect(page.root!.shadowRoot!.querySelector('[part="container"]')!.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('lets an explicit accessible label override a visible headline', async () => {
    const page = await create('<md-bottom-sheet headline="Visible" aria-label="Accessible"></md-bottom-sheet>');
    const panel = page.root!.shadowRoot!.querySelector('[part="container"]')!;
    expect(panel.getAttribute('aria-label')).toBe('Accessible');
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('ignores nested descendants whose slot belongs to another component', async () => {
    const page = await create('<md-bottom-sheet><section><button slot="actions">Nested</button><span slot="headline">Nested title</span></section></md-bottom-sheet>');
    expect(page.root!.shadowRoot!.querySelector('[part="actions"]')).toBeNull();
    expect(page.root!.shadowRoot!.querySelector('[part="headline"]')).toBeNull();
  });

  it('detects newly added and reassigned direct slots even when the wrapper did not exist', async () => {
    const page = await create('<md-bottom-sheet bottom-divider></md-bottom-sheet>');
    const node = page.doc.createElement('button');
    node.setAttribute('slot', 'actions'); page.root!.append(node);
    // mock-doc does not deliver MutationObserver records; invoke the same
    // direct-child refresh used by the observer and declarative slot handlers.
    page.rootInstance.syncSlots(); await page.waitForChanges();
    expect(page.root!.shadowRoot!.querySelector('[part="actions"]')).toBeTruthy();
    expect(page.root!.shadowRoot!.querySelector('[part="divider-bottom"]')).toBeTruthy();
    node.setAttribute('slot', 'close'); page.rootInstance.syncSlots(); await page.waitForChanges();
    expect(page.root!.shadowRoot!.querySelector('[part="close"]')).toBeTruthy();
    expect(page.root!.shadowRoot!.querySelector('[part="actions"]')).toBeNull();
    node.remove(); page.rootInstance.syncSlots(); await page.waitForChanges();
    expect(page.root!.shadowRoot!.querySelector('[part="header"]')).toBeNull();
  });

  it('does not remove inert or move focus after opening and closing within one frame', async () => {
    const page = await create();
    const container = page.root!.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    const focus = jest.spyOn(container, 'focus');
    page.rootInstance.open = true; page.rootInstance.open = false;
    await page.waitForChanges(); await tick();
    expect(container.hasAttribute('inert')).toBe(true);
    expect(focus).not.toHaveBeenCalled();
  });

  it('restores authored overflow and reacquires it on reconnect without a second mdOpen', async () => {
    const page = await create();
    document.body.style.overflow = 'scroll';
    const open = jest.fn(); page.root!.addEventListener('mdOpen', open);
    page.rootInstance.open = true; await page.waitForChanges();
    expect(document.body.style.overflow).toBe('hidden');
    page.rootInstance.disconnectedCallback();
    expect(document.body.style.overflow).toBe('scroll');
    page.rootInstance.connectedCallback(); await tick();
    expect(document.body.style.overflow).toBe('hidden');
    expect(open).toHaveBeenCalledTimes(1);
    page.rootInstance.open = false; await page.waitForChanges();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('does not acquire document resources when show is called on a detached sheet', async () => {
    const page = await create();
    page.rootInstance.disconnectedCallback();
    await page.rootInstance.show(); await page.waitForChanges();
    expect(document.body.style.overflow).not.toBe('hidden');
    page.rootInstance.connectedCallback(); await page.waitForChanges();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('does not release the active sheet scroll lock when a closed sheet disconnects', async () => {
    const page = await create('<md-bottom-sheet open>One</md-bottom-sheet><md-bottom-sheet>Two</md-bottom-sheet>');
    const sheets = [...page.doc.querySelectorAll('md-bottom-sheet')];
    sheets[1].remove(); await page.waitForChanges();
    expect(document.body.style.overflow).toBe('hidden');
    sheets[0].remove(); await page.waitForChanges();
    expect(document.body.style.overflow).toBe('');
  });

  it('dismisses only the top sheet and keeps scroll locked until the final sheet closes', async () => {
    const page = await create('<md-bottom-sheet open>One</md-bottom-sheet><md-bottom-sheet open>Two</md-bottom-sheet>');
    const sheets = [...page.doc.querySelectorAll('md-bottom-sheet')];
    const firstCancel = jest.fn(), secondCancel = jest.fn();
    sheets[0].addEventListener('mdCancel', firstCancel); sheets[1].addEventListener('mdCancel', secondCancel);
    page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await page.waitForChanges();
    expect(firstCancel).not.toHaveBeenCalled(); expect(secondCancel).toHaveBeenCalledTimes(1);
    expect(sheets[0].hasAttribute('open')).toBe(true); expect(sheets[1].hasAttribute('open')).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
    page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await page.waitForChanges(); expect(document.body.style.overflow).toBe('');
  });

  it('wraps the first focus guard to the last control and the last guard to the first', async () => {
    const page = await create('<md-bottom-sheet open><button id="first">First</button><input id="last"></md-bottom-sheet>');
    const first = jest.spyOn(page.root!.querySelector('#first') as HTMLElement, 'focus');
    const last = jest.spyOn(page.root!.querySelector('#last') as HTMLElement, 'focus');
    const guards = page.root!.shadowRoot!.querySelectorAll('.md-bottom-sheet__focus-guard');
    guards[0].dispatchEvent(new FocusEvent('focus'));
    expect(last).toHaveBeenCalledTimes(1); expect(first).not.toHaveBeenCalled();
    guards[1].dispatchEvent(new FocusEvent('focus'));
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('collects actual controls in composed order and excludes hidden, disabled and negative-tabindex branches', async () => {
    const page = await create('<md-bottom-sheet open><button id="first">First</button><div hidden><button>Hidden</button></div><input type="hidden"><button disabled>Disabled</button><button tabindex="-2">Skip</button><span id="custom"></span><input id="last"></md-bottom-sheet>');
    const custom = page.root!.querySelector('#custom')!;
    custom.attachShadow({ mode: 'open' }).innerHTML = '<input id="shadow-input">';
    const collected = page.rootInstance.getFocusableElements() as HTMLElement[];
    expect(collected.map(el => el.id)).toEqual(['first', 'shadow-input', 'last']);
  });

  for (const ending of ['pointercancel', 'lostpointercapture']) {
    it(`${ending} aborts a drag past the threshold without dismissing`, async () => {
      const page = await create('<md-bottom-sheet open>Body</md-bottom-sheet>');
      const handle = page.root!.shadowRoot!.querySelector('[part="drag-handle"]')!;
      const panel = page.root!.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
      const cancel = jest.fn(); page.root!.addEventListener('mdCancel', cancel);
      pointer(handle, 'pointerdown', 20); pointer(handle, 'pointermove', 160); pointer(handle, ending, 160);
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true); expect(cancel).not.toHaveBeenCalled();
      expect(panel.style.transform).toBe(''); expect(panel.style.transition).toBe('');
    });
  }

  it('ignores another pointer throughout a retained drag', async () => {
    const page = await create('<md-bottom-sheet open>Body</md-bottom-sheet>');
    const handle = page.root!.shadowRoot!.querySelector('[part="drag-handle"]')!;
    const panel = page.root!.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    pointer(handle, 'pointerdown', 20, 1); pointer(handle, 'pointermove', 160, 2); pointer(handle, 'pointerup', 160, 2);
    expect(panel.style.transform).toBe(''); expect(page.rootInstance.open).toBe(true);
    pointer(handle, 'pointermove', 50, 1); expect(panel.style.transform).toBe('translateY(30px)');
    pointer(handle, 'pointercancel', 50, 1);
  });

  it('ignores a second press without overwriting the drag origin', async () => {
    const page = await create('<md-bottom-sheet open>Body</md-bottom-sheet>');
    const handle = page.root!.shadowRoot!.querySelector('[part="drag-handle"]')!;
    const panel = page.root!.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    pointer(handle, 'pointerdown', 20, 1); pointer(handle, 'pointerdown', 100, 2); pointer(handle, 'pointermove', 50, 1);
    expect(panel.style.transform).toBe('translateY(30px)'); pointer(handle, 'pointercancel', 50, 1);
  });

  it('does not start a secondary-button drag', async () => {
    const page = await create('<md-bottom-sheet open>Body</md-bottom-sheet>');
    const handle = page.root!.shadowRoot!.querySelector('[part="drag-handle"]')!;
    pointer(handle, 'pointerdown', 0, 1, 2); pointer(handle, 'pointermove', 180); pointer(handle, 'pointerup', 180);
    expect(page.rootInstance.open).toBe(true);
  });

  for (const ending of ['hide-handle', 'close', 'disconnect']) {
    it(`cleans transform and disabled transitions when a drag ends through ${ending}`, async () => {
      const page = await create('<md-bottom-sheet open>Body</md-bottom-sheet>');
      const handle = page.root!.shadowRoot!.querySelector('[part="drag-handle"]')!;
      const panel = page.root!.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
      pointer(handle, 'pointerdown', 0); pointer(handle, 'pointermove', 140);
      if (ending === 'hide-handle') page.root!.setAttribute('show-drag-handle', 'false');
      else if (ending === 'close') await page.rootInstance.close();
      else page.rootInstance.disconnectedCallback();
      await page.waitForChanges();
      expect(panel.style.transform).toBe(''); expect(panel.style.transition).toBe('');
    });
  }
});
